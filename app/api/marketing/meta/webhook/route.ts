/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET;
  if (!secret) return process.env.META_WEBHOOK_ALLOW_UNSIGNED === "true";
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function normalizeKey(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function firstValue(fields: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = fields[normalizeKey(alias)];
    if (value) return value;
  }
  return "";
}

function parseBoolean(value: string) {
  const normalized = normalizeKey(value);
  if (["si", "yes", "true", "1"].includes(normalized)) return true;
  if (["no", "false", "0"].includes(normalized)) return false;
  return null;
}

function parseUnits(value: string) {
  const numeric = Number(String(value).replace(/[^0-9]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

async function chooseOwner(admin: any) {
  const configured = process.env.META_LEADS_DEFAULT_OWNER_ID;
  if (configured) {
    const { data } = await admin.from("profiles").select("id").eq("id", configured).eq("active", true).is("deleted_at", null).maybeSingle();
    if (data?.id) return data.id as string;
  }
  const { data: executives } = await admin.from("profiles").select("id,role").eq("active", true).is("deleted_at", null).in("role", ["ejecutivo", "gerencia_comercial", "superadmin"]);
  if (!executives?.length) return null;
  const preferred = executives.find((item: any) => item.role === "ejecutivo") ?? executives.find((item: any) => item.role === "gerencia_comercial") ?? executives[0];
  return preferred?.id as string | null;
}

async function fetchMetaLead(leadId: string) {
  const token = process.env.META_LEADS_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error("Falta META_LEADS_ACCESS_TOKEN para recuperar los datos del formulario.");
  const graphVersion = process.env.META_GRAPH_VERSION || process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  const fields = "id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data";
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${leadId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message ?? "Meta no devolvió los datos del lead.");
  return data;
}

async function convertLead(admin: any, rowId: string, lead: any, sourceChannel: string) {
  const fields: Record<string, string> = {};
  for (const item of Array.isArray(lead.field_data) ? lead.field_data : []) {
    const key = normalizeKey(String(item?.name ?? ""));
    const value = Array.isArray(item?.values) ? String(item.values[0] ?? "") : "";
    if (key) fields[key] = value;
  }

  const fullName = firstValue(fields, ["full_name", "nombre_completo", "nombre", "name"]);
  const phone = firstValue(fields, ["phone_number", "telefono", "whatsapp", "numero_de_whatsapp", "phone"]);
  const email = firstValue(fields, ["email", "correo", "correo_electronico"]);
  const condominiumName = firstValue(fields, ["condominium_name", "nombre_del_condominio", "residencial", "torre", "nombre_de_la_torre"]);
  const sector = firstValue(fields, ["sector", "ubicacion", "zona"]);
  const units = parseUnits(firstValue(fields, ["units", "apartamentos", "cantidad_de_apartamentos", "cantidad_de_unidades"]));
  const currentAdminRaw = firstValue(fields, ["current_admin", "tienen_administracion", "administracion_actual"]);
  const primaryProblem = firstValue(fields, ["primary_problem", "principal_problema", "problema_principal", "necesidad"]);
  const stakeholderRole = firstValue(fields, ["stakeholder_role", "cargo", "relacion_con_el_condominio", "posicion"]);
  const boardRaw = firstValue(fields, ["board_member", "miembro_de_la_junta", "forma_parte_de_la_junta"]);
  const assessmentRaw = firstValue(fields, ["wants_assessment", "desea_evaluacion", "solicitar_evaluacion"]);
  const ownerId = await chooseOwner(admin);

  const basePatch = {
    source_channel: ["instagram", "facebook", "whatsapp", "website", "other"].includes(sourceChannel) ? sourceChannel : "other",
    full_name: fullName || null,
    phone: phone || null,
    email: email || null,
    condominium_name: condominiumName || null,
    sector: sector || null,
    units,
    current_admin: parseBoolean(currentAdminRaw),
    primary_problem: primaryProblem || null,
    stakeholder_role: stakeholderRole || null,
    board_member: parseBoolean(boardRaw),
    wants_assessment: parseBoolean(assessmentRaw),
    assigned_to: ownerId,
    campaign_id: lead.campaign_id ?? null,
    campaign_name: lead.campaign_name ?? null,
    adset_id: lead.adset_id ?? null,
    adset_name: lead.adset_name ?? null,
    ad_id: lead.ad_id ?? null,
    ad_name: lead.ad_name ?? null,
    form_id: lead.form_id ?? null,
    raw_payload: lead,
    updated_at: new Date().toISOString()
  };
  await admin.from("marketing_leads").update(basePatch).eq("id", rowId);

  if (!ownerId || !condominiumName || (!phone && !email)) {
    await admin.from("marketing_leads").update({ status: "matched", error_message: !ownerId ? "No hay ejecutivo disponible para asignación automática." : "Faltan datos mínimos para crear el prospecto automáticamente." }).eq("id", rowId);
    return;
  }

  let { data: account } = await admin.from("accounts").select("id,name,owner_id").ilike("name", condominiumName).limit(1).maybeSingle();
  if (!account) {
    const created = await admin.from("accounts").insert({
      name: condominiumName,
      account_type: "condominio_existente",
      sector: sector || null,
      city: "Santo Domingo",
      units,
      towers: 1,
      profile: "Lead captado automáticamente desde Meta Ads",
      source: sourceChannel === "facebook" ? "Facebook Ads" : "Instagram Ads",
      created_by: ownerId,
      owner_id: ownerId
    }).select("id,name,owner_id").single();
    account = created.data;
  }
  if (!account) throw new Error("No fue posible crear la cuenta del prospecto.");

  let stakeholder: any = null;
  if (phone) {
    const result = await admin.from("stakeholders").select("*").eq("account_id", account.id).eq("phone", phone).limit(1).maybeSingle();
    stakeholder = result.data;
  }
  if (!stakeholder && email) {
    const result = await admin.from("stakeholders").select("*").eq("account_id", account.id).eq("email", email).limit(1).maybeSingle();
    stakeholder = result.data;
  }
  if (!stakeholder) {
    const created = await admin.from("stakeholders").insert({
      account_id: account.id,
      full_name: fullName || "Contacto Meta",
      role: stakeholderRole || "otro",
      phone: phone || null,
      email: email || null,
      influence: 3,
      position: "unknown",
      is_decision_maker: parseBoolean(boardRaw) === true
    }).select("*").single();
    stakeholder = created.data;
  }
  if (!stakeholder) throw new Error("No fue posible crear el contacto del prospecto.");

  const { data: activeOpportunity } = await admin.from("opportunities").select("id,stage").eq("account_id", account.id).neq("stage", "cliente_activo").neq("stage", "perdida").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  let opportunity = activeOpportunity;
  if (!opportunity) {
    const next = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const created = await admin.from("opportunities").insert({
      account_id: account.id,
      stage: "prospecto_identificado",
      primary_problem: primaryProblem || "Lead recibido desde campaña de Meta",
      impact: "Pendiente de diagnóstico comercial",
      proposed_solution: "Evaluar solución integral de administración INDEX CONDO",
      monthly_fee: 0,
      probability: 10,
      next_action: "Contactar lead de Meta",
      next_action_at: next,
      owner_id: ownerId
    }).select("id,stage").single();
    opportunity = created.data;
    if (opportunity) {
      await admin.from("tasks").insert({ opportunity_id: opportunity.id, title: "Contactar nuevo lead de Instagram/Facebook", due_at: next, priority: "alta", status: "pendiente", owner_id: ownerId });
    }
  }
  if (!opportunity) throw new Error("No fue posible crear la oportunidad comercial.");

  await admin.from("marketing_leads").update({
    status: "converted",
    account_id: account.id,
    stakeholder_id: stakeholder.id,
    opportunity_id: opportunity.id,
    assigned_to: ownerId,
    converted_at: new Date().toISOString(),
    error_message: null,
    updated_at: new Date().toISOString()
  }).eq("id", rowId);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.META_LEADS_WEBHOOK_VERIFY_TOKEN && challenge) return new Response(challenge, { status: 200 });
  return NextResponse.json({ error: "Verificación rechazada." }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "Supabase administrativo no está configurado." }, { status: 503 });
  const payload = JSON.parse(rawBody || "{}");

  for (const entry of Array.isArray(payload.entry) ? payload.entry : []) {
    for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
      if (change?.field !== "leadgen") continue;
      const value = change?.value ?? {};
      const leadId = String(value.leadgen_id ?? value.lead_id ?? "");
      if (!leadId) continue;
      const sourceChannel = String(value.platform ?? process.env.META_LEADS_DEFAULT_SOURCE ?? "instagram").toLowerCase();
      const { data: existing } = await admin.from("marketing_leads").select("id,status").eq("provider", "meta").eq("lead_id", leadId).maybeSingle();
      if (existing?.status === "converted") continue;

      let rowId = existing?.id as string | undefined;
      if (!rowId) {
        const inserted = await admin.from("marketing_leads").insert({
          provider: "meta",
          source_channel: ["instagram", "facebook"].includes(sourceChannel) ? sourceChannel : "instagram",
          lead_id: leadId,
          form_id: value.form_id ?? null,
          ad_id: value.ad_id ?? null,
          raw_payload: value,
          status: "new",
          received_at: value.created_time ? new Date(Number(value.created_time) * 1000).toISOString() : new Date().toISOString()
        }).select("id").single();
        rowId = inserted.data?.id;
      }
      if (!rowId) continue;

      try {
        const lead = await fetchMetaLead(leadId);
        await convertLead(admin, rowId, lead, sourceChannel);
      } catch (cause) {
        await admin.from("marketing_leads").update({ status: "error", error_message: cause instanceof Error ? cause.message : "No fue posible procesar el lead.", updated_at: new Date().toISOString() }).eq("id", rowId);
      }
    }
  }
  return NextResponse.json({ received: true });
}
