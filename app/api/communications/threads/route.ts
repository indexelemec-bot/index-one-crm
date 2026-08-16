import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  opportunityId: z.string().uuid(),
  stakeholderId: z.string().uuid(),
  channel: z.enum(["whatsapp", "email"]).default("whatsapp"),
  assignedTo: z.string().uuid().optional()
});

const updateSchema = z.object({
  threadId: z.string().uuid(),
  assignedTo: z.string().uuid().nullable().optional(),
  status: z.enum(["open", "pending", "closed", "archived"]).optional(),
  reason: z.string().trim().max(500).optional()
});

async function currentProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("id,role,active,deleted_at").eq("id", userId).single();
  return data;
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa oportunidad, contacto y canal." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  const profile = await currentProfile(supabase, authData.user.id);
  if (!profile?.active || profile.deleted_at) return NextResponse.json({ error: "Usuario no habilitado." }, { status: 403 });

  const { data: opportunity, error: opportunityError } = await supabase.from("opportunities").select("id,account_id,owner_id").eq("id", parsed.data.opportunityId).single();
  if (opportunityError || !opportunity) return NextResponse.json({ error: "La oportunidad no está disponible." }, { status: 403 });
  const { data: stakeholder } = await supabase.from("stakeholders").select("id,account_id").eq("id", parsed.data.stakeholderId).eq("account_id", opportunity.account_id).single();
  if (!stakeholder) return NextResponse.json({ error: "El contacto no pertenece a esta cuenta." }, { status: 400 });

  const { data: existing } = await supabase.from("communication_threads").select("*").eq("opportunity_id", opportunity.id).eq("stakeholder_id", stakeholder.id).eq("channel", parsed.data.channel).maybeSingle();
  if (existing) return NextResponse.json({ thread: existing, created: false });

  const canReassign = profile.role === "superadmin" || profile.role === "gerencia_comercial";
  if (parsed.data.assignedTo && parsed.data.assignedTo !== opportunity.owner_id && !canReassign) {
    return NextResponse.json({ error: "Solo gerencia comercial puede asignar la conversación a otro agente." }, { status: 403 });
  }
  const assignedTo = parsed.data.assignedTo ?? opportunity.owner_id ?? authData.user.id;
  const { data: target } = await supabase.from("profiles").select("id,active,deleted_at").eq("id", assignedTo).single();
  if (!target?.active || target.deleted_at) return NextResponse.json({ error: "El agente seleccionado no está disponible." }, { status: 400 });

  const { data: thread, error } = await supabase.from("communication_threads").insert({
    opportunity_id: opportunity.id,
    stakeholder_id: stakeholder.id,
    channel: parsed.data.channel,
    assigned_to: assignedTo,
    status: "open"
  }).select("*").single();
  if (error || !thread) return NextResponse.json({ error: error?.message ?? "No fue posible crear la conversación." }, { status: 500 });
  return NextResponse.json({ thread, created: true });
}

export async function PATCH(request: Request) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa los datos de asignación." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  const profile = await currentProfile(supabase, authData.user.id);
  if (!profile?.active || profile.deleted_at) return NextResponse.json({ error: "Usuario no habilitado." }, { status: 403 });

  const { data: current, error: currentError } = await supabase.from("communication_threads").select("*").eq("id", parsed.data.threadId).single();
  if (currentError || !current) return NextResponse.json({ error: "Conversación no disponible." }, { status: 404 });

  const assignmentChanged = parsed.data.assignedTo !== undefined && parsed.data.assignedTo !== current.assigned_to;
  const canReassign = profile.role === "superadmin" || profile.role === "gerencia_comercial";
  if (assignmentChanged && !canReassign) return NextResponse.json({ error: "Solo gerencia comercial puede reasignar conversaciones." }, { status: 403 });

  if (assignmentChanged && parsed.data.assignedTo) {
    const { data: target } = await supabase.from("profiles").select("id,active,deleted_at").eq("id", parsed.data.assignedTo).single();
    if (!target?.active || target.deleted_at) return NextResponse.json({ error: "El agente seleccionado no está disponible." }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.assignedTo !== undefined) patch.assigned_to = parsed.data.assignedTo;
  if (parsed.data.status) patch.status = parsed.data.status;
  const { data: thread, error } = await supabase.from("communication_threads").update(patch).eq("id", current.id).select("*").single();
  if (error || !thread) return NextResponse.json({ error: error?.message ?? "No fue posible actualizar la conversación." }, { status: 500 });

  if (assignmentChanged) {
    const { error: historyError } = await supabase.from("communication_assignment_history").insert({
      thread_id: current.id,
      previous_agent_id: current.assigned_to,
      new_agent_id: parsed.data.assignedTo,
      changed_by: authData.user.id,
      reason: parsed.data.reason ?? "Reasignación desde Centro de Comunicaciones"
    });
    if (historyError) return NextResponse.json({ error: "La conversación fue actualizada, pero no se pudo registrar el historial de asignación." }, { status: 500 });
  }
  return NextResponse.json({ thread });
}
