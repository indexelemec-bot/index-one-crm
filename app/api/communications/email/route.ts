import { NextResponse } from "next/server";
import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { z } from "zod";
import { ClientMessageEmail } from "@/emails/client-message";
import { commercialEmailAddress, resolveEmailProvider } from "@/lib/email/provider";
import { loadProposalDeliveryFile } from "@/lib/proposals/load-delivery-file";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const emailSchema = z.object({
  opportunityId: z.string().uuid(), stakeholderId: z.string().uuid(), templateKey: z.string().max(50).optional(),
  proposalId: z.string().uuid().optional(), subject: z.string().trim().min(4).max(180), body: z.string().trim().min(10).max(12000)
});

export async function POST(request: Request) {
  const provider = resolveEmailProvider(process.env);
  if (!provider) return NextResponse.json({ error: "El proveedor de correo todavía no está configurado." }, { status: 503 });
  const parsed = emailSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa el destinatario, asunto y contenido." }, { status: 400 });
  const supabase = await createClient(); if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser(); if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  const { data: opportunity, error: opportunityError } = await supabase.from("opportunities").select("id,account_id,owner_id,accounts(name)").eq("id", parsed.data.opportunityId).single();
  if (opportunityError || !opportunity) return NextResponse.json({ error: "La oportunidad no está disponible para este usuario." }, { status: 403 });
  const { data: stakeholder, error: stakeholderError } = await supabase.from("stakeholders").select("id,full_name,email,account_id").eq("id", parsed.data.stakeholderId).eq("account_id", opportunity.account_id).single();
  if (stakeholderError || !stakeholder?.email) return NextResponse.json({ error: "El contacto seleccionado no tiene un correo válido." }, { status: 400 });
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", authData.user.id).single();
  const clientName = Array.isArray(opportunity.accounts) ? opportunity.accounts[0]?.name : (opportunity.accounts as { name?: string } | null)?.name;
  const messageId = crypto.randomUUID();
  let attachment: Awaited<ReturnType<typeof loadProposalDeliveryFile>> | undefined;
  if (parsed.data.proposalId) {
    try { attachment = await loadProposalDeliveryFile(supabase, parsed.data.proposalId, opportunity.id); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible preparar la propuesta." }, { status: 400 }); }
  }
  const { error: queueError } = await supabase.from("communications").insert({ id: messageId, opportunity_id: opportunity.id, proposal_id: parsed.data.proposalId ?? null, stakeholder_id: stakeholder.id, channel: "email", direction: "outbound", from_address: provider.from, to_address: stakeholder.email, subject: parsed.data.subject, body_text: parsed.data.body, template_key: parsed.data.templateKey ?? null, provider: provider.kind, attachment_format: attachment?.proposal.file_format ?? null, status: "queued", created_by: authData.user.id });
  if (queueError) return NextResponse.json({ error: "No se pudo registrar el correo en el expediente." }, { status: 500 });
  try {
    const email = ClientMessageEmail({ clientName: clientName || "su condominio", recipientName: stakeholder.full_name, body: parsed.data.body, senderName: profile?.full_name || "Equipo Comercial INDEX CONDO", attachmentName: attachment?.file.fileName });
    const attachments = attachment ? [{ filename: attachment.file.fileName, content: Buffer.from(attachment.file.bytes) }] : undefined;
    let providerMessageId: string;

    if (provider.kind === "private_email") {
      const transporter = nodemailer.createTransport({
        host: "mail.privateemail.com",
        port: 465,
        secure: true,
        auth: { user: commercialEmailAddress, pass: process.env.PRIVATE_EMAIL_SMTP_PASSWORD },
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 30_000,
        tls: { minVersion: "TLSv1.2" },
      });
      const result = await transporter.sendMail({ from: provider.from, to: stakeholder.email, subject: parsed.data.subject, replyTo: provider.replyTo, text: parsed.data.body, html: await render(email), attachments });
      providerMessageId = result.messageId;
    } else {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data, error } = await resend.emails.send({ from: provider.from, to: stakeholder.email, subject: parsed.data.subject, replyTo: provider.replyTo, react: email, attachments, tags: [{ name: "opportunity_id", value: opportunity.id }, { name: "communication_id", value: messageId }, ...(parsed.data.proposalId ? [{ name: "proposal_id", value: parsed.data.proposalId }] : [])] });
      if (error || !data?.id) throw new Error(error?.message || "El proveedor no confirmó el envío.");
      providerMessageId = data.id;
    }

    const sentAt = new Date().toISOString();
    const { data: saved, error: saveError } = await supabase.from("communications").update({ provider_message_id: providerMessageId, status: "sent", sent_at: sentAt }).eq("id", messageId).select("*").single();
    if (saveError) throw saveError;
    if (parsed.data.proposalId) await supabase.from("proposals").update({ status: "enviada", sent_at: sentAt }).eq("id", parsed.data.proposalId);
    return NextResponse.json({ communication: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible enviar el correo.";
    await supabase.from("communications").update({ status: "failed", error_message: message }).eq("id", messageId);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
