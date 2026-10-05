"use client";

import { ClipboardCheck, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type FormSession = {
  id: string;
  answers: Record<string, unknown>;
  tracking: Record<string, unknown>;
  completed_at: string | null;
};

const labels: Record<string, string> = {
  projectType: "Tipo de proyecto",
  residentialSubtype: "Subcategoría",
  customUnitType: "Tipo de unidad",
  projectName: "Proyecto",
  contactName: "Contacto",
  contactRole: "Cargo o relación",
  phone: "WhatsApp",
  email: "Correo",
  location: "Ubicación",
  city: "Ciudad",
  units: "Unidades o locales",
  financialSituation: "Situación financiera",
  operationSituation: "Operación y personal",
  priorities: "Prioridades",
  source: "Cómo nos conoció",
};

function displayValue(value: unknown) {
  if (Array.isArray(value)) return value.join(" · ");
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value ?? "—");
}

export function MarketingFormResponses({ accountId }: { accountId: string }) {
  const [sessions, setSessions] = useState<FormSession[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    void (async () => {
      const client = createClient();
      if (!client) return;
      const { data, error } = await client
        .from("marketing_form_sessions")
        .select("id,answers,tracking,completed_at")
        .eq("account_id", accountId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });
      if (!cancelled && !error) setSessions((data ?? []) as FormSession[]);
    })();
    return () => { cancelled = true; };
  }, [accountId]);

  if (sessions.length === 0) return null;
  const latest = sessions[0];
  const tracking = latest.tracking ?? {};

  return <section className="card detail-section marketing-response-card">
    <div className="split-heading">
      <div>
        <span className="eyebrow">Formulario original</span>
        <h2>Diagnóstico recibido desde la landing</h2>
      </div>
      <ClipboardCheck size={21} color="#f47721" />
    </div>
    <p className="marketing-response-meta">
      Completado {latest.completed_at ? new Date(latest.completed_at).toLocaleString("es-DO", { dateStyle: "long", timeStyle: "short" }) : "sin fecha"}
      {sessions.length > 1 ? ` · ${sessions.length} envíos asociados` : ""}
    </p>
    <div className="response-grid">
      {Object.entries(latest.answers ?? {}).filter(([, value]) => value !== "" && value !== null && value !== undefined).map(([key, value]) => <div key={key}>
        <small>{labels[key] ?? key}</small>
        <b>{displayValue(value)}</b>
      </div>)}
    </div>
    <footer className="marketing-response-footer">
      <span>Campaña: <b>{String(tracking.utmCampaign || "Directo")}</b> · Fuente: <b>{String(tracking.utmSource || "Sin UTM")}</b></span>
      <a className="text-link" href={`/captacion?session=${latest.id}`}>Ver registro de captación <ExternalLink size={13} /></a>
    </footer>
  </section>;
}
