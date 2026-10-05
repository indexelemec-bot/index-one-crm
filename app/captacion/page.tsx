"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, CircleDashed, Clock3, Filter, MousePointerClick } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type SessionRow = {
  id: string;
  status: "started" | "completed" | "abandoned";
  environment: string;
  current_step: number;
  total_steps: number;
  answers: Record<string, unknown>;
  tracking: Record<string, unknown>;
  account_id: string | null;
  opportunity_id: string | null;
  started_at: string;
  last_seen_at: string;
  completed_at: string | null;
};

function effectiveStatus(row: SessionRow) {
  if (row.status === "started" && Date.now() - new Date(row.last_seen_at).getTime() > 24 * 60 * 60 * 1000) return "abandoned";
  return row.status;
}

function answer(row: SessionRow, key: string) {
  const value = row.answers?.[key];
  return Array.isArray(value) ? value.join(" · ") : String(value ?? "—");
}

export default function CaptacionPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [campaign, setCampaign] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setExpanded(new URLSearchParams(window.location.search).get("session"));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    let cancelled = false;
    void (async () => {
      const client = createClient();
      if (!client) return;
      const { data, error: queryError } = await client
        .from("marketing_form_sessions")
        .select("id,status,environment,current_step,total_steps,answers,tracking,account_id,opportunity_id,started_at,last_seen_at,completed_at")
        .order("started_at", { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (queryError) setError(queryError.message);
      else setSessions((data ?? []) as SessionRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const campaigns = useMemo(() => Array.from(new Set(sessions.map((row) => String(row.tracking?.utmCampaign || "Directo")))).sort(), [sessions]);
  const filtered = useMemo(() => sessions.filter((row) => {
    const rowStatus = effectiveStatus(row);
    const rowCampaign = String(row.tracking?.utmCampaign || "Directo");
    return (status === "all" || rowStatus === status) && (campaign === "all" || rowCampaign === campaign);
  }), [campaign, sessions, status]);
  const completed = sessions.filter((row) => effectiveStatus(row) === "completed").length;
  const abandoned = sessions.filter((row) => effectiveStatus(row) === "abandoned").length;
  const conversion = sessions.length ? Math.round((completed / sessions.length) * 100) : 0;

  return <>
    <PageHeader eyebrow="Captación y conversión" title="Formularios de Index Condo" description="Seguimiento de diagnósticos iniciados, completados y abandonados, con atribución por fuente y campaña." />
    <div className="grid kpi-grid capture-kpis">
      <Metric icon={<MousePointerClick />} label="Iniciados" value={sessions.length} note="Sesiones únicas" />
      <Metric icon={<CheckCircle2 />} label="Completados" value={completed} note="Guardados y procesados" />
      <Metric icon={<Clock3 />} label="Abandonados" value={abandoned} note="Más de 24 h sin actividad" />
      <Metric icon={<CircleDashed />} label="Conversión" value={`${conversion}%`} note="Completados / iniciados" />
    </div>
    <section className="card capture-filters">
      <span><Filter size={17} /> Filtrar resultados</span>
      <label><small>Estado</small><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos</option><option value="started">En progreso</option><option value="completed">Completados</option><option value="abandoned">Abandonados</option></select></label>
      <label><small>Campaña</small><select value={campaign} onChange={(event) => setCampaign(event.target.value)}><option value="all">Todas</option>{campaigns.map((item) => <option key={item}>{item}</option>)}</select></label>
    </section>
    {loading && <div className="report-state"><CircleDashed className="spin" /> Cargando formularios…</div>}
    {error && <div className="report-state report-error">No fue posible cargar la captación: {error}</div>}
    {!loading && !error && <section className="card table-wrap">
      <div className="section-head"><div><h2>Actividad reciente</h2><p>{filtered.length} formularios en la vista actual</p></div></div>
      <table className="table capture-table"><thead><tr><th>Proyecto / contacto</th><th>Estado</th><th>Avance</th><th>Fuente / campaña</th><th>Última actividad</th><th>CRM</th><th /></tr></thead><tbody>
        {filtered.map((row) => { const rowStatus = effectiveStatus(row); return <tr key={row.id}>
          <td><strong>{answer(row, "projectName")}</strong><small>{answer(row, "contactName")} · {answer(row, "phone")}</small></td>
          <td><span className={`status-pill capture-${rowStatus}`}>{rowStatus === "completed" ? "Completado" : rowStatus === "abandoned" ? "Abandonado" : "En progreso"}</span><small>{row.environment}</small></td>
          <td><strong>{Math.round((row.current_step / row.total_steps) * 100)}%</strong><small>Paso {row.current_step} de {row.total_steps}</small></td>
          <td><strong>{String(row.tracking?.utmSource || "Directo")}</strong><small>{String(row.tracking?.utmCampaign || "Sin campaña")}</small></td>
          <td>{new Date(row.last_seen_at).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" })}</td>
          <td>{row.account_id ? <Link className="text-link" href={`/prospectos/${row.account_id}`}>Abrir expediente <ArrowUpRight size={12} /></Link> : <small>{rowStatus === "completed" ? "Preview sin sincronizar" : "Pendiente"}</small>}</td>
          <td><button className="button compact" onClick={() => setExpanded(expanded === row.id ? null : row.id)}>{expanded === row.id ? "Cerrar" : "Respuestas"}</button></td>
        </tr>;
        })}
      </tbody></table>
      {filtered.length === 0 && <div className="empty-state"><b>No hay formularios con estos filtros</b><p>Prueba otro estado o campaña.</p></div>}
    </section>}
    {expanded && (() => { const row = sessions.find((item) => item.id === expanded); if (!row) return null; return <section className="card detail-section capture-detail"><span className="eyebrow">Respuestas originales</span><h2>{answer(row, "projectName")}</h2><div className="response-grid">{Object.entries(row.answers ?? {}).filter(([, value]) => value !== "" && value !== null && value !== undefined).map(([key, value]) => <div key={key}><small>{key.replace(/([A-Z])/g, " $1")}</small><b>{Array.isArray(value) ? value.join(" · ") : String(value)}</b></div>)}</div></section>; })()}
  </>;
}

function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string | number; note: string }) {
  return <article className="card kpi-card"><div className="kpi-top"><span className="kpi-label">{label}</span><span className="kpi-icon">{icon}</span></div><div className="kpi-value">{value}</div><div className="kpi-foot">{note}</div></article>;
}
