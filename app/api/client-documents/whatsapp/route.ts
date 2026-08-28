import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { loadClientDocumentFile } from "@/lib/client-documents/load-file";
import { createClient } from "@/lib/supabase/server";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export const runtime = "nodejs";

const schema = z.object({ documentId: z.string().uuid(), stakeholderId: z.string().uuid(), body: z.string().trim().min(10).max(4000) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa el documento, contacto y mensaje." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  let delivery: Awaited<ReturnType<typeof loadClientDocumentFile>>;
  try { delivery = await loadClientDocumentFile(supabase, parsed.data.documentId); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Documento no disponible." }, { status: 404 }); }
  const opportunityId = String(delivery.document.opportunity_id);
  const { data: opportunity } = await supabase.from("opportunities").select("id,account_id").eq("id", opportunityId).single();
  if (!opportunity) return NextResponse.json({ error: "Oportunidad no disponible." }, { status: 403 });
  const { data: stakeholder } = await supabase.from("stakeholders").select("id,full_name,phone,account_id").eq("id", parsed.data.stakeholderId).eq("account_id", opportunity.account_id).single();
  if (!stakeholder?.phone) return NextResponse.json({ error: "El contacto seleccionado no tiene WhatsApp válido." }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Falta habilitar el almacenamiento seguro." }, { status: 503 });
  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const storagePath = `${opportunityId}/${delivery.document.id}/${delivery.file.fileName}`;
  const { error: uploadError } = await admin.storage.from("client-document-files").upload(storagePath, Buffer.from(delivery.file.bytes), { contentType: delivery.file.contentType, upsert: true });
  if (uploadError) return NextResponse.json({ error: "No fue posible preparar el enlace privado." }, { status: 500 });
  const { data: signed, error: signedError } = await admin.storage.from("client-document-files").createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  if (signedError || !signed?.signedUrl) return NextResponse.json({ error: "No fue posible crear el enlace privado." }, { status: 500 });

  const message = `${parsed.data.body}\n\nDocumento privado disponible durante 7 días:\n${signed.signedUrl}`;
  let whatsappUrl: string | undefined;
  let provider = "wa.me";
  let providerMessageId: string | undefined;
  let status = "queued";
  const realSendingEnabled = process.env.WHATSAPP_REAL_SEND_ENABLED === "true";
  if (realSendingEnabled) {
    const metaToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID;
    if (!metaToken || !phoneNumberId) return NextResponse.json({ error: "WhatsApp Business todavía no está configurado." }, { status: 503 });
    const digits = String(stakeholder.phone).replace(/\D/g, "");
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: digits, type: "document", document: { link: signed.signedUrl, filename: delivery.file.fileName, caption: parsed.data.body } })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.messages?.[0]?.id) return NextResponse.json({ error: result.error?.message ?? "WhatsApp Business no confirmó el envío." }, { status: 502 });
    provider = "meta_whatsapp"; providerMessageId = result.messages[0].id; status = "sent";
  } else {
    try { whatsappUrl = buildWhatsAppUrl(String(stakeholder.phone), message); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Número inválido." }, { status: 400 }); }
  }

  const sentAt = new Date().toISOString();
  const { data: communication, error: recordError } = await supabase.from("communications").insert({
    opportunity_id: opportunityId, client_document_id: delivery.document.id, stakeholder_id: stakeholder.id,
    channel: "whatsapp", direction: "outbound", from_address: process.env.WHATSAPP_BUSINESS_DISPLAY_NUMBER || "WhatsApp del ejecutivo",
    to_address: stakeholder.phone, subject: `${delivery.document.title} — ${delivery.snapshot.clientName}`,
    body_text: parsed.data.body, template_key: delivery.document.template_key, provider, provider_message_id: providerMessageId,
    attachment_format: "pdf", status, created_by: authData.user.id, sent_at: sentAt
  }).select("*").single();
  if (recordError || !communication) return NextResponse.json({ error: "No fue posible registrar el envío." }, { status: 500 });
  await supabase.from("client_documents").update({ status: "sent", sent_at: sentAt }).eq("id", delivery.document.id);
  return NextResponse.json({ communication, whatsappUrl, mode: provider === "meta_whatsapp" ? "official" : "link" });
}
