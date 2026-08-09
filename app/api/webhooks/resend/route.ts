import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";

type ResendEvent = { type: string; created_at?: string; data?: { email_id?: string } };
const statuses: Record<string, string> = { "email.sent":"sent", "email.delivered":"delivered", "email.opened":"opened", "email.delivery_delayed":"delayed", "email.bounced":"bounced", "email.failed":"failed", "email.complained":"complained", "email.received":"received" };

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY; const secret = process.env.RESEND_WEBHOOK_SECRET; const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !secret || !url || !serviceKey) return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  try {
    const payload = await request.text(); const resend = new Resend(apiKey);
    const event = resend.webhooks.verify({ payload, headers: { id: request.headers.get("svix-id") || "", timestamp: request.headers.get("svix-timestamp") || "", signature: request.headers.get("svix-signature") || "" }, webhookSecret: secret }) as ResendEvent;
    const eventId = request.headers.get("svix-id"); if (!eventId) throw new Error("Evento sin identificador");
    const admin = createAdminClient(url, serviceKey, { auth: { persistSession: false } });
    const { error: eventError } = await admin.from("communication_webhook_events").insert({ id: eventId, provider: "resend", event_type: event.type, provider_message_id: event.data?.email_id ?? null, event_created_at: event.created_at ?? null });
    if (eventError?.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    if (eventError) throw eventError;
    const status = statuses[event.type];
    if (status && event.data?.email_id) {
      const timestamp = event.created_at || new Date().toISOString();
      await admin.from("communications").update({ status, ...(status === "delivered" && { delivered_at: timestamp }), ...(status === "opened" && { opened_at: timestamp }) }).eq("provider", "resend").eq("provider_message_id", event.data.email_id);
    }
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Firma de webhook inválida" }, { status: 400 }); }
}
