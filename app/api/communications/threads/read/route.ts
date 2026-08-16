import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ threadId: z.string().uuid() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Conversación inválida." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  const { data, error } = await supabase.from("communication_threads")
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.threadId)
    .select("*")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "No fue posible marcar la conversación como leída." }, { status: 500 });
  return NextResponse.json({ thread: data });
}
