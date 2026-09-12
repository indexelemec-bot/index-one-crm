import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  messageId: z.string().uuid(),
  title: z.string().trim().min(2).max(240),
  opportunityId: z.string().uuid().optional(),
  ownerId: z.string().uuid(),
  dueAt: z.string().datetime(),
  priority: z.enum(["alta", "media", "baja"]).default("media")
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisa la tarea." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("id,role,active,deleted_at").eq("id", auth.user.id).single();
  if (!profile?.active || profile.deleted_at) return NextResponse.json({ error: "Usuario no habilitado." }, { status: 403 });
  const { data: message } = await supabase.from("internal_messages").select("id,conversation_id,internal_conversations(opportunity_id)").eq("id", parsed.data.messageId).single();
  if (!message) return NextResponse.json({ error: "Mensaje interno no disponible." }, { status: 404 });
  const relation = message.internal_conversations as unknown as { opportunity_id?: string } | { opportunity_id?: string }[] | null;
  const linkedOpportunityId = (Array.isArray(relation) ? relation[0] : relation)?.opportunity_id;
  const opportunityId = parsed.data.opportunityId ?? linkedOpportunityId;
  if (!opportunityId) return NextResponse.json({ error: "Selecciona un prospecto para crear la tarea." }, { status: 400 });
  const { data: opportunity } = await supabase.from("opportunities").select("id").eq("id", opportunityId).single();
  if (!opportunity) return NextResponse.json({ error: "Prospecto no disponible." }, { status: 403 });
  const { data: owner } = await supabase.from("profiles").select("id,active,deleted_at").eq("id", parsed.data.ownerId).single();
  if (!owner?.active || owner.deleted_at) return NextResponse.json({ error: "Responsable no disponible." }, { status: 400 });
  if (owner.id !== auth.user.id && profile.role !== "superadmin" && profile.role !== "gerencia_comercial") {
    return NextResponse.json({ error: "Solo gerencia comercial puede asignar la tarea a otra persona." }, { status: 403 });
  }
  const { data: task, error } = await supabase.from("tasks").insert({ opportunity_id: opportunityId, title: parsed.data.title, due_at: parsed.data.dueAt, priority: parsed.data.priority, status: "pendiente", owner_id: parsed.data.ownerId, source_internal_message_id: message.id }).select("*").single();
  if (error || !task) return NextResponse.json({ error: error?.code === "23505" ? "Este mensaje ya fue convertido en tarea." : error?.message ?? "No fue posible crear la tarea." }, { status: error?.code === "23505" ? 409 : 500 });
  return NextResponse.json({ task }, { status: 201 });
}
