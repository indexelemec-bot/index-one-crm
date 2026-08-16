import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
}

async function processDueCommunications() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase no configurado." }, { status: 503 });
  const admin = createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const now = new Date();

  const { data: due, error } = await admin.from("scheduled_communications")
    .select("id,thread_id,opportunity_id,stakeholder_id,channel,body_text,template_key,attachment_path,attachment_name,scheduled_for,recurrence_months,created_by")
    .eq("status", "scheduled")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let simulated = 0;
  let failed = 0;
  let rescheduled = 0;
  let skipped = 0;

  for (const item of due ?? []) {
    const { data: claimed } = await admin.from("scheduled_communications")
      .update({ status: "processing", updated_at: now.toISOString() })
      .eq("id", item.id)
      .eq("status", "scheduled")
      .select("id")
      .maybeSingle();

    if (!claimed) {
      skipped += 1;
      continue;
    }

    try {
      if (item.channel !== "whatsapp") throw new Error("El procesador automático de correo todavía no está habilitado.");
      if (!item.thread_id || !item.stakeholder_id) throw new Error("El seguimiento no tiene una conversación válida asociada.");

      const { data: thread } = await admin.from("communication_threads")
        .select("id,status,assigned_to,last_inbound_at")
        .eq("id", item.thread_id)
        .single();
      if (!thread || thread.status === "archived") throw new Error("La conversación está archivada o no existe.");

      const { data: stakeholder } = await admin.from("stakeholders").select("id,phone").eq("id", item.stakeholder_id).single();
      if (!stakeholder?.phone) throw new Error("El contacto no tiene un WhatsApp válido.");

      const agentId = thread.assigned_to || item.created_by;
      const { data: agent } = await admin.from("profiles").select("id,full_name").eq("id", agentId).single();
      const agentName = agent?.full_name || "Equipo INDEX CONDO";
      const compactName = agentName.split(" ")[0] || "INDEX";
      const outboundBody = `${item.body_text}\n\n— ${compactName} | INDEX CONDO`;
      const realSendingEnabled = process.env.WHATSAPP_REAL_SEND_ENABLED === "true";
      let provider = "simulation";
      let providerMessageId: string | null = null;
      let status = "simulated";

      if (realSendingEnabled) {
        const token = process.env.WHATSAPP_ACCESS_TOKEN;
        const phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID;
        if (!token || !phoneNumberId) throw new Error("WhatsApp Business no está configurado para envío real.");

        const lastInbound = thread.last_inbound_at ? new Date(String(thread.last_inbound_at)).getTime() : 0;
        const insideServiceWindow = lastInbound > 0 && now.getTime() - lastInbound <= 24 * 60 * 60 * 1000;
        if (!insideServiceWindow) {
          throw new Error(item.template_key
            ? "El seguimiento está fuera de la ventana de 24 horas. La plantilla aprobada debe configurarse antes de activar el envío automático."
            : "El seguimiento está fuera de la ventana de 24 horas y requiere una plantilla de WhatsApp aprobada.");
        }

        const digits = String(stakeholder.phone).replace(/\D/g, "");
        const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
        const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: digits, type: "text", text: { preview_url: true, body: outboundBody } })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.messages?.[0]?.id) throw new Error(result.error?.message ?? "WhatsApp Business no confirmó el envío.");
        provider = "meta_whatsapp";
        providerMessageId = result.messages[0].id;
        status = "sent";
      }

      const sentAt = new Date().toISOString();
      const { data: communication, error: communicationError } = await admin.from("communications").insert({
        opportunity_id: item.opportunity_id,
        stakeholder_id: item.stakeholder_id,
        thread_id: item.thread_id,
        channel: "whatsapp",
        direction: "outbound",
        from_address: process.env.WHATSAPP_BUSINESS_DISPLAY_NUMBER || "INDEX CONDO",
        to_address: stakeholder.phone,
        body_text: outboundBody,
        template_key: item.template_key,
        provider,
        provider_message_id: providerMessageId,
        status,
        agent_id: agentId,
        agent_name_snapshot: agentName,
        message_type: item.attachment_path ? "document" : "text",
        media_path: item.attachment_path,
        media_name: item.attachment_name,
        created_by: item.created_by,
        sent_at: sentAt
      }).select("id").single();
      if (communicationError || !communication) throw new Error(communicationError?.message ?? "No fue posible registrar el mensaje programado.");

      await admin.from("communication_threads").update({ last_message_at: sentAt, last_outbound_at: sentAt, updated_at: sentAt }).eq("id", item.thread_id);

      const recurrence = Number(item.recurrence_months || 0);
      if (recurrence > 0) {
        const next = addMonths(new Date(String(item.scheduled_for)), recurrence);
        await admin.from("scheduled_communications").update({
          status: "scheduled",
          scheduled_for: next.toISOString(),
          sent_communication_id: communication.id,
          last_error: null,
          updated_at: sentAt
        }).eq("id", item.id);
        rescheduled += 1;
      } else {
        await admin.from("scheduled_communications").update({
          status: "sent",
          sent_communication_id: communication.id,
          last_error: null,
          updated_at: sentAt
        }).eq("id", item.id);
      }

      if (realSendingEnabled) sent += 1; else simulated += 1;
    } catch (cause) {
      failed += 1;
      const message = cause instanceof Error ? cause.message : "No fue posible procesar el seguimiento programado.";
      await admin.from("scheduled_communications").update({ status: "failed", last_error: message, updated_at: new Date().toISOString() }).eq("id", item.id).eq("status", "processing");
    }
  }

  return NextResponse.json({ ok: true, processed: due?.length ?? 0, sent, simulated, failed, rescheduled, skipped });
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return processDueCommunications();
}

export async function POST() {
  const supabase = await createServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role,active,deleted_at").eq("id", authData.user.id).maybeSingle();
  if (!profile || !profile.active || profile.deleted_at || !["ejecutivo", "gerencia_comercial", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No tienes permiso para procesar seguimientos programados." }, { status: 403 });
  }

  return processDueCommunications();
}
