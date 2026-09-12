import { NextResponse } from "next/server";
import { z } from "zod";
import { mapInternalConversation } from "@/lib/internal-messaging";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  title: z.string().trim().min(2).max(160),
  conversationType: z.enum(["direct", "group"]),
  opportunityId: z.string().uuid().optional(),
  responsibleId: z.string().uuid(),
  memberIds: z.array(z.string().uuid()).min(1).max(50),
  observerIds: z.array(z.string().uuid()).max(50).default([]),
  priority: z.enum(["normal", "important", "urgent"]).default("normal")
});

const updateSchema = z.object({
  conversationId: z.string().uuid(),
  title: z.string().trim().min(2).max(160).optional(),
  status: z.enum(["open", "pending", "waiting_client", "waiting_internal", "closed"]).optional(),
  priority: z.enum(["normal", "important", "urgent"]).optional(),
  responsibleId: z.string().uuid().optional(),
  reason: z.string().trim().min(3).max(500).optional(),
  note: z.string().trim().max(1000).optional(),
  addMembers: z.array(z.object({ userId: z.string().uuid(), role: z.enum(["member", "observer"]) })).max(50).optional(),
  removeMemberIds: z.array(z.string().uuid()).max(50).optional()
}).superRefine((value, ctx) => {
  if (value.responsibleId && !value.reason) ctx.addIssue({ code: "custom", path: ["reason"], message: "El motivo es obligatorio al reasignar." });
});

async function session() {
  const supabase = await createClient();
  if (!supabase) return { error: NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 }) };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: NextResponse.json({ error: "Sesión no disponible." }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("id,role,active,deleted_at").eq("id", data.user.id).single();
  if (!profile?.active || profile.deleted_at) return { error: NextResponse.json({ error: "Usuario no habilitado." }, { status: 403 }) };
  return { supabase, user: data.user, profile };
}

export async function GET() {
  const auth = await session();
  if (auth.error || !auth.supabase || !auth.user) return auth.error;
  const [conversationResult, notificationResult] = await Promise.all([
    auth.supabase.from("internal_conversations").select("*,internal_conversation_members(user_id,member_role,joined_at,removed_at,last_read_at)").order("updated_at", { ascending: false }),
    auth.supabase.from("internal_notifications").select("conversation_id,recipient_id,notification_type,read_at").is("read_at", null)
  ]);
  if (conversationResult.error || notificationResult.error) return NextResponse.json({ error: conversationResult.error?.message ?? notificationResult.error?.message }, { status: 500 });
  const unreadByConversation = new Map<string, typeof notificationResult.data>();
  for (const notification of notificationResult.data ?? []) {
    const items = unreadByConversation.get(notification.conversation_id) ?? [];
    items.push(notification); unreadByConversation.set(notification.conversation_id, items);
  }
  return NextResponse.json({ conversations: (conversationResult.data ?? []).map((row) => mapInternalConversation({ ...row, internal_notifications: unreadByConversation.get(row.id) ?? [] }, auth.user!.id)) });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisa la nueva conversación." }, { status: 400 });
  const auth = await session();
  if (auth.error || !auth.supabase || !auth.user) return auth.error;
  const uniqueMemberIds = [...new Set([auth.user.id, parsed.data.responsibleId, ...parsed.data.memberIds, ...parsed.data.observerIds])];
  if (parsed.data.conversationType === "direct" && uniqueMemberIds.length !== 2) {
    return NextResponse.json({ error: "Una conversación 1:1 debe tener exactamente dos participantes." }, { status: 400 });
  }
  const { data: profiles } = await auth.supabase.from("profiles").select("id,active,deleted_at").in("id", uniqueMemberIds);
  if ((profiles ?? []).filter((profile) => profile.active && !profile.deleted_at).length !== uniqueMemberIds.length) {
    return NextResponse.json({ error: "Uno o más participantes no están disponibles." }, { status: 400 });
  }
  if (parsed.data.opportunityId) {
    const { data: opportunity } = await auth.supabase.from("opportunities").select("id").eq("id", parsed.data.opportunityId).single();
    if (!opportunity) return NextResponse.json({ error: "El prospecto vinculado no está disponible." }, { status: 403 });
  }
  const { data: conversationId, error } = await auth.supabase.rpc("create_internal_conversation", {
    conversation_title: parsed.data.title,
    conversation_kind: parsed.data.conversationType,
    linked_opportunity_id: parsed.data.opportunityId ?? null,
    initial_responsible_id: parsed.data.responsibleId,
    participant_ids: parsed.data.memberIds,
    observer_ids: parsed.data.observerIds,
    conversation_priority: parsed.data.priority
  });
  if (error || !conversationId) return NextResponse.json({ error: error?.message ?? "No fue posible crear la conversación." }, { status: 500 });
  return NextResponse.json({ conversationId }, { status: 201 });
}

export async function PATCH(request: Request) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisa los cambios." }, { status: 400 });
  const auth = await session();
  if (auth.error || !auth.supabase || !auth.user) return auth.error;
  const { data: current } = await auth.supabase.from("internal_conversations").select("*").eq("id", parsed.data.conversationId).single();
  if (!current) return NextResponse.json({ error: "Conversación no disponible." }, { status: 404 });

  const assignmentChanged = parsed.data.responsibleId && parsed.data.responsibleId !== current.responsible_id;
  if (assignmentChanged && (parsed.data.title || parsed.data.status || parsed.data.priority || parsed.data.addMembers?.length || parsed.data.removeMemberIds?.length)) {
    return NextResponse.json({ error: "Realiza la reasignación por separado para preservar una auditoría atómica." }, { status: 400 });
  }
  const membershipChanged = Boolean(parsed.data.addMembers?.length || parsed.data.removeMemberIds?.length);
  if (membershipChanged && (parsed.data.title || parsed.data.status || parsed.data.priority)) {
    return NextResponse.json({ error: "Actualiza participantes por separado para preservar una operación atómica." }, { status: 400 });
  }
  if (assignmentChanged) {
    const { data: target } = await auth.supabase.from("profiles").select("id,active,deleted_at").eq("id", parsed.data.responsibleId!).single();
    if (!target?.active || target.deleted_at) return NextResponse.json({ error: "El responsable no está disponible." }, { status: 400 });
    const { error: reassignError } = await auth.supabase.rpc("reassign_internal_conversation", { target_conversation_id: current.id, target_responsible_id: target.id, assignment_reason: parsed.data.reason!, assignment_note: parsed.data.note ?? null });
    if (reassignError) return NextResponse.json({ error: reassignError.message }, { status: 500 });
  }

  if (membershipChanged) {
    const additions = parsed.data.addMembers ?? [];
    const { error: membershipError } = await auth.supabase.rpc("update_internal_conversation_members", {
      target_conversation_id: current.id,
      added_user_ids: additions.map((member) => member.userId),
      added_roles: additions.map((member) => member.role),
      removed_user_ids: parsed.data.removeMemberIds ?? []
    });
    if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  if (parsed.data.title || parsed.data.status || parsed.data.priority) {
    const { error: updateError } = await auth.supabase.rpc("update_internal_conversation", {
      target_conversation_id: current.id,
      new_title: parsed.data.title ?? null,
      new_status: parsed.data.status ?? null,
      new_priority: parsed.data.priority ?? null
    });
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
