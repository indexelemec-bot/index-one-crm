import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ communicationId: z.string().uuid() });

export async function GET(request: Request) {
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams).communicationId);
  if (!parsed.success) return NextResponse.json({ error: "Archivo inválido." }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  const { data: communication, error } = await supabase.from("communications")
    .select("id,media_path,message_type")
    .eq("id", parsed.data.communicationId)
    .single();
  if (error || !communication?.media_path) return NextResponse.json({ error: "El mensaje no tiene un archivo disponible." }, { status: 404 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Falta configurar el almacenamiento seguro." }, { status: 503 });
  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: signed, error: signedError } = await admin.storage.from("communication-files").createSignedUrl(String(communication.media_path), 60 * 10);
  if (signedError || !signed?.signedUrl) return NextResponse.json({ error: "No fue posible generar el enlace del archivo." }, { status: 500 });

  return NextResponse.redirect(signed.signedUrl, 302);
}
