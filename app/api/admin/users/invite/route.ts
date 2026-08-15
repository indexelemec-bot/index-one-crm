import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  fullName: z.string().trim().min(3).max(100),
  email: z.string().trim().email().max(180).transform((value) => value.toLowerCase()),
  role: z.enum(["superadmin", "gerencia_comercial", "ejecutivo", "administracion", "consulta"])
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa el nombre, correo y rol." }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  const { data: actor } = await supabase.from("profiles").select("role,active").eq("id", authData.user.id).single();
  if (!actor?.active || actor.role !== "superadmin") {
    return NextResponse.json({ error: "Solo el superadministrador puede invitar usuarios." }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Falta habilitar la administración segura de usuarios." }, { status: 503 });
  }

  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const redirectTo = `${origin}/auth/callback?next=/update-password`;

  // Si el correo pertenece a un usuario archivado, no creamos otra identidad de Auth.
  // Reactivamos el mismo perfil para conservar la trazabilidad histórica y enviamos
  // un correo para que el colaborador defina una nueva contraseña.
  const { data: existingProfile, error: existingProfileError } = await admin
    .from("profiles")
    .select("id,active,deleted_at")
    .eq("email", parsed.data.email)
    .maybeSingle();

  if (existingProfileError) {
    return NextResponse.json({ error: "No fue posible verificar el estado del usuario." }, { status: 500 });
  }

  if (existingProfile) {
    if (!existingProfile.deleted_at) {
      return NextResponse.json({ error: "Ese correo ya tiene una cuenta registrada." }, { status: 409 });
    }

    const { error: restoreError } = await admin
      .from("profiles")
      .update({
        full_name: parsed.data.fullName,
        role: parsed.data.role,
        active: true,
        deleted_at: null,
        reassigned_to: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", existingProfile.id);

    if (restoreError) {
      return NextResponse.json({ error: "No fue posible reactivar la cuenta archivada." }, { status: 500 });
    }

    const { error: resetError } = await admin.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
    if (resetError) {
      // Si no se pudo enviar el correo, volvemos a archivar el perfil para no dejar
      // una cuenta activa sin proceso de recuperación iniciado.
      await admin
        .from("profiles")
        .update({ active: false, deleted_at: new Date().toISOString() })
        .eq("id", existingProfile.id);
      return NextResponse.json({ error: "La cuenta fue encontrada, pero no fue posible enviar el correo de reactivación." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, userId: existingProfile.id, reactivated: true });
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo,
    data: { full_name: parsed.data.fullName, requested_role: parsed.data.role }
  });

  if (error || !data.user) {
    const duplicate = error?.message.toLowerCase().includes("already") || error?.message.toLowerCase().includes("registered");
    return NextResponse.json({
      error: duplicate ? "Ese correo ya tiene una cuenta registrada." : "No fue posible enviar la invitación."
    }, { status: duplicate ? 409 : 502 });
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: data.user.id,
    full_name: parsed.data.fullName,
    email: parsed.data.email,
    role: parsed.data.role,
    active: true,
    deleted_at: null,
    reassigned_to: null
  }, { onConflict: "id" });

  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: "La invitación no pudo asociarse al rol solicitado." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: data.user.id, reactivated: false });
}
