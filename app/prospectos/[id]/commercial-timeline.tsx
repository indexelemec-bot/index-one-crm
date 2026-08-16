"use client";

import { CalendarClock, CheckCircle2, ClipboardList, FileSignature, FileText, History, Mail, MessageCircle, RefreshCw, UserRoundCog } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCrm } from "@/components/crm-provider";

type TimelineKind = "communication" | "activity" | "task" | "proposal" | "assignment" | "scheduled" | "contract";
type TimelineItem = { kind: TimelineKind; id: string; at: string; data: Record<string, unknown> };
type TimelineResponse = {
  timeline: TimelineItem[];
  meta?: Record<string, number>;
  error?: string;
};

const kindLabels: Record<TimelineKind, string> = {
  communication: "Comunicación",
  activity: "Actividad",
  task: "Tarea",
  proposal: "Propuesta",
  assignment: "Asignación",
  scheduled: "Seguimiento programado",
  contract: "Contrato"
};

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function numberValue(value: unknown) { return typeof value === "number" ? value : Number(value ?? 0); }

export function CommercialTimeline({ opportunityId }: { opportunityId: string }) {
  const { stakeholders, users } = useCrm();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [meta, setMeta] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | TimelineKind>("all");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const response = await fetch(`/api/communications/timeline?opportunityId=${encodeURIComponent(opportunityId)}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as TimelineResponse;
    if (!response.ok) { setError(result.error ?? "No fue posible cargar el historial comercial."); setLoading(false); return; }
    setItems(result.timeline ?? []); setMeta(result.meta ?? {}); setLoading(false);
  }, [opportunityId]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => filter === "all" ? items : items.filter((item) => item.kind === filter), [items, filter]);

  function icon(kind: TimelineKind) {
    if (kind === "communication") return <MessageCircle size={18}/>;
    if (kind === "activity") return <CheckCircle2 size={18}/>;
    if (kind === "task") return <ClipboardList size={18}/>;
    if (kind === "proposal") return <FileText size={18}/>;
    if (kind === "assignment") return <UserRoundCog size={18}/>;
    if (kind === "scheduled") return <CalendarClock size={18}/>;
    return <FileSignature size={18}/>;
  }

  function title(item: TimelineItem) {
    const data = item.data;
    if (item.kind === "communication") {
      const channel = text(data.channel);
      const direction = text(data.direction) === "inbound" ? "recibido" : "enviado";
      return `${channel === "email" ? "Correo" : "WhatsApp"} ${direction}`;
    }
    if (item.kind === "activity") return text(data.activity_type).replaceAll("_", " ") || "Actividad comercial";
    if (item.kind === "task") return text(data.title) || "Tarea comercial";
    if (item.kind === "proposal") return `Propuesta v${numberValue(data.version) || 1} · ${text(data.status) || "borrador"}`;
    if (item.kind === "assignment") {
      const user = users.find((entry) => entry.id === text(data.new_owner_id));
      return `Asignación a ${user?.fullName ?? "vendedor"}`;
    }
    if (item.kind === "scheduled") return `${text(data.channel) === "email" ? "Correo" : "WhatsApp"} programado · ${text(data.status)}`;
    return `Contrato · ${text(data.status) || "borrador"}`;
  }

  function detail(item: TimelineItem) {
    const data = item.data;
    if (item.kind === "communication") {
      const contact = stakeholders.find((entry) => entry.id === text(data.stakeholder_id));
      const subject = text(data.subject);
      const body = text(data.body_text);
      const agent = text(data.agent_name_snapshot);
      const transcript = text(data.transcription_text);
      return <><p>{subject && <b>{subject} · </b>}{body}</p><small>{contact?.fullName ? `${contact.fullName} · ` : ""}{agent ? `Agente: ${agent} · ` : ""}Estado: {text(data.status) || "registrado"}</small>{text(data.media_name) && <small>Adjunto: {text(data.media_name)}</small>}{transcript && <small>Transcripción: {transcript}</small>}</>;
    }
    if (item.kind === "activity") return <><p>{text(data.outcome) || text(data.next_action) || "Actividad registrada en el expediente."}</p>{text(data.due_at) && <small>Próxima acción: {new Date(text(data.due_at)).toLocaleString("es-DO")}</small>}</>;
    if (item.kind === "task") return <><p>{text(data.outcome) || `Prioridad ${text(data.priority) || "media"} · ${text(data.status) || "pendiente"}`}</p><small>Vence: {text(data.due_at) ? new Date(text(data.due_at)).toLocaleString("es-DO") : "sin fecha"}</small></>;
    if (item.kind === "proposal") return <><p>Honorarios: {new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(numberValue(data.monthly_fee))}</p><small>Cliente: {text(data.client_name)} · Emitida: {text(data.issue_date) || "—"}</small></>;
    if (item.kind === "assignment") {
      const previous = users.find((entry) => entry.id === text(data.previous_owner_id));
      const next = users.find((entry) => entry.id === text(data.new_owner_id));
      return <><p>{previous?.fullName ?? "Sin responsable previo"} → {next?.fullName ?? "Nuevo responsable"}</p><small>{text(data.change_reason) || "Cambio de responsable comercial"}</small></>;
    }
    if (item.kind === "scheduled") return <><p>{text(data.body_text)}</p><small>Programado para: {text(data.scheduled_for) ? new Date(text(data.scheduled_for)).toLocaleString("es-DO") : "—"}{numberValue(data.recurrence_months) ? ` · Cada ${numberValue(data.recurrence_months)} meses` : ""}</small>{text(data.last_error) && <small>Error: {text(data.last_error)}</small>}</>;
    return <><p>{text(data.client_legal_name) || "Contrato comercial"}</p><small>Versión {numberValue(data.current_version)}{text(data.signature_date) ? ` · Firmado ${new Date(text(data.signature_date)).toLocaleDateString("es-DO")}` : ""}</small></>;
  }

  return <section className="card" style={{ marginTop: 18, marginBottom: 24 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div><small style={{ fontWeight: 800, letterSpacing: ".08em" }}>EXPEDIENTE COMERCIAL</small><h2 style={{ margin: "4px 0" }}>Timeline / Historial integral</h2><p style={{ margin: 0, color: "#667085" }}>Una vista cronológica de comunicaciones, tareas, propuestas, asignaciones, seguimientos y contrato.</p></div>
      <button className="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16}/> {loading ? "Actualizando…" : "Actualizar historial"}</button>
    </div>

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
      <button className={`button ${filter === "all" ? "button-primary" : ""}`} onClick={() => setFilter("all")}>Todo ({items.length})</button>
      {(["communication","task","proposal","scheduled","assignment","activity","contract"] as TimelineKind[]).map((kind) => {
        const count = kind === "communication" ? (meta.communications ?? items.filter((item) => item.kind === kind).length) : items.filter((item) => item.kind === kind).length;
        return <button key={kind} className={`button ${filter === kind ? "button-primary" : ""}`} onClick={() => setFilter(kind)}>{kindLabels[kind]} ({count})</button>;
      })}
    </div>

    {error && <div className="sync-banner sync-error" style={{ marginTop: 16 }}>{error}</div>}
    {loading ? <div className="empty-state" style={{ marginTop: 16 }}><History size={26}/><b>Cargando historial comercial…</b></div> : visible.length === 0 ? <div className="empty-state" style={{ marginTop: 16 }}><History size={26}/><b>No hay eventos para este filtro.</b></div> : <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
      {visible.map((item) => <article key={`${item.kind}-${item.id}`} style={{ display: "grid", gridTemplateColumns: "40px 1fr", gap: 12, border: "1px solid #eaecf0", borderRadius: 14, padding: 14, background: "#fff" }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "#f4f4f5" }}>{item.kind === "communication" && text(item.data.channel) === "email" ? <Mail size={18}/> : icon(item.kind)}</span>
        <div style={{ minWidth: 0 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><b>{title(item)}</b><small>{new Date(item.at).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" })}</small></div><div style={{ marginTop: 5, display: "grid", gap: 3 }}>{detail(item)}</div></div>
      </article>)}
    </div>}
  </section>;
}
