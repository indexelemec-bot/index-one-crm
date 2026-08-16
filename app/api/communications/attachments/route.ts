import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const threadSchema = z.string().uuid();
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg"
]);
const MAX_BYTES = 15 * 1024 * 1024;

function sanitizeFileName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 180) || "archivo";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "No fue posible leer el archivo." }, { status: 400 });
  const threadId = String(form.get("threadId") ?? "");
  const parsedThread = threadSchema.safeParse(threadId);
  const file = form.get("file");
  if (!parsedThread.success || !(file instanceof File)) return NextResponse.json({ error: "Conversación o archivo inválido." }, { status: 400 });
  if (!allowedMimeTypes.has(file.type)) return NextResponse.json({ error: "Formato no permitido. Usa PDF, Word, Excel, PNG o JPG." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "El archivo debe pesar menos de 15 MB." }, { status: 400 });

  const { data: thread, error: threadError } = await supabase.from("communication_threads").select("id,opportunity_id,stakeholder_id,status").eq("id", parsedThread.data).single();
  if (threadError || !thread || thread.status === "archived") return NextResponse.json({ error: "Conversación no disponible." }, { status: 404 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Falta configurar el almacenamiento seguro." }, { status: 503 });
  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const safeName = sanitizeFileName(file.name);
  const path = `${thread.opportunity_id}/${thread.id}/${crypto.randomUUID()}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from("communication-files").upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message || "No fue posible guardar el archivo." }, { status: 500 });

  return NextResponse.json({ attachment: { path, name: file.name, mime: file.type, size: file.size } });
}
