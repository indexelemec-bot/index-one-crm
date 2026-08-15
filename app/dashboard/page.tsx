"use client";
import Link from "next/link";
import { ArrowRight, CalendarClock, CircleDollarSign, FileText, Target, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useCrm } from "@/components/crm-provider";
import { PageHeader, StagePill } from "@/components/ui";
import { canSeeOpportunity } from "@/lib/permissions";
import { formatCurrency, stageClosingProbability } from "@/lib/constants";
import { greetingForHour } from "@/lib/greeting";

export default function Dashboard() {
  const { opportunities, accounts, tasks, proposals, currentUser } = useCrm();
  const [greeting, setGreeting] = useState("Bienvenido");
  useEffect(() => {
    const updateGreeting = () => setGreeting(greetingForHour(new Date().getHours()));
    updateGreeting();
    const timer = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const visible = opportunities.filter((o) => canSeeOpportunity(currentUser, o) && !["cliente_activo", "perdida"].includes(o.stage));
  const pipeline = visible.reduce((sum, item) => sum + (Number.isFinite(item.monthlyFee) ? item.monthlyFee : 0), 0);
  const probabilityFor = (stage: keyof typeof stageClosingProbability) => stageClosingProbability[stage] ?? 0;
  const prioritized = [...visible].sort((a, b) => probabilityFor(b.stage) - probabilityFor(a.stage) || (b.monthlyFee ?? 0) - (a.monthlyFee ?? 0) || new Date(a.nextActionAt).getTime() - new Date(b.nextActionAt).getTime());
  const closest = prioritized[0];
  const pending = tasks.filter((t) => t.status !== "completada" && visible.some((o) => o.id === t.opportunityId));
  const account = (id: string) => accounts.find((a) => a.id === id);
  const firstName = currentUser?.fullName?.trim()?.split(/\s+/)[0] || "Usuario";

  return <><PageHeader eyebrow="Centro comercial B2B" title={`${greeting}, ${firstName}`} description="Prioridades, valor del embudo y próximas acciones para vender soluciones de administración condominial."/>
    <section className="grid kpi-grid"><article className="card kpi-card"><div className="kpi-top"><span className="kpi-label">Oportunidades activas</span><span className="kpi-icon"><Target size={19}/></span></div><div className="kpi-value">{visible.length}</div><div className="kpi-foot">+2 durante los últimos 30 días</div></article><article className="card kpi-card"><div className="kpi-top"><span className="kpi-label">Valor mensual del embudo</span><span className="kpi-icon"><CircleDollarSign size={19}/></span></div><div className="kpi-value">{formatCurrency(pipeline)}</div><div className="kpi-foot">{formatCurrency(pipeline * 12)} anual potencial · 100% del valor prospectado</div></article><article className="card kpi-card"><div className="kpi-top"><span className="kpi-label">Más cerca del cierre</span><span className="kpi-icon"><TrendingUp size={19}/></span></div><div className="kpi-value">{closest ? `${probabilityFor(closest.stage)}%` : "—"}</div><div className="kpi-foot">{closest ? `${account(closest.accountId)?.name ?? "Prospecto"} · avance según etapa` : "Sin oportunidades activas"}</div></article><article className="card kpi-card"><div className="kpi-top"><span className="kpi-label">Seguimientos pendientes</span><span className="kpi-icon"><CalendarClock size={19}/></span></div><div className="kpi-value">{pending.length}</div><div className="kpi-foot">{pending.filter((t) => t.status === "vencida").length} requiere atención hoy</div></article></section>
    <section className="grid dashboard-grid"><div className="card"><div className="section-head"><div><h2>Oportunidades prioritarias</h2><p>Ordenadas por cercanía al cierre, valor y próxima acción</p></div><Link className="text-link" href="/embudo">Ver embudo <ArrowRight size={13}/></Link></div><div className="table-wrap"><table className="table"><thead><tr><th>Cuenta</th><th>Necesidad</th><th>Etapa</th><th>Avance</th><th>Honorarios</th><th>Próxima acción</th></tr></thead><tbody>{prioritized.slice(0,6).map((o) => { const acc = account(o.accountId); return <tr key={o.id}><td><Link href={`/prospectos/${o.accountId}`}><strong>{acc?.name ?? "Prospecto sin cuenta vinculada"}</strong><small>{acc ? `${acc.units} unidades · ${acc.sector}` : "Revisar relación de datos"}</small></Link></td><td>{o.primaryProblem}</td><td><StagePill stage={o.stage}/></td><td><strong>{probabilityFor(o.stage)}%</strong><small>cercanía al cierre</small></td><td className="amount">{formatCurrency(Number.isFinite(o.monthlyFee) ? o.monthlyFee : 0)}</td><td><strong>{o.nextAction || "Sin próxima acción"}</strong><small>{o.nextActionAt ? new Date(o.nextActionAt).toLocaleDateString("es-DO",{day:"2-digit",month:"short"}) : "Sin fecha"}</small></td></tr>})}</tbody></table></div></div>
      <aside className="grid"><div className="card"><div className="section-head"><div><h2>Próximas acciones</h2><p>Lo que mueve cada oportunidad</p></div><Link className="text-link" href="/tareas">Ver todas</Link></div><div className="next-list">{pending.slice(0,4).map((task) => { const opportunity=opportunities.find((o)=>o.id===task.opportunityId); if (!opportunity) return null; const acc = account(opportunity.accountId); const date=new Date(task.dueAt); return <div className="next-item" key={task.id}><div className="date-box"><b>{Number.isNaN(date.getTime()) ? "—" : date.getDate()}</b><small>{Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("es-DO",{month:"short"})}</small></div><div><strong><span className={`priority priority-${task.priority}`}/>{task.title}</strong><p>{acc?.name ?? "Prospecto"}</p></div></div>})}</div></div><div className="card"><div className="section-head"><div><h2>Propuestas</h2><p>Actividad comercial reciente</p></div><FileText size={19} color="#f47721"/></div><div className="card-pad" style={{paddingTop:0}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span className="kpi-label">Generadas</span><b>{proposals.length}</b></div><div className="metric-bar"><span style={{width:"66%"}}/></div><div className="pipeline-mini"><span style={{height:"35%"}}/><span style={{height:"48%"}}/><span className="hot" style={{height:"78%"}}/><span style={{height:"62%"}}/><span className="hot" style={{height:"90%"}}/><span style={{height:"70%"}}/></div></div></div></aside></section>
  </>;
}
