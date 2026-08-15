import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ userId: z.string().uuid(), reassignToUserId: z.string().uuid() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Selecciona el usuario a eliminar y el usuario receptor." }, { status: 400 });
  if (parsed.data.userId === parsed.data.reassignToUserId) return NextResponse.json({ error: "El usuario receptor debe ser distinto." }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  if (authData.user.id === parsed.data.userId) return NextResponse.json({ error: "No puedes eliminar tu propio usuario." }, { status: 400 });

  const { data: actor } = await supabase.from("profiles").select("role,active,deleted_at").eq("id", authData.user.id).single();
  if (!actor?.active || actor.deleted_at || actor.role !== "superadmin") return NextResponse.json({ error: "Solo el superadministrador puede eliminar usuarios." }, { status: 403 });

  const { data: target } = await supabase.from("profiles").select("id,full_name,deleted_at").eq("id", parsed.data.userId).single();
  if (!target || target.deleted_at) return NextResponse.json({ error: "El usuario ya no está disponible." }, { status: 404 });

  const { data: replacement } = await supabase.from("profiles").select("id,full_name,active,deleted_at").eq("id", parsed.data.reassignToUserId).single();
  if (!replacement?.active || replacement.deleted_at) return NextResponse.json({ error: "El usuario receptor debe estar activo." }, { status: 400 });

  const [{ count: accounts }, { count: opportunities }, { count: tasks }] = await Promise.all([
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("owner_id", parsed.data.userId),
    supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("owner_id", parsed.data.userId),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("owner_id", parsed.data.userId).neq("status", "completada")
  ]);

  const { error } = await supabase.rpc("reassign_and_archive_user", { target_user: parsed.data.userId, replacement_user: parsed.data.reassignToUserId });
  if (error) return NextResponse.json({ error: error.message || "No fue posible eliminar y reasignar el usuario." }, { status: 500 });

  return NextResponse.json({ ok: true, reassigned: { accounts: accounts ?? 0, opportunities: opportunities ?? 0, tasks: tasks ?? 0 }, targetName: target.full_name, replacementName: replacement.full_name });
}
