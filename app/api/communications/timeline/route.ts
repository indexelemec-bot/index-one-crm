import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ opportunityId: z.string().uuid() });

export async function GET(request: Request) {
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams).opportunityId);
  if (!parsed.success) return NextResponse.json({ error: "Oportunidad inválida." }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  const { data: opportunity, error: opportunityError } = await supabase.from("opportunities").select("id").eq("id", parsed.data.opportunityId).single();
  if (opportunityError || !opportunity) return NextResponse.json({ error: "Oportunidad no disponible." }, { status: 404 });

  const [communicationsResult, activitiesResult] = await Promise.all([
    supabase.from("communications")
      .select("id,stakeholder_id,channel,direction,body_text,status,agent_name_snapshot,message_type,media_name,transcription_text,transcription_status,created_at,sent_at,delivered_at,opened_at")
      .eq("opportunity_id", opportunity.id)
      .order("created_at", { ascending: false })
      .limit(150),
    supabase.from("activities")
      .select("id,activity_type,outcome,next_action,due_at,completed_at,created_at")
      .eq("opportunity_id", opportunity.id)
      .order("created_at", { ascending: false })
      .limit(150)
  ]);

  if (communicationsResult.error) return NextResponse.json({ error: communicationsResult.error.message }, { status: 500 });
  if (activitiesResult.error) return NextResponse.json({ error: activitiesResult.error.message }, { status: 500 });

  const communications = (communicationsResult.data ?? []).map((item) => ({
    kind: "communication" as const,
    id: item.id,
    at: item.sent_at ?? item.created_at,
    data: item
  }));
  const activities = (activitiesResult.data ?? []).map((item) => ({
    kind: "activity" as const,
    id: item.id,
    at: item.completed_at ?? item.created_at,
    data: item
  }));

  const timeline = [...communications, ...activities].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return NextResponse.json({ timeline });
}
