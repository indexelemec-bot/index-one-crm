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

  const body = await request.json().catch(() => null) as { threadId?: string; name?: string; mime?: string; size?: number } | null;
  const parsedThread = threadSchema.safeParse(body?.threadId ?? "");
  const name = String(body?.name ?? "").trim();
  const mime = String(body?.mime ?? "").trim();
  const size = Number(body?.size ?? 0);
  if (!parsedThread.success || !name) return NextResponse.json({ error: "Conversación o archivo inválido." }, { status: 400 });
  if (!allowedMimeTypes.has(mime)) return NextResponse.json({ error: "Formato no permitido. Usa PDF, Word, Excel, PNG o JPG." }, { status: 400 });
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) return NextResponse.json({ error: "El archivo debe pesar menos de 15 MB." }, { status: 400 });

  const { data: thread, error: threadError } = await supabase.from("communication_threads").select("id,opportunity_id,stakeholder_id,status").eq("id", parsedThread.data).single();
  if (threadError || !thread || thread.status === "archived") return NextResponse.json({ error: "Conversación no disponible." }, { status: 404 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Falta configurar el almacenamiento seguro." }, { status: 503 });
  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const safeName = sanitizeFileName(name);
  const path = `${thread.opportunity_id}/${thread.id}/${crypto.randomUUID()}-${safeName}`;
  const { data: signed, error: signedError } = await admin.storage.from("communication-files").createSignedUploadUrl(path);
  if (signedError || !signed?.token) return NextResponse.json({ error: signedError?.message || "No fue posible preparar la carga del archivo." }, { status: 500 });

  return NextResponse.json({ attachment: { path, name, mime, size, token: signed.token } });
}
