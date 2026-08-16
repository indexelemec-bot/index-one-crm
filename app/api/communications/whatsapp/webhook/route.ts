import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return process.env.WHATSAPP_WEBHOOK_ALLOW_UNSIGNED === "true";
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function inboundBody(incoming: any) {
  if (incoming?.type === "audio") return "🎤 Nota de voz recibida";
  if (incoming?.type === "image") return incoming?.image?.caption || "🖼️ Imagen recibida";
  if (incoming?.type === "document") return incoming?.document?.caption || incoming?.document?.filename || "📎 Documento recibido";
  return incoming?.text?.body ?? incoming?.button?.text ?? incoming?.interactive?.button_reply?.title ?? `[${incoming?.type ?? "mensaje"}]`;
}

function providerMediaId(incoming: any) {
  if (incoming?.type === "audio") return incoming?.audio?.id ?? null;
  if (incoming?.type === "image") return incoming?.image?.id ?? null;
  if (incoming?.type === "document") return incoming?.document?.id ?? null;
  if (incoming?.type === "video") return incoming?.video?.id ?? null;
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Verificación rechazada." }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  const payload = JSON.parse(rawBody || "{}");
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "Supabase administrativo no está configurado." }, { status: 503 });

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
      const value = change?.value ?? {};

      for (const statusUpdate of Array.isArray(value.statuses) ? value.statuses : []) {
        const providerId = statusUpdate?.id;
        const status = statusUpdate?.status;
        if (!providerId || !status) continue;
        const patch: Record<string, unknown> = { status };
        if (status === "sent") patch.sent_at = new Date(Number(statusUpdate.timestamp) * 1000).toISOString();
        if (status === "delivered") patch.delivered_at = new Date(Number(statusUpdate.timestamp) * 1000).toISOString();
        if (status === "read") patch.opened_at = new Date(Number(statusUpdate.timestamp) * 1000).toISOString();
        if (status === "failed") patch.error_message = statusUpdate?.errors?.[0]?.title ?? "WhatsApp reportó un fallo.";
        await admin.from("communications").update(patch).eq("provider_message_id", providerId);
      }

      for (const incoming of Array.isArray(value.messages) ? value.messages : []) {
        const from = digits(incoming?.from);
        if (!from || !incoming?.id) continue;
        const { data: contacts } = await admin.from("stakeholders").select("id,account_id,full_name,phone").limit(1000);
        const stakeholder = (contacts ?? []).find((item) => {
          const candidate = digits(item.phone);
          return candidate === from || candidate.endsWith(from) || from.endsWith(candidate);
        });
        if (!stakeholder) continue;

        const { data: opportunities } = await admin.from("opportunities").select("id,account_id,owner_id,updated_at").eq("account_id", stakeholder.account_id).order("updated_at", { ascending: false }).limit(1);
        const opportunity = opportunities?.[0];
        if (!opportunity) continue;

        let { data: thread } = await admin.from("communication_threads").select("*").eq("opportunity_id", opportunity.id).eq("stakeholder_id", stakeholder.id).eq("channel", "whatsapp").maybeSingle();
        if (!thread) {
          const created = await admin.from("communication_threads").insert({ opportunity_id: opportunity.id, stakeholder_id: stakeholder.id, channel: "whatsapp", assigned_to: opportunity.owner_id, status: "open" }).select("*").single();
          thread = created.data;
        }
        if (!thread) continue;

        const receivedAt = incoming?.timestamp ? new Date(Number(incoming.timestamp) * 1000).toISOString() : new Date().toISOString();
        const { data: duplicate } = await admin.from("communications").select("id").eq("provider_message_id", incoming.id).maybeSingle();
        if (duplicate) continue;

        const mediaId = providerMediaId(incoming);
        const messageType = incoming?.type ?? "text";
        const transcribable = messageType === "audio" && Boolean(mediaId);
        const { data: communication } = await admin.from("communications").insert({
          opportunity_id: opportunity.id,
          stakeholder_id: stakeholder.id,
          thread_id: thread.id,
          channel: "whatsapp",
          direction: "inbound",
          from_address: from,
          to_address: value?.metadata?.display_phone_number ?? "INDEX CONDO",
          body_text: inboundBody(incoming),
          provider: "meta_whatsapp",
          provider_message_id: incoming.id,
          provider_media_id: mediaId,
          status: "received",
          message_type: messageType,
          media_name: incoming?.document?.filename ?? null,
          media_mime_type: incoming?.audio?.mime_type ?? incoming?.image?.mime_type ?? incoming?.document?.mime_type ?? incoming?.video?.mime_type ?? null,
          transcription_status: transcribable ? "pending" : "not_requested",
          transcription_language: transcribable ? "es" : null,
          created_by: null,
          created_at: receivedAt
        }).select("id").single();

        await admin.from("communication_threads").update({
          status: "open",
          unread_count: Number(thread.unread_count ?? 0) + 1,
          last_message_at: receivedAt,
          last_inbound_at: receivedAt,
          updated_at: receivedAt
        }).eq("id", thread.id);

        if (communication && transcribable) {
          await admin.from("activities").insert({
            opportunity_id: opportunity.id,
            activity_type: "whatsapp_voice_note",
            outcome: "Nota de voz recibida; transcripción automática pendiente.",
            created_by: opportunity.owner_id,
            completed_at: receivedAt
          }).catch(() => undefined);
        }
      }
    }
  }
  return NextResponse.json({ received: true });
}
