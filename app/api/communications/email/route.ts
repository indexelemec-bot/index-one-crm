import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { ClientMessageEmail } from "@/emails/client-message";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const emailSchema = z.object({
  opportunityId: z.string().uuid(), stakeholderId: z.string().uuid(), templateKey: z.string().max(50).optional(),
  subject: z.string().trim().min(4).max(180), body: z.string().trim().min(10).max(12000)
});

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY; const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return NextResponse.json({ error: "El proveedor de correo todavía no está configurado." }, { status: 503 });
  const parsed = emailSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa el destinatario, asunto y contenido." }, { status: 400 });
  const supabase = await createClient(); if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser(); if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  const { data: opportunity, error: opportunityError } = await supabase.from("opportunities").select("id,account_id,owner_id,accounts(name)").eq("id", parsed.data.opportunityId).single();
  if (opportunityError || !opportunity) return NextResponse.json({ error: "La oportunidad no está disponible para este usuario." }, { status: 403 });
  const { data: stakeholder, error: stakeholderError } = await supabase.from("stakeholders").select("id,full_name,email,account_id").eq("id", parsed.data.stakeholderId).eq("account_id", opportunity.account_id).single();
  if (stakeholderError || !stakeholder?.email) return NextResponse.json({ error: "El contacto seleccionado no tiene un correo válido." }, { status: 400 });
  const { data: profile } = await supabase.from("profiles").select("full_name,email").eq("id", authData.user.id).single();
  const clientName = Array.isArray(opportunity.accounts) ? opportunity.accounts[0]?.name : (opportunity.accounts as { name?: string } | null)?.name;
  const messageId = crypto.randomUUID();
  const { error: queueError } = await supabase.from("communications").insert({ id: messageId, opportunity_id: opportunity.id, stakeholder_id: stakeholder.id, channel: "email", direction: "outbound", from_address: from, to_address: stakeholder.email, subject: parsed.data.subject, body_text: parsed.data.body, template_key: parsed.data.templateKey ?? null, provider: "resend", status: "queued", created_by: authData.user.id });
  if (queueError) return NextResponse.json({ error: "No se pudo registrar el correo en el expediente." }, { status: 500 });
  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({ from, to: stakeholder.email, subject: parsed.data.subject, replyTo: process.env.EMAIL_REPLY_TO || profile?.email || authData.user.email, react: ClientMessageEmail({ clientName: clientName || "su condominio", recipientName: stakeholder.full_name, body: parsed.data.body, senderName: profile?.full_name || "Equipo Comercial INDEX ONE" }), tags: [{ name: "opportunity_id", value: opportunity.id }, { name: "communication_id", value: messageId }] });
    if (error || !data?.id) throw new Error(error?.message || "El proveedor no confirmó el envío.");
    const sentAt = new Date().toISOString();
    const { data: saved, error: saveError } = await supabase.from("communications").update({ provider_message_id: data.id, status: "sent", sent_at: sentAt }).eq("id", messageId).select("*").single();
    if (saveError) throw saveError;
    return NextResponse.json({ communication: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible enviar el correo.";
    await supabase.from("communications").update({ status: "failed", error_message: message }).eq("id", messageId);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
