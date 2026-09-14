import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ proposalId: z.string().uuid(), status: z.literal("enviada") });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "La propuesta indicada no es válida." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  const sentAt = new Date().toISOString();
  const { data, error } = await supabase.from("proposals")
    .update({ status: parsed.data.status, sent_at: sentAt })
    .eq("id", parsed.data.proposalId)
    .select("id,opportunity_id,status,sent_at")
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "No tienes permiso para actualizar esta propuesta." }, { status: 403 });
  return NextResponse.json({ proposal: data });
}
