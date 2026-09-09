import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ conversationId: z.string().uuid() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Conversación inválida." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  const { data: readAt, error } = await supabase.rpc("mark_internal_conversation_read", { target_conversation_id: parsed.data.conversationId });
  if (error || !readAt) return NextResponse.json({ error: error?.message ?? "No fue posible marcar la conversación como leída." }, { status: 500 });
  return NextResponse.json({ ok: true, readAt });
}
