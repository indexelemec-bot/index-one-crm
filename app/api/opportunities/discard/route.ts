import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ opportunityId: z.string().uuid(), reason: z.string().trim().min(3).max(500) });

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
}

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
  const next = addMonths(now, 6);
  const { error: updateError } = await supabase.from("opportunities").update({
    stage: "perdida",
    lost_reason: parsed.data.reason,
    followup_enabled: true,
    followup_interval_months: 6,
    next_followup_at: next.toISOString(),
    next_action: "Seguimiento comercial semestral",
    next_action_at: next.toISOString(),
    probability: 0,
    updated_at: now.toISOString()
  }).eq("id", opportunity.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { error: taskError } = await supabase.from("tasks").insert({
    opportunity_id: opportunity.id,
    title: "Seguimiento semestral a prospecto descartado",
    due_at: next.toISOString(),
    priority: "media",
    status: "pendiente",
    owner_id: opportunity.owner_id
  });
  if (taskError) return NextResponse.json({ error: "El prospecto fue descartado, pero no se pudo agendar el seguimiento." }, { status: 500 });

  return NextResponse.json({ ok: true, nextFollowupAt: next.toISOString() });
}
