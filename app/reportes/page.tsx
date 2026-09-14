"use client";

import Link from "next/link";
import { AlertTriangle, BarChart3, Download, RefreshCw, Settings2, TrendingUp, UsersRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useCrm } from "@/components/crm-provider";
import { PageHeader } from "@/components/ui";
import { formatCurrency, pipelineStages, stageLabels } from "@/lib/constants";
import type { WeeklyReport } from "@/lib/weekly-report";

const dateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const currentWeek = () => {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { start: dateInput(monday), end: dateInput(sunday) };
};

const formatDay = (value: string) => new Intl.DateTimeFormat("es-DO", { dateStyle: "medium" }).format(new Date(value));
const formatHours = (value: number | null) => value == null ? "—" : value < 24 ? `${value} h` : `${Math.round(value / 24)} días`;
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function WeeklyReportsPage() {
  const { currentUser } = useCrm();
  const initial = currentWeek();
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [seller, setSeller] = useState("");
  const [projectType, setProjectType] = useState("");
  const [source, setSource] = useState("");
  const [stage, setStage] = useState("");
  const [status, setStatus] = useState("");
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [scope, setScope] = useState<"management" | "seller">("seller");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canConfigure = ["superadmin", "gerencia_comercial"].includes(currentUser.role);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    const params = new URLSearchParams({ start, end });
    if (seller) params.set("seller", seller);
    if (projectType) params.set("projectType", projectType);
    if (source) params.set("source", source);
    if (stage) params.set("stage", stage);
    if (status) params.set("status", status);
    try {
      const response = await fetch(`/api/reports/weekly?${params}`, { cache: "no-store", signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No fue posible cargar el reporte.");
      setReport(payload.report); setScope(payload.scope);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(requestError instanceof Error ? requestError.message : "No fue posible cargar el reporte.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [end, projectType, seller, source, stage, start, status]);

  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);

  async function saveSettings(form: FormData) {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/reports/weekly", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          neverContactedBusinessDays: Number(form.get("neverContactedBusinessDays")),
          inactiveDays: Number(form.get("inactiveDays")),
          proposalFollowupDays: Number(form.get("proposalFollowupDays"))
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No fue posible guardar los umbrales.");
      await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No fue posible guardar los umbrales."); }
    finally { setSaving(false); }
  }

  function exportCsv() {
    if (!report) return;
    const rows = [
      ["REPORTE SEMANAL INDEX ONE", `${formatDay(report.range.start)} - ${formatDay(new Date(new Date(report.range.endExclusive).getTime() - 1).toISOString())}`],
      [], ["Indicador", "Total"],
      ["Prospectos nuevos", report.kpis.newProspects], ["Contactados", report.kpis.contacted], ["Nunca contactados", report.kpis.neverContacted],
      ["Movimientos de etapa", report.kpis.stageMovements], ["Sin movimiento", report.kpis.stagnant], ["Seguimientos vencidos", report.kpis.overdueFollowups],
      ["Propuestas generadas", report.kpis.proposalsGenerated], ["Propuestas enviadas", report.kpis.proposalsSent], ["Cierres ganados", report.kpis.won], ["Perdidas", report.kpis.lost],
      [], ["Vendedor", "Cartera", "Contactos", "Reuniones", "Propuestas", "Movimientos", "Ganadas", "Perdidas", "Sin movimiento", "Cobertura próxima acción"],
      ...report.sellers.map((row) => [row.sellerName, row.portfolio, row.contacts, row.meetings, row.proposals, row.movements, row.won, row.lost, row.stagnant, `${row.nextActionCoverage}%`])
    ];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `reporte-semanal-${start}-${end}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  return <>
    <PageHeader eyebrow="Inteligencia comercial" title="Reporte semanal de ventas" description="Avances, estancamientos, contactos, seguimientos y desempeño por vendedor basados en los datos reales del CRM.">
      <button className="button" onClick={() => void load()} disabled={loading}><RefreshCw size={17}/> Actualizar</button>
      <button className="button button-secondary" onClick={exportCsv} disabled={!report}><Download size={17}/> Exportar CSV</button>
    </PageHeader>

    <section className="card report-filters" aria-label="Filtros del reporte">
      <label className="field"><span>Desde</span><input type="date" value={start} onChange={(event) => setStart(event.target.value)}/></label>
      <label className="field"><span>Hasta</span><input type="date" value={end} min={start} onChange={(event) => setEnd(event.target.value)}/></label>
      {scope === "management" && <label className="field"><span>Vendedor</span><select value={seller} onChange={(event) => setSeller(event.target.value)}><option value="">Todos</option>{report?.profiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <label className="field"><span>Tipo</span><select value={projectType} onChange={(event) => setProjectType(event.target.value)}><option value="">Todos</option><option value="comercial">Comercial</option><option value="residencial">Residencial</option></select></label>
      <label className="field"><span>Origen</span><select value={source} onChange={(event) => setSource(event.target.value)}><option value="">Todos</option>{report?.sources.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="field"><span>Etapa</span><select value={stage} onChange={(event) => setStage(event.target.value)}><option value="">Todas</option>{[...pipelineStages, "perdida" as const].map((item) => <option key={item} value={item}>{stageLabels[item]}</option>)}</select></label>
      <label className="field"><span>Estado</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="active">Activo</option><option value="won">Ganado</option><option value="lost">Perdido</option></select></label>
    </section>

    {error && <div className="report-state report-error" role="alert"><AlertTriangle size={18}/>{error}<button className="button compact" onClick={() => void load()}>Reintentar</button></div>}
    {loading && <div className="report-state"><RefreshCw className="spin" size={18}/> Preparando reporte…</div>}
    {!loading && report && <>
      <section className="grid report-kpis">
        <article className="card kpi-card"><div className="kpi-top"><span className="kpi-label">Prospectos nuevos</span><span className="kpi-icon"><UsersRound size={18}/></span></div><div className="kpi-value">{report.kpis.newProspects}</div><div className="kpi-foot">{report.kpis.contacted} contactados esta semana</div></article>
        <article className="card kpi-card"><div className="kpi-top"><span className="kpi-label">Movimientos del Kanban</span><span className="kpi-icon"><TrendingUp size={18}/></span></div><div className="kpi-value">{report.kpis.stageMovements}</div><div className="kpi-foot">{report.executive.advanced} avances registrados</div></article>
        <article className="card kpi-card"><div className="kpi-top"><span className="kpi-label">Propuestas</span><span className="kpi-icon"><BarChart3 size={18}/></span></div><div className="kpi-value">{report.kpis.proposalsGenerated}</div><div className="kpi-foot">{report.kpis.proposalsSent} enviadas</div></article>
        <article className="card kpi-card"><div className="kpi-top"><span className="kpi-label">Cierres ganados</span><span className="kpi-icon"><TrendingUp size={18}/></span></div><div className="kpi-value">{report.kpis.won}</div><div className="kpi-foot">{formatCurrency(report.kpis.wonMonthlyValue)} mensual</div></article>
        <article className="card kpi-card report-risk"><div className="kpi-top"><span className="kpi-label">Nunca contactados</span><span className="kpi-icon"><AlertTriangle size={18}/></span></div><div className="kpi-value">{report.kpis.neverContacted}</div><div className="kpi-foot">Umbral: {report.settings.neverContactedBusinessDays} día(s) hábil(es)</div></article>
        <article className="card kpi-card report-risk"><div className="kpi-top"><span className="kpi-label">Sin movimiento</span><span className="kpi-icon"><AlertTriangle size={18}/></span></div><div className="kpi-value">{report.kpis.stagnant}</div><div className="kpi-foot">Más de {report.settings.inactiveDays} días</div></article>
        <article className="card kpi-card report-risk"><div className="kpi-top"><span className="kpi-label">Seguimientos vencidos</span><span className="kpi-icon"><AlertTriangle size={18}/></span></div><div className="kpi-value">{report.kpis.overdueFollowups}</div><div className="kpi-foot">Requieren atención</div></article>
        <article className="card kpi-card"><div className="kpi-top"><span className="kpi-label">Próximas a cierre</span><span className="kpi-icon"><TrendingUp size={18}/></span></div><div className="kpi-value">{report.kpis.approachingClose}</div><div className="kpi-foot">Negociación, aprobación o contrato</div></article>
      </section>

      <section className="grid report-summary-grid">
        <article className="card"><div className="section-head"><div><h2>Resumen ejecutivo</h2><p>Lectura rápida para la reunión gerencial</p></div></div><div className="report-summary-list"><div><b>{report.executive.advanced}</b><span>movimientos de avance</span></div><div><b>{report.kpis.meetingsHeld}/{report.kpis.meetingsScheduled}</b><span>reuniones realizadas/agendadas</span></div><div><b>{report.kpis.inNegotiation}</b><span>oportunidades en negociación</span></div><div><b>{report.executive.atRisk}</b><span>oportunidades con alertas</span></div><div><b>{report.kpis.pendingNextActions}</b><span>próximas acciones definidas</span></div><div><b>{report.kpis.lost}</b><span>oportunidades perdidas</span></div></div></article>
        {canConfigure && <article className="card report-settings"><div className="section-head"><div><h2>Umbrales de alerta</h2><p>Configuración administrable</p></div><Settings2 size={18}/></div><form action={saveSettings} className="report-settings-form"><label className="field"><span>Nunca contactado (días hábiles)</span><input name="neverContactedBusinessDays" type="number" min="0" max="30" defaultValue={report.settings.neverContactedBusinessDays}/></label><label className="field"><span>Sin movimiento (días)</span><input name="inactiveDays" type="number" min="1" max="365" defaultValue={report.settings.inactiveDays}/></label><label className="field"><span>Propuesta sin seguimiento (días)</span><input name="proposalFollowupDays" type="number" min="1" max="90" defaultValue={report.settings.proposalFollowupDays}/></label><button className="button button-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar umbrales"}</button></form></article>}
      </section>

      <section className="card report-table-card"><div className="section-head"><div><h2>Oportunidades que requieren atención</h2><p>Sin contacto, estancadas, vencidas o sin próxima acción</p></div><span className="count">{report.attention.length}</span></div><div className="table-wrap"><table className="table"><thead><tr><th>Prospecto</th><th>Vendedor</th><th>Etapa</th><th>Última actividad</th><th>Alertas</th></tr></thead><tbody>{report.attention.map((row) => <tr key={row.opportunityId}><td><Link href={`/prospectos/${row.accountId}`}><strong>{row.accountName}</strong></Link></td><td>{row.sellerName}</td><td><span className={`stage-pill stage-${row.stage}`}>{stageLabels[row.stage]}</span></td><td>{formatDay(row.lastActivityAt)}</td><td><div className="report-alerts">{row.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div></td></tr>)}{!report.attention.length && <tr><td colSpan={5} className="empty-cell">No hay alertas para los filtros seleccionados.</td></tr>}</tbody></table></div></section>

      <section className="card report-table-card"><div className="section-head"><div><h2>Desempeño por vendedor</h2><p>Cartera, actividad y cobertura de seguimiento</p></div></div><div className="table-wrap"><table className="table sales-table"><thead><tr><th>Vendedor</th><th>Cartera</th><th>Contactos</th><th>Reuniones</th><th>Propuestas</th><th>Movimientos</th><th>Ganadas/Perdidas</th><th>Sin movimiento</th><th>Próxima acción</th></tr></thead><tbody>{report.sellers.map((row) => <tr key={row.sellerId}><td><strong>{row.sellerName}</strong><small>{row.active} activas</small></td><td>{row.portfolio}</td><td>{row.contacts}</td><td>{row.meetings}</td><td>{row.proposals}</td><td>{row.movements}</td><td><span className="positive">{row.won}</span> / <span className="negative">{row.lost}</span></td><td>{row.stagnant}</td><td><strong>{row.nextActionCoverage}%</strong></td></tr>)}</tbody></table></div></section>

      <section className="card report-table-card"><div className="section-head"><div><h2>Auditoría de movimientos del Kanban</h2><p>Etapa anterior, nueva, responsable, autor y tiempo en etapa</p></div><span className="count">{report.movements.length}</span></div><div className="table-wrap"><table className="table"><thead><tr><th>Fecha</th><th>Prospecto</th><th>Movimiento</th><th>Vendedor</th><th>Realizado por</th><th>Tiempo anterior</th><th>Nota</th></tr></thead><tbody>{report.movements.map((row) => <tr key={row.id}><td>{formatDay(row.movedAt)}</td><td><Link href={`/prospectos/${row.accountId}`}><strong>{row.accountName}</strong></Link></td><td>{row.previousStage ? stageLabels[row.previousStage] : "Inicio"} → <b>{stageLabels[row.newStage]}</b></td><td>{row.sellerName}</td><td>{row.changedByName}</td><td>{formatHours(row.previousStageHours)}</td><td>{row.note || "—"}</td></tr>)}{!report.movements.length && <tr><td colSpan={7} className="empty-cell">No hubo movimientos durante el período.</td></tr>}</tbody></table></div></section>
    </>}
  </>;
}
