import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const idSchema = z.string().uuid();
const allowedMimeTypes = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/png", "image/jpeg"]);
const MAX_BYTES = 15 * 1024 * 1024;

function safeFileName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 180) || "archivo";
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const conversationId = String(form?.get("conversationId") ?? "");
  const file = form?.get("file");
  if (!idSchema.safeParse(conversationId).success || !(file instanceof File)) return NextResponse.json({ error: "Conversación o archivo inválido." }, { status: 400 });
  if (!allowedMimeTypes.has(file.type)) return NextResponse.json({ error: "Formato no permitido. Usa PDF, Word, Excel, PNG o JPG." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "El archivo debe pesar menos de 15 MB." }, { status: 400 });
  const { data: conversation } = await supabase.from("internal_conversations").select("id,status").eq("id", conversationId).single();
  if (!conversation || conversation.status === "closed") return NextResponse.json({ error: "Conversación no disponible para adjuntos." }, { status: 404 });
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "Falta configurar el almacenamiento seguro." }, { status: 503 });
  const path = `internal/${conversation.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error } = await admin.storage.from("communication-files").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attachment: { path, name: file.name, mime: file.type, size: file.size } });
}

export async function GET(request: Request) {
  const messageId = new URL(request.url).searchParams.get("messageId") ?? "";
  if (!idSchema.safeParse(messageId).success) return NextResponse.json({ error: "Adjunto inválido." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  const { data: message } = await supabase.from("internal_messages").select("conversation_id,attachment_path,attachment_name").eq("id", messageId).single();
  if (!message?.attachment_path) return NextResponse.json({ error: "Adjunto no disponible." }, { status: 404 });
  if (!message.attachment_path.startsWith(`internal/${message.conversation_id}/`)) return NextResponse.json({ error: "El adjunto no pertenece a esta conversación." }, { status: 403 });
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "Falta configurar el almacenamiento seguro." }, { status: 503 });
  const { data, error } = await admin.storage.from("communication-files").createSignedUrl(message.attachment_path, 60, { download: message.attachment_name ?? "archivo" });
  if (error || !data?.signedUrl) return NextResponse.json({ error: error?.message ?? "No fue posible abrir el adjunto." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
