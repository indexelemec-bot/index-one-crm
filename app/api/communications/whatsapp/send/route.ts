import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  simulate: z.boolean().optional().default(false)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa la conversación y el mensaje." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  const { data: thread, error: threadError } = await supabase.from("communication_threads").select("id,opportunity_id,stakeholder_id,assigned_to,status").eq("id", parsed.data.threadId).single();
  if (threadError || !thread || thread.status === "archived") return NextResponse.json({ error: "Conversación no disponible." }, { status: 404 });

  const { data: opportunity } = await supabase.from("opportunities").select("id,account_id,owner_id").eq("id", thread.opportunity_id).single();
  const { data: stakeholder } = await supabase.from("stakeholders").select("id,full_name,phone,account_id").eq("id", thread.stakeholder_id).single();
  const { data: profile } = await supabase.from("profiles").select("id,full_name").eq("id", authData.user.id).single();
  if (!opportunity || !stakeholder?.phone || stakeholder.account_id !== opportunity.account_id) return NextResponse.json({ error: "El contacto no tiene un WhatsApp válido." }, { status: 400 });

  const agentName = profile?.full_name || "Equipo INDEX CONDO";
  const compactName = agentName.split(" ")[0] || "INDEX";
  const outboundBody = `${parsed.data.body}\n\n— ${compactName} | INDEX CONDO`;
  const now = new Date().toISOString();
  let provider = "simulation";
  let providerMessageId: string | null = null;
  let status = "simulated";

  const realSendingEnabled = process.env.WHATSAPP_REAL_SEND_ENABLED === "true" && !parsed.data.simulate;
  const metaToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID;
  if (realSendingEnabled) {
    if (!metaToken || !phoneNumberId) return NextResponse.json({ error: "WhatsApp Business todavía no está configurado para envío real." }, { status: 503 });
    const digits = String(stakeholder.phone).replace(/\D/g, "");
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: digits, type: "text", text: { preview_url: true, body: outboundBody } })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.messages?.[0]?.id) return NextResponse.json({ error: result.error?.message ?? "WhatsApp Business no confirmó el envío." }, { status: 502 });
    provider = "meta_whatsapp";
    providerMessageId = result.messages[0].id;
    status = "sent";
  }

  const { data: communication, error: recordError } = await supabase.from("communications").insert({
    opportunity_id: opportunity.id,
    stakeholder_id: stakeholder.id,
    thread_id: thread.id,
    channel: "whatsapp",
    direction: "outbound",
    from_address: process.env.WHATSAPP_BUSINESS_DISPLAY_NUMBER || "INDEX CONDO",
    to_address: stakeholder.phone,
    body_text: outboundBody,
    provider,
    provider_message_id: providerMessageId,
    status,
    agent_id: authData.user.id,
    agent_name_snapshot: agentName,
    message_type: "text",
    created_by: authData.user.id,
    sent_at: now
  }).select("*").single();
  if (recordError || !communication) return NextResponse.json({ error: recordError?.message ?? "No fue posible registrar el mensaje." }, { status: 500 });

  await supabase.from("communication_threads").update({
    assigned_to: thread.assigned_to ?? authData.user.id,
    last_message_at: now,
    last_outbound_at: now,
    updated_at: now
  }).eq("id", thread.id);

  return NextResponse.json({ communication, mode: realSendingEnabled ? "official" : "simulation" });
}
