import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { loadProposalDeliveryFile } from "@/lib/proposals/load-delivery-file";
import { createClient } from "@/lib/supabase/server";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export const runtime = "nodejs";

const schema = z.object({
  proposalId: z.string().uuid(),
  stakeholderId: z.string().uuid(),
  body: z.string().trim().min(10).max(4000)
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadProposalWithPersistenceWait(supabase: Awaited<ReturnType<typeof createClient>>, proposalId: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 7; attempt += 1) {
    try {
      return await loadProposalDeliveryFile(supabase!, proposalId);
    } catch (error) {
      lastError = error;
      if (attempt < 6) await sleep(350 + attempt * 150);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("La propuesta todavía no está disponible para enviar.");
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa la propuesta, el contacto y el mensaje." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  let delivery: Awaited<ReturnType<typeof loadProposalDeliveryFile>>;
  try { delivery = await loadProposalWithPersistenceWait(supabase, parsed.data.proposalId); }
  catch (error) {
    return NextResponse.json({
      error: error instanceof Error && !error.message.includes("no está disponible")
        ? error.message
        : "La propuesta todavía se está guardando. Espera unos segundos y vuelve a intentar el envío."
    }, { status: 409 });
  }

  const opportunityId = String(delivery.proposal.opportunity_id);
  const { data: opportunity, error: opportunityError } = await supabase.from("opportunities").select("id,account_id").eq("id", opportunityId).single();
  if (opportunityError || !opportunity) return NextResponse.json({ error: "La oportunidad no está disponible para este usuario." }, { status: 403 });
  const { data: stakeholder, error: stakeholderError } = await supabase.from("stakeholders").select("id,full_name,phone,account_id").eq("id", parsed.data.stakeholderId).eq("account_id", opportunity.account_id).single();
  if (stakeholderError || !stakeholder?.phone) return NextResponse.json({ error: "El contacto seleccionado no tiene un WhatsApp válido." }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Falta habilitar el almacenamiento seguro de propuestas." }, { status: 503 });
  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const storagePath = `${opportunityId}/${parsed.data.proposalId}/${delivery.file.fileName}`;
  const { error: uploadError } = await admin.storage.from("proposal-files").upload(storagePath, Buffer.from(delivery.file.bytes), { contentType: delivery.file.contentType, upsert: true });
  if (uploadError) return NextResponse.json({ error: "No fue posible preparar el enlace privado de la propuesta." }, { status: 500 });
  const { data: signed, error: signedError } = await admin.storage.from("proposal-files").createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  if (signedError || !signed?.signedUrl) return NextResponse.json({ error: "No fue posible crear el enlace privado de la propuesta." }, { status: 500 });

  const message = `${parsed.data.body}\n\nDocumento privado disponible durante 7 días:\n${signed.signedUrl}`;
  let whatsappUrl: string | undefined; let provider = "wa.me"; let providerMessageId: string | undefined; let status = "queued";
  const metaToken = process.env.WHATSAPP_ACCESS_TOKEN; const phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID;
  if (metaToken && phoneNumberId) {
    const digits = String(stakeholder.phone).replace(/\D/g, "");
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: digits, type: "text", text: { preview_url: true, body: message } }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.messages?.[0]?.id) return NextResponse.json({ error: result.error?.message ?? "WhatsApp Business no confirmó el envío." }, { status: 502 });
    provider = "meta_whatsapp"; providerMessageId = result.messages[0].id; status = "sent";
  } else {
    try { whatsappUrl = buildWhatsAppUrl(String(stakeholder.phone), message); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Número de WhatsApp inválido." }, { status: 400 }); }
  }
  const createdAt = new Date().toISOString();
  const messageId = crypto.randomUUID();
  const { data: communication, error: recordError } = await supabase.from("communications").insert({
    id: messageId, opportunity_id: opportunityId, proposal_id: parsed.data.proposalId, stakeholder_id: stakeholder.id,
    channel: "whatsapp", direction: "outbound", from_address: process.env.WHATSAPP_BUSINESS_DISPLAY_NUMBER || "WhatsApp del ejecutivo", to_address: stakeholder.phone,
    subject: `Propuesta v${delivery.proposal.version} — ${delivery.proposal.client_name}`, body_text: parsed.data.body,
    template_key: "propuesta", provider, provider_message_id: providerMessageId, attachment_format: delivery.proposal.file_format, status,
    created_by: authData.user.id, sent_at: createdAt
  }).select("*").single();
  if (recordError || !communication) return NextResponse.json({ error: "No fue posible registrar la apertura de WhatsApp." }, { status: 500 });
  await supabase.from("proposals").update({ status: "enviada", sent_at: new Date().toISOString() }).eq("id", parsed.data.proposalId);
  return NextResponse.json({ communication, whatsappUrl, mode: provider === "meta_whatsapp" ? "official" : "link" });
}
