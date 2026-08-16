import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ opportunityId: z.string().uuid() });

type TimelineItem = {
  kind: "communication" | "activity" | "task" | "proposal" | "assignment" | "scheduled" | "contract";
  id: string;
  at: string;
  data: Record<string, unknown>;
};

export async function GET(request: Request) {
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams).opportunityId);
  if (!parsed.success) return NextResponse.json({ error: "Oportunidad inválida." }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  const { data: opportunity, error: opportunityError } = await supabase
    .from("opportunities")
    .select("id,stage,created_at,updated_at")
    .eq("id", parsed.data.opportunityId)
    .single();
  if (opportunityError || !opportunity) return NextResponse.json({ error: "Oportunidad no disponible." }, { status: 404 });

  const [communicationsResult, activitiesResult, tasksResult, proposalsResult, assignmentsResult, scheduledResult, contractsResult] = await Promise.all([
    supabase.from("communications")
      .select("id,stakeholder_id,channel,direction,subject,body_text,status,agent_name_snapshot,message_type,media_name,transcription_text,transcription_status,created_at,sent_at,delivered_at,opened_at")
      .eq("opportunity_id", opportunity.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("activities")
      .select("id,activity_type,outcome,next_action,due_at,completed_at,created_at")
      .eq("opportunity_id", opportunity.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("tasks")
      .select("id,title,due_at,priority,status,outcome,owner_id,created_at")
      .eq("opportunity_id", opportunity.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("proposals")
      .select("id,version,client_name,issue_date,monthly_fee,status,generated_at,sent_at")
      .eq("opportunity_id", opportunity.id)
      .order("generated_at", { ascending: false })
      .limit(100),
    supabase.from("opportunity_assignment_history")
      .select("id,previous_owner_id,new_owner_id,changed_by,change_reason,changed_at")
      .eq("opportunity_id", opportunity.id)
      .order("changed_at", { ascending: false })
      .limit(100),
    supabase.from("scheduled_communications")
      .select("id,stakeholder_id,channel,body_text,template_key,attachment_name,scheduled_for,recurrence_months,status,last_error,created_at,updated_at")
      .eq("opportunity_id", opportunity.id)
      .order("created_at", { ascending: false })
      .limit(150),
    supabase.from("contracts")
      .select("id,status,client_legal_name,effective_date,signature_date,expiration_date,current_version,created_at,updated_at")
      .eq("opportunity_id", opportunity.id)
      .limit(1)
  ]);

  const results = [communicationsResult, activitiesResult, tasksResult, proposalsResult, assignmentsResult, scheduledResult, contractsResult];
  const failed = results.find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  const timeline: TimelineItem[] = [
    ...(communicationsResult.data ?? []).map((item) => ({
      kind: "communication" as const,
      id: item.id,
      at: item.sent_at ?? item.created_at,
      data: item
    })),
    ...(activitiesResult.data ?? []).map((item) => ({
      kind: "activity" as const,
      id: item.id,
      at: item.completed_at ?? item.created_at,
      data: item
    })),
    ...(tasksResult.data ?? []).map((item) => ({
      kind: "task" as const,
      id: item.id,
      at: item.created_at,
      data: item
    })),
    ...(proposalsResult.data ?? []).map((item) => ({
      kind: "proposal" as const,
      id: item.id,
      at: item.sent_at ?? item.generated_at,
      data: item
    })),
    ...(assignmentsResult.data ?? []).map((item) => ({
      kind: "assignment" as const,
      id: item.id,
      at: item.changed_at,
      data: item
    })),
    ...(scheduledResult.data ?? []).map((item) => ({
      kind: "scheduled" as const,
      id: item.id,
      at: item.created_at,
      data: item
    })),
    ...(contractsResult.data ?? []).map((item) => ({
      kind: "contract" as const,
      id: item.id,
      at: item.updated_at ?? item.created_at,
      data: item
    }))
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return NextResponse.json({
    timeline,
    opportunity: { id: opportunity.id, stage: opportunity.stage, createdAt: opportunity.created_at, updatedAt: opportunity.updated_at },
    meta: {
      total: timeline.length,
      communications: communicationsResult.data?.length ?? 0,
      activities: activitiesResult.data?.length ?? 0,
      tasks: tasksResult.data?.length ?? 0,
      proposals: proposalsResult.data?.length ?? 0,
      assignments: assignmentsResult.data?.length ?? 0,
      scheduled: scheduledResult.data?.length ?? 0,
      contracts: contractsResult.data?.length ?? 0
    }
  });
}
