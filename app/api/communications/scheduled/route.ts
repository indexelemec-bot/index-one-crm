import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  threadId: z.string().uuid().optional(),
  opportunityId: z.string().uuid(),
  stakeholderId: z.string().uuid(),
  channel: z.enum(["whatsapp", "email"]),
  body: z.string().trim().min(2).max(12000),
  templateKey: z.string().trim().max(100).optional(),
  attachmentPath: z.string().trim().max(1000).optional(),
  attachmentName: z.string().trim().max(255).optional(),
  scheduledFor: z.string().datetime(),
  recurrenceMonths: z.number().int().positive().max(60).optional()
});

const cancelSchema = z.object({ id: z.string().uuid() });

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa destinatario, fecha y contenido del seguimiento." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  if (new Date(parsed.data.scheduledFor).getTime() <= Date.now()) return NextResponse.json({ error: "La fecha programada debe ser futura." }, { status: 400 });

  const { data: opportunity } = await supabase.from("opportunities").select("id,account_id").eq("id", parsed.data.opportunityId).single();
  if (!opportunity) return NextResponse.json({ error: "La oportunidad no está disponible." }, { status: 403 });
  const { data: stakeholder } = await supabase.from("stakeholders").select("id,account_id").eq("id", parsed.data.stakeholderId).eq("account_id", opportunity.account_id).single();
  if (!stakeholder) return NextResponse.json({ error: "El contacto no pertenece a esta cuenta." }, { status: 400 });

  const { data, error } = await supabase.from("scheduled_communications").insert({
    thread_id: parsed.data.threadId ?? null,
    opportunity_id: opportunity.id,
    stakeholder_id: stakeholder.id,
    channel: parsed.data.channel,
    body_text: parsed.data.body,
    template_key: parsed.data.templateKey ?? null,
    attachment_path: parsed.data.attachmentPath ?? null,
    attachment_name: parsed.data.attachmentName ?? null,
    scheduled_for: parsed.data.scheduledFor,
    recurrence_months: parsed.data.recurrenceMonths ?? null,
    status: "scheduled",
    created_by: authData.user.id
  }).select("*").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "No fue posible programar el mensaje." }, { status: 500 });
  return NextResponse.json({ scheduled: data });
}

export async function DELETE(request: Request) {
  const parsed = cancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Seguimiento inválido." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  const { data, error } = await supabase.from("scheduled_communications").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", parsed.data.id).eq("status", "scheduled").select("*").single();
  if (error || !data) return NextResponse.json({ error: "No fue posible cancelar el seguimiento." }, { status: 500 });
  return NextResponse.json({ scheduled: data });
}
