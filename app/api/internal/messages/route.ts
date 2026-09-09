import { NextResponse } from "next/server";
import { z } from "zod";
import { mapInternalMessage } from "@/lib/internal-messaging";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({ conversationId: z.string().uuid(), cursor: z.string().max(100).optional(), limit: z.coerce.number().int().min(20).max(100).default(100) });
const cursorSchema = z.tuple([z.string().datetime(), z.string().uuid()]);
const createSchema = z.object({
  conversationId: z.string().uuid(),
  bodyText: z.string().trim().max(10000).default(""),
  replyToId: z.string().uuid().optional(),
  mentionedUserIds: z.array(z.string().uuid()).max(50).default([]),
  attachment: z.object({ path: z.string().min(1).max(500), name: z.string().min(1).max(255), mime: z.string().min(1).max(120), size: z.number().int().positive().max(15728640) }).optional()
}).refine((value) => value.bodyText.length > 0 || value.attachment, "Escribe un mensaje o adjunta un archivo.");

async function authenticatedClient() {
  const supabase = await createClient();
  if (!supabase) return { response: NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 }) };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { response: NextResponse.json({ error: "Sesión no disponible." }, { status: 401 }) };
  return { supabase, user: data.user };
}

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "Conversación inválida." }, { status: 400 });
  const cursor = parsed.data.cursor ? cursorSchema.safeParse(parsed.data.cursor.split("|")) : null;
  if (cursor && !cursor.success) return NextResponse.json({ error: "Cursor de mensajes inválido." }, { status: 400 });
  const auth = await authenticatedClient();
  if (auth.response || !auth.supabase) return auth.response;
  let query = auth.supabase.from("internal_messages")
    .select("*,internal_message_mentions(mentioned_user_id)")
    .eq("conversation_id", parsed.data.conversationId)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(parsed.data.limit + 1);
  if (cursor?.success) query = query.or(`created_at.lt.${cursor.data[0]},and(created_at.eq.${cursor.data[0]},id.lt.${cursor.data[1]})`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = data ?? [];
  const hasMore = rows.length > parsed.data.limit;
  const page = rows.slice(0, parsed.data.limit);
  const { data: history } = await auth.supabase.from("internal_conversation_assignment_history").select("*").eq("conversation_id", parsed.data.conversationId).order("changed_at", { ascending: false });
  const oldest = page.at(-1);
  return NextResponse.json({ messages: page.map(mapInternalMessage).reverse(), nextCursor: hasMore && oldest ? `${oldest.created_at}|${oldest.id}` : null, assignmentHistory: history ?? [] });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Mensaje interno inválido." }, { status: 400 });
  const auth = await authenticatedClient();
  if (auth.response || !auth.supabase || !auth.user) return auth.response;
  const { data: conversation } = await auth.supabase.from("internal_conversations").select("id,status").eq("id", parsed.data.conversationId).single();
  if (!conversation) return NextResponse.json({ error: "Conversación no disponible." }, { status: 404 });
  if (conversation.status === "closed") return NextResponse.json({ error: "Reabre la conversación antes de escribir." }, { status: 409 });
  if (parsed.data.replyToId) {
    const { data: reply } = await auth.supabase.from("internal_messages").select("id,conversation_id").eq("id", parsed.data.replyToId).eq("conversation_id", conversation.id).single();
    if (!reply) return NextResponse.json({ error: "El mensaje respondido no pertenece a esta conversación." }, { status: 400 });
  }
  const uniqueMentions = [...new Set(parsed.data.mentionedUserIds)].filter((id) => id !== auth.user!.id);
  if (uniqueMentions.length) {
    const { data: members } = await auth.supabase.from("internal_conversation_members").select("user_id").eq("conversation_id", conversation.id).is("removed_at", null).in("user_id", uniqueMentions);
    if ((members ?? []).length !== uniqueMentions.length) return NextResponse.json({ error: "Solo puedes mencionar participantes activos." }, { status: 400 });
  }
  const { data: messageId, error } = await auth.supabase.rpc("send_internal_message", {
    target_conversation_id: conversation.id,
    message_body: parsed.data.bodyText,
    replied_message_id: parsed.data.replyToId ?? null,
    mentioned_user_ids: uniqueMentions,
    file_path: parsed.data.attachment?.path ?? null,
    file_name: parsed.data.attachment?.name ?? null,
    file_mime: parsed.data.attachment?.mime ?? null,
    file_size: parsed.data.attachment?.size ?? null
  });
  if (error || !messageId) return NextResponse.json({ error: error?.message ?? "No fue posible enviar la nota interna." }, { status: 500 });
  const { data: message, error: readError } = await auth.supabase.from("internal_messages").select("*,internal_message_mentions(mentioned_user_id)").eq("id", messageId).single();
  if (readError || !message) return NextResponse.json({ error: readError?.message ?? "La nota fue guardada, pero no pudo recargarse." }, { status: 500 });
  return NextResponse.json({ message: mapInternalMessage(message) }, { status: 201 });
}
