import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";
import { commercialEmailAddress, resolveEmailProvider } from "@/lib/email/provider";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  fullName: z.string().trim().min(3).max(100),
  email: z.string().trim().email().max(180).transform((value) => value.toLowerCase()),
  role: z.enum(["superadmin", "gerencia_comercial", "ejecutivo", "administracion", "consulta"])
});

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendActivationEmail(params: { to: string; fullName: string; actionLink: string; reactivated?: boolean }) {
  const provider = resolveEmailProvider(process.env);
  if (!provider || provider.kind !== "private_email" || !process.env.PRIVATE_EMAIL_SMTP_PASSWORD) {
    throw new Error("Corporate SMTP is not configured");
  }

  const transporter = nodemailer.createTransport({
    host: "mail.privateemail.com",
    port: 465,
    secure: true,
    auth: { user: commercialEmailAddress, pass: process.env.PRIVATE_EMAIL_SMTP_PASSWORD },
    connectionTimeout: 15_000,
    socketTimeout: 30_000,
    tls: { minVersion: "TLSv1.2" }
  });

  const subject = params.reactivated ? "Reactivar acceso · INDEX ONE CRM" : "Activa tu acceso · INDEX ONE CRM";
  const intro = params.reactivated
    ? "Tu acceso a INDEX ONE CRM fue reactivado. Define una nueva contraseña para ingresar."
    : "Has sido invitado a INDEX ONE CRM. Define tu contraseña para activar el acceso.";

  await transporter.sendMail({
    from: provider.from,
    to: params.to,
    replyTo: provider.replyTo,
    subject,
    text: `Hola ${params.fullName},\n\n${intro}\n\nAbre este enlace para definir tu contraseña:\n${params.actionLink}\n\nSi no esperabas este correo, puedes ignorarlo.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172b4d;max-width:620px;margin:auto"><h2 style="color:#08264a">INDEX <span style="color:#f47721">ONE</span></h2><p>Hola <strong>${escapeHtml(params.fullName)}</strong>,</p><p>${escapeHtml(intro)}</p><p style="margin:28px 0"><a href="${escapeHtml(params.actionLink)}" style="display:inline-block;background:#f47721;color:white;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700">Definir contraseña</a></p><p style="color:#64748b;font-size:13px">Si no esperabas este correo, puedes ignorarlo.</p></div>`
  });
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa el nombre, correo y rol." }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  const { data: actor } = await supabase.from("profiles").select("role,active").eq("id", authData.user.id).single();
  if (!actor?.active || actor.role !== "superadmin") {
    return NextResponse.json({ error: "Solo el superadministrador puede invitar usuarios." }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Falta habilitar la administración segura de usuarios." }, { status: 503 });
  }
  if (!process.env.PRIVATE_EMAIL_SMTP_PASSWORD) {
    return NextResponse.json({ error: "El correo corporativo para invitaciones no está configurado." }, { status: 503 });
  }

  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const redirectTo = `${origin}/update-password`;

  let existingAuthUser: { id: string; email?: string | null } | undefined;
  for (let page = 1; page <= 10 && !existingAuthUser; page++) {
    const { data: pageData, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (listError) {
      console.error("invite:list-users", listError);
      return NextResponse.json({ error: "No fue posible verificar el estado del usuario." }, { status: 500 });
    }
    existingAuthUser = pageData.users.find((user) => user.email?.toLowerCase() === parsed.data.email);
    if (pageData.users.length < 100) break;
  }

  if (existingAuthUser) {
    const { data: existingProfile, error: profileLookupError } = await admin
      .from("profiles")
      .select("id,active,deleted_at")
      .eq("id", existingAuthUser.id)
      .maybeSingle();

    if (profileLookupError) {
      console.error("invite:profile-lookup", profileLookupError);
      return NextResponse.json({ error: "No fue posible verificar el perfil del usuario." }, { status: 500 });
    }

    if (existingProfile && !existingProfile.deleted_at) {
      return NextResponse.json({ error: "Ese correo ya tiene una cuenta registrada." }, { status: 409 });
    }

    const { error: restoreError } = await admin.from("profiles").upsert({
      id: existingAuthUser.id,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      role: parsed.data.role,
      active: true,
      deleted_at: null,
      reassigned_to: null,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });

    if (restoreError) {
      console.error("invite:restore-profile", restoreError);
      return NextResponse.json({ error: "No fue posible reactivar la cuenta archivada." }, { status: 500 });
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: parsed.data.email,
      options: { redirectTo }
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("invite:reactivation-link", linkError);
      await admin.from("profiles").update({ active: false, deleted_at: new Date().toISOString() }).eq("id", existingAuthUser.id);
      return NextResponse.json({ error: "La cuenta fue encontrada, pero no fue posible crear el enlace de reactivación." }, { status: 502 });
    }

    try {
      await sendActivationEmail({ to: parsed.data.email, fullName: parsed.data.fullName, actionLink: linkData.properties.action_link, reactivated: true });
    } catch (mailError) {
      console.error("invite:reactivation-smtp", mailError);
      await admin.from("profiles").update({ active: false, deleted_at: new Date().toISOString() }).eq("id", existingAuthUser.id);
      return NextResponse.json({ error: "La cuenta fue encontrada, pero no fue posible enviar el correo de reactivación." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, userId: existingAuthUser.id, reactivated: true });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName, requested_role: parsed.data.role }
  });

  if (createError || !created.user) {
    console.error("invite:create-user", createError);
    const duplicate = createError?.message.toLowerCase().includes("already") || createError?.message.toLowerCase().includes("registered");
    return NextResponse.json({ error: duplicate ? "Ese correo ya tiene una cuenta registrada." : "No fue posible crear el usuario." }, { status: duplicate ? 409 : 502 });
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: created.user.id,
    full_name: parsed.data.fullName,
    email: parsed.data.email,
    role: parsed.data.role,
    active: true,
    deleted_at: null,
    reassigned_to: null
  }, { onConflict: "id" });

  if (profileError) {
    console.error("invite:new-profile", profileError);
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "El usuario no pudo asociarse al rol solicitado." }, { status: 500 });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: parsed.data.email,
    options: { redirectTo }
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("invite:new-user-link", linkError);
    await admin.from("profiles").delete().eq("id", created.user.id);
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "El usuario fue creado, pero no fue posible generar el enlace de activación." }, { status: 502 });
  }

  try {
    await sendActivationEmail({ to: parsed.data.email, fullName: parsed.data.fullName, actionLink: linkData.properties.action_link });
  } catch (mailError) {
    console.error("invite:new-user-smtp", mailError);
    await admin.from("profiles").delete().eq("id", created.user.id);
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "No fue posible enviar el correo de activación." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, userId: created.user.id, reactivated: false });
}
