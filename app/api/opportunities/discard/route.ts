import { NextResponse } from "next/server";
import { z } from "zod";
import { buildDiscardUpdate } from "@/lib/discard-prospect";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  opportunityId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
  followupMode: z.enum(["six_months", "none"]).default("six_months")
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Indica un motivo válido para descartar el prospecto." }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  const { data: actor } = await supabase.from("profiles").select("role,active,deleted_at").eq("id", authData.user.id).single();
  if (!actor?.active || actor.deleted_at || !["superadmin", "gerencia_comercial", "ejecutivo"].includes(actor.role)) return NextResponse.json({ error: "No tienes permiso para descartar prospectos." }, { status: 403 });

  const { data: opportunity } = await supabase.from("opportunities").select("id,account_id,owner_id,stage").eq("id", parsed.data.opportunityId).single();
  if (!opportunity) return NextResponse.json({ error: "Oportunidad no encontrada." }, { status: 404 });
  if (actor.role === "ejecutivo" && opportunity.owner_id !== authData.user.id) return NextResponse.json({ error: "Solo puedes descartar oportunidades de tu cartera." }, { status: 403 });

  const now = new Date();
  const discard = buildDiscardUpdate(now, parsed.data.reason, parsed.data.followupMode);
  const { error: updateError } = await supabase.from("opportunities").update(discard.update).eq("id", opportunity.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (parsed.data.followupMode === "none") {
    const { error: taskError } = await supabase.from("tasks").update({
      status: "completada",
      outcome: "Cancelada automáticamente: prospecto descartado sin seguimiento."
    }).eq("opportunity_id", opportunity.id).neq("status", "completada");
    if (taskError) return NextResponse.json({ error: "El prospecto fue descartado sin seguimiento, pero no se pudieron cerrar sus tareas pendientes." }, { status: 500 });

    return NextResponse.json({ ok: true, followupMode: "none", nextFollowupAt: null });
  }

  const { error: taskError } = await supabase.from("tasks").insert({
    opportunity_id: opportunity.id,
    title: "Seguimiento semestral a prospecto descartado",
    due_at: discard.nextFollowupAt,
    priority: "media",
    status: "pendiente",
    owner_id: opportunity.owner_id
  });
  if (taskError) return NextResponse.json({ error: "El prospecto fue descartado, pero no se pudo agendar el seguimiento." }, { status: 500 });

  return NextResponse.json({ ok: true, followupMode: "six_months", nextFollowupAt: discard.nextFollowupAt });
}
