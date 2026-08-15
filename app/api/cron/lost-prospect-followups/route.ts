import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase no configurado." }, { status: 503 });

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const now = new Date();
  const { data: due, error } = await admin.from("opportunities")
    .select("id,owner_id,next_followup_at,followup_interval_months")
    .eq("stage", "perdida")
    .eq("followup_enabled", true)
    .lte("next_followup_at", now.toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let created = 0;
  for (const opportunity of due ?? []) {
    const interval = Number(opportunity.followup_interval_months || 6);
    const current = new Date(String(opportunity.next_followup_at));
    const next = addMonths(current, interval);
    const { error: taskError } = await admin.from("tasks").insert({
      opportunity_id: opportunity.id,
      title: "Seguimiento semestral a prospecto descartado",
      due_at: next.toISOString(),
      priority: "media",
      status: "pendiente",
      owner_id: opportunity.owner_id
    });
    if (taskError) continue;
    const { error: updateError } = await admin.from("opportunities").update({
      next_followup_at: next.toISOString(),
      next_action: "Seguimiento comercial semestral",
      next_action_at: next.toISOString(),
      updated_at: now.toISOString()
    }).eq("id", opportunity.id);
    if (!updateError) created += 1;
  }

  return NextResponse.json({ ok: true, processed: due?.length ?? 0, created });
}
