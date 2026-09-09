import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { mapInternalConversation, mapInternalMessage } from "./internal-messaging";

describe("internal messaging mappers", () => {
  it("maps mentions and attachment metadata without external channel fields", () => {
    const message = mapInternalMessage({
      id: "m1", conversation_id: "c1", sender_id: "u1", body_text: "Nota privada", message_type: "internal_note",
      attachment_path: "internal/c1/file.pdf", attachment_name: "file.pdf", attachment_mime: "application/pdf", attachment_size: 100,
      internal_message_mentions: [{ mentioned_user_id: "u2" }], created_at: "2026-09-08T12:00:00Z"
    });
    expect(message).toMatchObject({ conversationId: "c1", bodyText: "Nota privada", mentionedUserIds: ["u2"], attachmentName: "file.pdf" });
    expect(message).not.toHaveProperty("channel");
    expect(message).not.toHaveProperty("toAddress");
  });

  it("derives unread and mention state only for the signed-in user", () => {
    const conversation = mapInternalConversation({
      id: "c1", title: "Cierre", conversation_type: "group", status: "open", priority: "urgent", responsible_id: "u1", created_by: "u1",
      created_at: "2026-09-08T12:00:00Z", updated_at: "2026-09-08T12:00:00Z",
      internal_conversation_members: [{ user_id: "u1", member_role: "responsible", joined_at: "2026-09-08T12:00:00Z" }],
      internal_notifications: [
        { recipient_id: "u1", notification_type: "mention", read_at: null },
        { recipient_id: "u1", notification_type: "message", read_at: "2026-09-08T12:10:00Z" },
        { recipient_id: "u2", notification_type: "message", read_at: null }
      ]
    }, "u1");
    expect(conversation.unreadCount).toBe(1);
    expect(conversation.mentioned).toBe(true);
    expect(conversation.members[0]?.role).toBe("responsible");
  });

  it("keeps sensitive writes behind authenticated RPCs", async () => {
    const sql = await readFile(path.join(process.cwd(), "supabase/migrations/20260908171341_internal_messaging_collaboration.sql"), "utf8");
    expect(sql).toContain("grant select on public.internal_messages to authenticated");
    expect(sql).not.toMatch(/grant[^;]*insert[^;]*on public\.internal_messages to authenticated/i);
    expect(sql).not.toMatch(/grant[^;]*insert[^;]*on public\.internal_notifications to authenticated/i);
    expect(sql).not.toMatch(/grant[^;]*insert[^;]*on public\.internal_conversation_assignment_history to authenticated/i);
    expect(sql).toContain("not like ('internal/' || target_conversation_id::text || '/%')");
    expect(sql).toContain("if not exists (select 1 from pg_publication_tables");
  });
});
