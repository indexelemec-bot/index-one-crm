import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  userId: z.string().uuid(),
  active: z.boolean()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  if (authData.user.id === parsed.data.userId) return NextResponse.json({ error: "No puedes desactivar tu propia cuenta." }, { status: 400 });

  const { data: actor } = await supabase.from("profiles").select("role,active").eq("id", authData.user.id).single();
  if (!actor?.active || actor.role !== "superadmin") return NextResponse.json({ error: "Solo el superadministrador puede cambiar accesos." }, { status: 403 });

  const { error } = await supabase
    .from("profiles")
    .update({ active: parsed.data.active, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.userId);

  if (error) return NextResponse.json({ error: "No fue posible actualizar el acceso." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
