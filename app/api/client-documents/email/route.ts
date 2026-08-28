import { render } from "@react-email/render";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { z } from "zod";
import { ClientMessageEmail } from "@/emails/client-message";
import { commercialEmailAddress, resolveEmailProvider } from "@/lib/email/provider";
import { loadClientDocumentFile } from "@/lib/client-documents/load-file";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  documentId: z.string().uuid(), stakeholderId: z.string().uuid(),
  subject: z.string().trim().min(4).max(180), body: z.string().trim().min(10).max(12000)
});

export async function POST(request: Request) {
  const provider = resolveEmailProvider(process.env);
  if (!provider) return NextResponse.json({ error: "El proveedor de correo todavía no está configurado." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa el destinatario, asunto y mensaje." }, { status: 400 });
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
  const { data: stakeholder } = await supabase.from("stakeholders").select("id,full_name,email,account_id").eq("id", parsed.data.stakeholderId).eq("account_id", opportunity.account_id).single();
  if (!stakeholder?.email) return NextResponse.json({ error: "El contacto seleccionado no tiene correo válido." }, { status: 400 });
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", authData.user.id).single();

  const communicationId = crypto.randomUUID();
  const { error: queueError } = await supabase.from("communications").insert({
    id: communicationId, opportunity_id: opportunityId, client_document_id: delivery.document.id,
    stakeholder_id: stakeholder.id, channel: "email", direction: "outbound", from_address: provider.from,
    to_address: stakeholder.email, subject: parsed.data.subject, body_text: parsed.data.body,
    template_key: delivery.document.template_key, provider: provider.kind, attachment_format: "pdf",
    status: "queued", created_by: authData.user.id
  });
  if (queueError) return NextResponse.json({ error: "No se pudo registrar el correo en el expediente." }, { status: 500 });

  try {
    const email = ClientMessageEmail({
      clientName: delivery.snapshot.clientName, recipientName: stakeholder.full_name, body: parsed.data.body,
      senderName: profile?.full_name || "Equipo INDEX CONDO", attachmentName: delivery.file.fileName
    });
    const attachments = [{ filename: delivery.file.fileName, content: Buffer.from(delivery.file.bytes) }];
    let providerMessageId: string;
    if (provider.kind === "private_email") {
      const transporter = nodemailer.createTransport({
        host: "mail.privateemail.com", port: 465, secure: true,
        auth: { user: commercialEmailAddress, pass: process.env.PRIVATE_EMAIL_SMTP_PASSWORD },
        connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000, tls: { minVersion: "TLSv1.2" }
      });
      const result = await transporter.sendMail({ from: provider.from, to: stakeholder.email, subject: parsed.data.subject, replyTo: provider.replyTo, text: parsed.data.body, html: await render(email), attachments });
      providerMessageId = result.messageId;
    } else {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data, error } = await resend.emails.send({
        from: provider.from, to: stakeholder.email, subject: parsed.data.subject, replyTo: provider.replyTo,
        react: email, attachments,
        tags: [{ name: "opportunity_id", value: opportunityId }, { name: "communication_id", value: communicationId }, { name: "client_document_id", value: delivery.document.id }]
      });
      if (error || !data?.id) throw new Error(error?.message || "El proveedor no confirmó el envío.");
      providerMessageId = data.id;
    }
    const sentAt = new Date().toISOString();
    const { data: communication, error: saveError } = await supabase.from("communications").update({ provider_message_id: providerMessageId, status: "sent", sent_at: sentAt }).eq("id", communicationId).select("*").single();
    if (saveError) throw saveError;
    await supabase.from("client_documents").update({ status: "sent", sent_at: sentAt }).eq("id", delivery.document.id);
    return NextResponse.json({ communication });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible enviar el correo.";
    await supabase.from("communications").update({ status: "failed", error_message: message }).eq("id", communicationId);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
