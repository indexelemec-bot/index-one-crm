/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function normalizePhone(value: string) {
  return String(value || "").replace(/[^0-9+]/g, "").trim();
}

function firstValue(fields: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = fields[normalizeKey(alias)];
    if (value) return value;
  }
  return "";
}

function parseUnits(value: string) {
  const match = String(value || "").match(/\d+/);
  if (!match) return null;
  const numeric = Number(match[0]);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

async function chooseOwner(admin: any) {
  const configured = process.env.GOOGLE_FORMS_DEFAULT_OWNER_ID;
  if (configured) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("id", configured)
      .eq("active", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  const { data: executives } = await admin
    .from("profiles")
    .select("id,role")
    .eq("active", true)
    .is("deleted_at", null)
    .in("role", ["ejecutivo", "gerencia_comercial", "superadmin"]);

  if (!executives?.length) return null;
  const preferred =
    executives.find((item: any) => item.role === "ejecutivo") ??
    executives.find((item: any) => item.role === "gerencia_comercial") ??
    executives[0];
  return preferred?.id as string | null;
}

function isAuthorized(request: Request) {
  const expected = process.env.GOOGLE_FORMS_WEBHOOK_SECRET;
  if (!expected) return false;
  const provided = request.headers.get("x-index-form-secret") || "";
  return provided.length > 0 && provided === expected;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const admin = adminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase administrativo no está configurado." }, { status: 503 });
  }

  const payload = await request.json().catch(() => ({}));
  const namedValues = payload?.namedValues && typeof payload.namedValues === "object" ? payload.namedValues : payload;
  const fields: Record<string, string> = {};

  for (const [key, raw] of Object.entries(namedValues || {})) {
    const value = Array.isArray(raw) ? String(raw[0] ?? "") : String(raw ?? "");
    fields[normalizeKey(key)] = value.trim();
  }

  const fullName = firstValue(fields, [
    "Nombre del Solicitante",
    "Nombre y Apellido",
    "Nombre completo",
    "Nombre"
  ]);
  const phone = normalizePhone(
    firstValue(fields, ["Numero de Contacto ", "Número de Contacto", "Numero de Contacto", "Teléfono", "Telefono", "WhatsApp"])
  );
  const email = firstValue(fields, [
    "Dirección de correo electrónico",
    "Direccion de correo electronico",
    "Correo electrónico",
    "Correo electronico",
    "Email"
  ]).toLowerCase();
  const condominiumName = firstValue(fields, [
    "Cual es el nombre del Residencial ?",
    "Nombre del Residencial",
    "Nombre del Condominio",
    "Residencial",
    "Condominio",
    "Torre"
  ]);
  const location = firstValue(fields, [
    "¿Cuál es la ubicación física ",
    "Ubicación física",
    "Ubicacion fisica",
    "Ubicación",
    "Ubicacion",
    "Sector"
  ]);
  const units = parseUnits(
    firstValue(fields, [
      "¿Cuántos apartamentos posee el edificio? ",
      "Cantidad de apartamentos",
      "Cantidad de unidades",
      "Apartamentos",
      "Unidades"
    ])
  );
  const primaryProblem = firstValue(fields, [
    "¿Porque desean contratar una empresa de administración de condominios? ",
    "¿Por qué desean contratar una empresa de administración?",
    "Por que desean contratar una empresa de administracion",
    "Motivo de contratación",
    "Motivo de contratacion",
    "Necesidad principal"
  ]);
  const sourceDetail = firstValue(fields, [
    "¿Cómo se enteró de nosotros?",
    "Como se entero de nosotros",
    "Cómo se enteró de nosotros",
    "Origen"
  ]);
  const timestamp = firstValue(fields, ["Marca temporal", "Timestamp", "Fecha"]);

  if (!condominiumName || (!phone && !email)) {
    return NextResponse.json(
      { error: "Faltan datos mínimos: residencial y al menos teléfono o correo." },
      { status: 422 }
    );
  }

  const ownerId = await chooseOwner(admin);
  if (!ownerId) {
    return NextResponse.json({ error: "No hay un usuario comercial activo para asignar el prospecto." }, { status: 503 });
  }

  const externalId = String(payload?.responseId || payload?.row || timestamp || `${condominiumName}:${phone || email}`);
  const { data: existingLead } = await admin
    .from("marketing_leads")
    .select("id,status,account_id,opportunity_id")
    .eq("provider", "google_forms")
    .eq("lead_id", externalId)
    .maybeSingle();

  if (existingLead?.status === "converted") {
    return NextResponse.json({ received: true, duplicate: true, opportunityId: existingLead.opportunity_id });
  }

  let leadRowId = existingLead?.id as string | undefined;
  if (!leadRowId) {
    const inserted = await admin
      .from("marketing_leads")
      .insert({
        provider: "google_forms",
        source_channel: "other",
        lead_id: externalId,
        form_name: String(payload?.formName || "Google Forms"),
        full_name: fullName || null,
        phone: phone || null,
        email: email || null,
        condominium_name: condominiumName,
        sector: location || null,
        units,
        primary_problem: primaryProblem || null,
        raw_payload: payload,
        status: "new",
        assigned_to: ownerId,
        received_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()
      })
      .select("id")
      .single();
    leadRowId = inserted.data?.id;
  }

  if (!leadRowId) {
    return NextResponse.json({ error: "No fue posible registrar el lead entrante." }, { status: 500 });
  }

  let account: any = null;
  const { data: accountByName } = await admin
    .from("accounts")
    .select("id,name,owner_id")
    .ilike("name", condominiumName)
    .limit(1)
    .maybeSingle();
  account = accountByName;

  if (!account) {
    const created = await admin
      .from("accounts")
      .insert({
        name: condominiumName,
        account_type: "condominio_existente",
        address: location || null,
        sector: location || null,
        city: "Santo Domingo",
        units,
        towers: 1,
        profile: "Prospecto captado automáticamente desde Google Forms",
        source: sourceDetail ? `Google Forms · ${sourceDetail}` : "Google Forms",
        created_by: ownerId,
        owner_id: ownerId
      })
      .select("id,name,owner_id")
      .single();
    account = created.data;
  }

  if (!account) {
    await admin.from("marketing_leads").update({ status: "error", error_message: "No fue posible crear la cuenta." }).eq("id", leadRowId);
    return NextResponse.json({ error: "No fue posible crear la cuenta." }, { status: 500 });
  }

  let stakeholder: any = null;
  if (phone) {
    const result = await admin
      .from("stakeholders")
      .select("*")
      .eq("account_id", account.id)
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();
    stakeholder = result.data;
  }
  if (!stakeholder && email) {
    const result = await admin
      .from("stakeholders")
      .select("*")
      .eq("account_id", account.id)
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    stakeholder = result.data;
  }
  if (!stakeholder) {
    const created = await admin
      .from("stakeholders")
      .insert({
        account_id: account.id,
        full_name: fullName || "Contacto Google Forms",
        role: "otro",
        phone: phone || null,
        email: email || null,
        influence: 3,
        position: "unknown",
        is_decision_maker: false
      })
      .select("*")
      .single();
    stakeholder = created.data;
  }

  const { data: activeOpportunity } = await admin
    .from("opportunities")
    .select("id,stage")
    .eq("account_id", account.id)
    .neq("stage", "cliente_activo")
    .neq("stage", "perdida")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let opportunity = activeOpportunity;
  if (!opportunity) {
    const nextActionAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const created = await admin
      .from("opportunities")
      .insert({
        account_id: account.id,
        stage: "prospecto_identificado",
        primary_problem: primaryProblem || "Formulario de diagnóstico recibido",
        impact: "Pendiente de diagnóstico comercial",
        proposed_solution: "Evaluar solución integral de administración INDEX CONDO",
        monthly_fee: 0,
        probability: 10,
        next_action: "Contactar prospecto recibido desde Google Forms",
        next_action_at: nextActionAt,
        owner_id: ownerId
      })
      .select("id,stage")
      .single();
    opportunity = created.data;

    if (opportunity) {
      await admin.from("tasks").insert({
        opportunity_id: opportunity.id,
        title: "Contactar nuevo prospecto de Google Forms",
        due_at: nextActionAt,
        priority: "alta",
        status: "pendiente",
        owner_id: ownerId
      });
    }
  }

  if (!opportunity) {
    await admin.from("marketing_leads").update({ status: "error", error_message: "No fue posible crear la oportunidad." }).eq("id", leadRowId);
    return NextResponse.json({ error: "No fue posible crear la oportunidad." }, { status: 500 });
  }

  await admin
    .from("marketing_leads")
    .update({
      status: "converted",
      account_id: account.id,
      stakeholder_id: stakeholder?.id ?? null,
      opportunity_id: opportunity.id,
      assigned_to: ownerId,
      converted_at: new Date().toISOString(),
      error_message: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", leadRowId);

  return NextResponse.json({
    received: true,
    accountId: account.id,
    stakeholderId: stakeholder?.id ?? null,
    opportunityId: opportunity.id
  });
}
