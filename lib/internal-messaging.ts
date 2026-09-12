import type { InternalConversation, InternalMessage } from "@/types/domain";

type Row = Record<string, unknown>;

export function mapInternalMessage(row: Row): InternalMessage {
  const mentions = (row.internal_message_mentions ?? row.mentions ?? []) as Array<{ mentioned_user_id?: string }>;
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: String(row.sender_id),
    bodyText: String(row.body_text ?? ""),
    replyToId: row.reply_to_id ? String(row.reply_to_id) : undefined,
    messageType: row.message_type === "system" ? "system" : "internal_note",
    attachmentPath: row.attachment_path ? String(row.attachment_path) : undefined,
    attachmentName: row.attachment_name ? String(row.attachment_name) : undefined,
    attachmentMime: row.attachment_mime ? String(row.attachment_mime) : undefined,
    attachmentSize: row.attachment_size == null ? undefined : Number(row.attachment_size),
    mentionedUserIds: mentions.map((mention) => String(mention.mentioned_user_id)).filter(Boolean),
    createdAt: String(row.created_at)
  };
}

export function mapInternalConversation(row: Row, currentUserId: string): InternalConversation {
  const members = (row.internal_conversation_members ?? row.members ?? []) as Array<Row>;
  const notifications = (row.internal_notifications ?? row.notifications ?? []) as Array<Row>;
  return {
    id: String(row.id),
    title: String(row.title),
    conversationType: row.conversation_type === "direct" ? "direct" : "group",
    opportunityId: row.opportunity_id ? String(row.opportunity_id) : undefined,
    status: row.status as InternalConversation["status"],
    priority: row.priority as InternalConversation["priority"],
    responsibleId: row.responsible_id ? String(row.responsible_id) : undefined,
    createdBy: String(row.created_by),
    lastMessageAt: row.last_message_at ? String(row.last_message_at) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    members: members.map((member) => ({
      userId: String(member.user_id),
      role: member.member_role as "responsible" | "member" | "observer",
      joinedAt: String(member.joined_at),
      removedAt: member.removed_at ? String(member.removed_at) : undefined,
      lastReadAt: member.last_read_at ? String(member.last_read_at) : undefined
    })),
    unreadCount: notifications.filter((notification) => notification.recipient_id === currentUserId && !notification.read_at).length,
    mentioned: notifications.some((notification) => notification.recipient_id === currentUserId && notification.notification_type === "mention" && !notification.read_at)
  };
}
