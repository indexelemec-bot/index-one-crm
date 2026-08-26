import { randomUUID } from "node:crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(10).max(128),
  confirmation: z.string().min(10).max(128)
}).refine((value) => value.password === value.confirmation, {
  message: "Las contraseñas no coinciden.",
  path: ["confirmation"]
});

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((issue) => issue.path.includes("confirmation"));
    return json({ error: mismatch ? "Las contraseñas no coinciden." : "La contraseña debe tener entre 10 y 128 caracteres." }, 400);
  }

  const supabase = await createClient();
  if (!supabase) return json({ error: "Supabase no está configurado." }, 503);

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return json({ error: "Sesión no disponible." }, 401);

  const { data: actor } = await supabase
    .from("profiles")
    .select("role,active,deleted_at")
    .eq("id", authData.user.id)
    .single();

  if (!actor?.active || actor.deleted_at || actor.role !== "superadmin") {
    return json({ error: "Solo el superadministrador puede cambiar contraseñas." }, 403);
  }

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id,full_name,deleted_at")
    .eq("id", parsed.data.userId)
    .maybeSingle();

  if (targetError) return json({ error: "No fue posible validar el usuario seleccionado." }, 500);
  if (!target || target.deleted_at) return json({ error: "El usuario seleccionado no está disponible." }, 404);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return json({ error: "Falta habilitar la administración segura de usuarios." }, 503);

  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: authTarget, error: authTargetError } = await admin.auth.admin.getUserById(target.id);
  if (authTargetError || !authTarget.user) {
    return json({ error: "El usuario seleccionado no tiene una cuenta de acceso válida." }, 404);
  }

  const auditId = randomUUID();
  const { error: auditCreateError } = await admin.from("admin_password_change_audit").insert({
    id: auditId,
    actor_user_id: authData.user.id,
    target_user_id: target.id,
    status: "requested"
  });

  if (auditCreateError) {
    console.error("admin-password:audit-create", auditCreateError);
    return json({ error: "No fue posible registrar la auditoría; la contraseña no fue modificada." }, 500);
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(target.id, {
    password: parsed.data.password
  });

  const completedAt = new Date().toISOString();
  if (updateError) {
    const { error: auditUpdateError } = await admin
      .from("admin_password_change_audit")
      .update({ status: "failed", error_code: updateError.code ?? "auth_update_failed", completed_at: completedAt })
      .eq("id", auditId);
    if (auditUpdateError) console.error("admin-password:audit-failure-update", auditUpdateError);
    console.error("admin-password:update-user", { code: updateError.code, status: updateError.status });
    return json({ error: "Supabase rechazó la nueva contraseña. Verifica los requisitos de seguridad e inténtalo de nuevo." }, 502);
  }

  const { error: auditUpdateError } = await admin
    .from("admin_password_change_audit")
    .update({ status: "succeeded", error_code: null, completed_at: completedAt })
    .eq("id", auditId);

  if (auditUpdateError) {
    console.error("admin-password:audit-success-update", auditUpdateError);
    return json({
      ok: true,
      auditPending: true,
      message: `La contraseña de ${target.full_name} fue actualizada; la auditoría quedó registrada pendiente de cierre.`
    });
  }

  return json({ ok: true, message: `La contraseña de ${target.full_name} fue actualizada correctamente.` });
}
