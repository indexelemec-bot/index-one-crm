import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";
import { commercialEmailAddress, resolveEmailProvider } from "@/lib/email/provider";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const schema = z.object({ taskId: z.string().uuid() });

function escapeHtml(value: string | null | undefined) {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Tarea inválida." }, { status: 400 });
  const provider = resolveEmailProvider(process.env);
  if (!provider) return NextResponse.json({ error: "Correo no configurado." }, { status: 503 });
  const supabase = await createClient();
  const { data: authData } = await supabase?.auth.getUser() ?? { data: { user: null } };
  if (!supabase || !authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  const { data: task } = await supabase.from("tasks").select("id,title,due_at,priority,owner_id,opportunities(accounts(name))").eq("id", parsed.data.taskId).single();
  if (!task) return NextResponse.json({ error: "Tarea no disponible." }, { status: 404 });
  const { data: assignee } = await supabase.from("profiles").select("full_name,email").eq("id", task.owner_id).single();
  if (!assignee?.email) return NextResponse.json({ error: "El usuario asignado no tiene correo." }, { status: 400 });
  const accountRelation = task.opportunities as unknown as { accounts?: { name?: string } | { name?: string }[] } | null;
  const accountValue = Array.isArray(accountRelation?.accounts) ? accountRelation?.accounts[0] : accountRelation?.accounts;
  const accountName = accountValue?.name ?? "cuenta comercial";
  const due = new Date(task.due_at).toLocaleString("es-DO", { dateStyle: "full", timeStyle: "short", timeZone: "America/Santo_Domingo" });
  const text = `Hola ${assignee.full_name},\n\nSe te asignó una tarea en INDEX CONDO CRM.\n\nCliente: ${accountName}\nTarea: ${task.title}\nVence: ${due}\nPrioridad: ${task.priority}\n\nIngresa al CRM para trabajarla y registrar el resultado.`;
  if (provider.kind !== "private_email") return NextResponse.json({ error: "Las notificaciones internas requieren el correo corporativo configurado." }, { status: 503 });
  const transporter = nodemailer.createTransport({ host: "mail.privateemail.com", port: 465, secure: true, auth: { user: commercialEmailAddress, pass: process.env.PRIVATE_EMAIL_SMTP_PASSWORD }, connectionTimeout: 15_000, socketTimeout: 30_000, tls: { minVersion: "TLSv1.2" } });
  await transporter.sendMail({ from: provider.from, to: assignee.email, replyTo: provider.replyTo, subject: `Nueva tarea CRM · ${accountName}`, text, html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172b4d"><h2 style="color:#08264a">INDEX <span style="color:#f47721">CONDO</span></h2><p>Hola <strong>${escapeHtml(assignee.full_name)}</strong>,</p><p>Se te asignó una nueva tarea comercial:</p><div style="border-left:4px solid #f47721;background:#f7f9fb;padding:14px"><strong>${escapeHtml(task.title)}</strong><br/>Cliente: ${escapeHtml(accountName)}<br/>Vence: ${escapeHtml(due)}<br/>Prioridad: ${escapeHtml(task.priority)}</div><p>Ingresa al CRM para trabajarla y registrar el resultado.</p></div>` });
  return NextResponse.json({ ok: true });
}
