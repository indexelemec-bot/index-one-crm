import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";
import { commercialEmailAddress, resolveEmailProvider } from "@/lib/email/provider";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email().max(180).transform((value) => value.toLowerCase())
});

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribe un correo electrónico válido." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const provider = resolveEmailProvider(process.env);

  if (!supabaseUrl || !serviceKey) {
    console.error("recover: Supabase admin credentials missing");
    return NextResponse.json({ error: "La recuperación de contraseña no está configurada." }, { status: 503 });
  }
  if (!provider || provider.kind !== "private_email" || !process.env.PRIVATE_EMAIL_SMTP_PASSWORD) {
    console.error("recover: corporate SMTP not configured");
    return NextResponse.json({ error: "El correo de recuperación no está configurado." }, { status: 503 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const redirectTo = `${origin}/update-password`;
  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Generate the Supabase recovery link without asking Supabase to send the email.
  // INDEX ONE sends it through the already-configured corporate SMTP instead.
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: parsed.data.email,
    options: { redirectTo }
  });

  if (error || !data?.properties?.action_link) {
    // Do not reveal whether an address exists in Auth. This also avoids account enumeration.
    console.warn("recover:generate-link", {
      emailDomain: parsed.data.email.split("@")[1],
      status: error?.status,
      code: error?.code,
      message: error?.message
    });
    return NextResponse.json({ ok: true });
  }

  const actionLink = data.properties.action_link;
  const displayName = String(data.user?.user_metadata?.full_name || parsed.data.email.split("@")[0]);
  const transporter = nodemailer.createTransport({
    host: "mail.privateemail.com",
    port: 465,
    secure: true,
    auth: {
      user: commercialEmailAddress,
      pass: process.env.PRIVATE_EMAIL_SMTP_PASSWORD
    },
    connectionTimeout: 15_000,
    socketTimeout: 30_000,
    tls: { minVersion: "TLSv1.2" }
  });

  try {
    await transporter.sendMail({
      from: provider.from,
      to: parsed.data.email,
      replyTo: provider.replyTo,
      subject: "Recuperar contraseña · INDEX ONE CRM",
      text: `Hola ${displayName},\n\nRecibimos una solicitud para restablecer tu contraseña de INDEX ONE CRM.\n\nAbre este enlace para definir una nueva contraseña:\n${actionLink}\n\nSi no solicitaste este cambio, puedes ignorar este correo.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172b4d;max-width:620px;margin:auto"><h2 style="color:#08264a">INDEX <span style="color:#f47721">ONE</span></h2><p>Hola <strong>${escapeHtml(displayName)}</strong>,</p><p>Recibimos una solicitud para restablecer tu contraseña de INDEX ONE CRM.</p><p style="margin:28px 0"><a href="${escapeHtml(actionLink)}" style="display:inline-block;background:#f47721;color:white;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700">Crear nueva contraseña</a></p><p style="color:#64748b;font-size:13px">Si no solicitaste este cambio, puedes ignorar este correo.</p></div>`
    });
  } catch (mailError) {
    console.error("recover:smtp", mailError);
    return NextResponse.json({ error: "No pudimos enviar el correo de recuperación. Inténtalo nuevamente." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
