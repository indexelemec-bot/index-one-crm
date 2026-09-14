import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildWeeklyReport } from "@/lib/weekly-report";
import type { OpportunityStage, ProjectType } from "@/types/domain";

export const dynamic = "force-dynamic";

const stageValues = [
  "prospecto_identificado", "problema_detectado", "contacto_decisor", "diagnostico", "solucion_recomendada",
  "presentacion", "propuesta", "propuesta_enviada", "negociacion", "aprobacion", "contrato_transicion", "cliente_activo", "perdida"
] as const;

const querySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  seller: z.string().uuid().optional(),
  projectType: z.enum(["comercial", "residencial"]).optional(),
  source: z.string().trim().min(1).max(120).optional(),
  stage: z.enum(stageValues).optional(),
  status: z.enum(["active", "won", "lost"]).optional()
});

const settingsSchema = z.object({
  neverContactedBusinessDays: z.number().int().min(0).max(30),
  inactiveDays: z.number().int().min(1).max(365),
  proposalFollowupDays: z.number().int().min(1).max(90)
});

const startOfDay = (date: string) => new Date(`${date}T00:00:00-04:00`);
const endExclusive = (date: string) => {
  const result = startOfDay(date);
  result.setDate(result.getDate() + 1);
  return result;
};

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse({
    start: params.start,
    end: params.end,
    seller: params.seller || undefined,
    projectType: params.projectType || undefined,
    source: params.source || undefined,
    stage: params.stage || undefined,
    status: params.status || undefined
  });
  if (!parsed.success) return NextResponse.json({ error: "Los filtros del reporte no son válidos." }, { status: 400 });

  const from = startOfDay(parsed.data.start);
  const until = endExclusive(parsed.data.end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime()) || from >= until) {
    return NextResponse.json({ error: "El rango de fechas no es válido." }, { status: 400 });
  }
  if (until.getTime() - from.getTime() > 93 * 86_400_000) {
    return NextResponse.json({ error: "El reporte admite un rango máximo de 93 días." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role,active,deleted_at")
    .eq("id", authData.user.id)
    .single();
  if (profileError || !profile?.active || profile.deleted_at) return NextResponse.json({ error: "Acceso no disponible." }, { status: 403 });

  const manager = ["superadmin", "gerencia_comercial", "administracion", "consulta"].includes(profile.role);
  const requestedSeller = manager ? parsed.data.seller : authData.user.id;
  const limit = 10_000;
  const [settingsResult, accountsResult, opportunitiesResult, activitiesResult, tasksResult, proposalsResult, communicationsResult, salesResult, stageHistoryResult, profilesResult] = await Promise.all([
    supabase.from("commercial_report_settings").select("*").eq("setting_key", "default").single(),
    supabase.from("accounts").select("id,name,owner_id,source,project_type,residential_subtype,created_at").limit(limit),
    supabase.from("opportunities").select("id,account_id,owner_id,stage,next_action,next_action_at,monthly_fee,created_at,updated_at").limit(limit),
    supabase.from("activities").select("opportunity_id,activity_type,due_at,completed_at,created_at").limit(limit),
    supabase.from("tasks").select("opportunity_id,owner_id,status,due_at,created_at").limit(limit),
    supabase.from("proposals").select("opportunity_id,status,generated_at,sent_at").limit(limit),
    supabase.from("communications").select("opportunity_id,created_at,sent_at").limit(limit),
    supabase.from("sales_reports").select("opportunity_id,seller_id,closed_at,final_fee").limit(limit),
    supabase.from("opportunity_stage_history").select("id,opportunity_id,previous_stage,new_stage,moved_by,owner_id_snapshot,moved_at,previous_stage_duration_seconds,change_note").limit(limit),
    supabase.from("profiles").select("id,full_name,role,active").eq("active", true).limit(limit)
  ]);

  const results = [settingsResult, accountsResult, opportunitiesResult, activitiesResult, tasksResult, proposalsResult, communicationsResult, salesResult, stageHistoryResult, profilesResult];
  const failure = results.find((result) => result.error);
  if (failure?.error) {
    console.error("weekly-report:query", { code: failure.error.code, details: failure.error.details });
    return NextResponse.json({ error: "No fue posible preparar el reporte semanal." }, { status: 500 });
  }

  const settingsRow = settingsResult.data;
  const report = buildWeeklyReport({
    filters: {
      start: from.toISOString(),
      endExclusive: until.toISOString(),
      sellerId: requestedSeller,
      projectType: parsed.data.projectType as ProjectType | undefined,
      source: parsed.data.source,
      stage: parsed.data.stage as OpportunityStage | undefined,
      status: parsed.data.status
    },
    settings: {
      neverContactedBusinessDays: settingsRow.never_contacted_business_days,
      inactiveDays: settingsRow.inactive_days,
      proposalFollowupDays: settingsRow.proposal_followup_days
    },
    accounts: accountsResult.data ?? [],
    opportunities: opportunitiesResult.data ?? [],
    activities: activitiesResult.data ?? [],
    tasks: tasksResult.data ?? [],
    proposals: proposalsResult.data ?? [],
    communications: communicationsResult.data ?? [],
    sales: salesResult.data ?? [],
    stageHistory: stageHistoryResult.data ?? [],
    profiles: profilesResult.data ?? []
  });

  return NextResponse.json({ report, scope: manager ? "management" : "seller" }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Los umbrales no son válidos." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role,active,deleted_at").eq("id", authData.user.id).single();
  if (!profile?.active || profile.deleted_at || !["superadmin", "gerencia_comercial"].includes(profile.role)) {
    return NextResponse.json({ error: "Solo gerencia comercial puede cambiar estos umbrales." }, { status: 403 });
  }
  const { error } = await supabase.from("commercial_report_settings").update({
    never_contacted_business_days: parsed.data.neverContactedBusinessDays,
    inactive_days: parsed.data.inactiveDays,
    proposal_followup_days: parsed.data.proposalFollowupDays,
    updated_by: authData.user.id,
    updated_at: new Date().toISOString()
  }).eq("setting_key", "default");
  if (error) {
    console.error("weekly-report:settings", { code: error.code, details: error.details });
    return NextResponse.json({ error: "No fue posible guardar los umbrales." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
