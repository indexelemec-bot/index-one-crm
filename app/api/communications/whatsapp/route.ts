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

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa la propuesta, el contacto y el mensaje." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  let delivery: Awaited<ReturnType<typeof loadProposalDeliveryFile>>;
  try { delivery = await loadProposalDeliveryFile(supabase, parsed.data.proposalId); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible preparar la propuesta." }, { status: 400 }); }
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
  let whatsappUrl: string;
  try { whatsappUrl = buildWhatsAppUrl(String(stakeholder.phone), message); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Número de WhatsApp inválido." }, { status: 400 }); }
  const createdAt = new Date().toISOString();
  const messageId = crypto.randomUUID();
  const { data: communication, error: recordError } = await supabase.from("communications").insert({
    id: messageId, opportunity_id: opportunityId, proposal_id: parsed.data.proposalId, stakeholder_id: stakeholder.id,
    channel: "whatsapp", direction: "outbound", from_address: "WhatsApp del ejecutivo", to_address: stakeholder.phone,
    subject: `Propuesta v${delivery.proposal.version} — ${delivery.proposal.client_name}`, body_text: parsed.data.body,
    template_key: "propuesta", provider: "wa.me", attachment_format: delivery.proposal.file_format, status: "queued",
    created_by: authData.user.id, sent_at: createdAt
  }).select("*").single();
  if (recordError || !communication) return NextResponse.json({ error: "No fue posible registrar la apertura de WhatsApp." }, { status: 500 });
  return NextResponse.json({ communication, whatsappUrl });
}
