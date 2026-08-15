import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(3).max(100)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa el nombre del usuario." }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  const { data: actor } = await supabase.from("profiles").select("role,active").eq("id", authData.user.id).single();
  const canEditSelf = authData.user.id === parsed.data.userId;
  const canManageOthers = actor?.active && actor.role === "superadmin";
  if (!actor?.active || (!canEditSelf && !canManageOthers)) return NextResponse.json({ error: "No tienes permiso para editar este perfil." }, { status: 403 });

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName.replace(/\s+/g, " "), updated_at: new Date().toISOString() })
    .eq("id", parsed.data.userId);

  if (error) return NextResponse.json({ error: "No fue posible actualizar el nombre." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
