"use client";

import { BadgeCheck, Banknote, CircleDollarSign, Download, ReceiptText, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { useCrm } from "@/components/crm-provider";
import { PageHeader } from "@/components/ui";
import { formatCurrency } from "@/lib/constants";
import type { SalesReport, UserProfile } from "@/types/domain";

const statusLabels = { proyectada: "Proyectada", ganada: "Pendiente de primer cobro", pagadera: "Lista para pagar", pagada: "Pagada", revertida: "Revertida" };

export default function VentasPage() {
  const { salesReports, accounts, users, currentUser, confirmFirstPayment, markCommissionPaid } = useCrm();
  const manager = ["superadmin", "gerencia_comercial", "administracion"].includes(currentUser.role);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const visible = useMemo(() => manager ? salesReports : salesReports.filter((item) => item.sellerId === currentUser.id), [manager, salesReports, currentUser.id]);
  const pendingCommissions = useMemo(() => visible.filter((item) => !["pagada", "revertida"].includes(item.commissionStatus)).sort((a, b) => a.closedAt.localeCompare(b.closedAt)), [visible]);
  const periodReports = useMemo(() => visible.filter((item) => item.closedAt.slice(0, 7) === period), [visible, period]);
  const paidInPeriod = useMemo(() => visible.filter((item) => item.commissionPaidAt?.slice(0, 7) === period), [visible, period]);
  const monthly = periodReports.reduce((sum, item) => sum + item.finalFee, 0);
  const totalPending = pendingCommissions.reduce((sum, item) => sum + item.commissionAmount, 0);
  const paid = paidInPeriod.reduce((sum, item) => sum + item.commissionAmount, 0);
  const ranking = users.map((user) => {
    const rows = periodReports.filter((item) => item.sellerId === user.id);
    return { user, closures: rows.length, commissions: rows.reduce((sum, item) => sum + item.commissionAmount, 0) };
  }).filter((item) => item.closures).sort((a, b) => b.closures - a.closures || b.commissions - a.commissions);

  function exportCsv() {
    const rows = [
      ["Cliente", "Vendedor", "Fecha cierre", "Monto inicial", "Monto final", "Comisión", "Estado", "Fecha pago"],
      ...periodReports.map((report) => [accounts.find((item) => item.id === report.accountId)?.name ?? "", users.find((item) => item.id === report.sellerId)?.fullName ?? "", report.closedAt.slice(0, 10), report.initialFee, report.finalFee, report.commissionAmount, statusLabels[report.commissionStatus], report.commissionPaidAt?.slice(0, 10) ?? ""]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `cierres-${period}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return <>
    <PageHeader eyebrow="Cierres auditables" title="Ventas y comisiones" description="Las comisiones pendientes permanecen visibles hasta ser pagadas. El reporte de cierres se consulta por mes.">
      <div className="page-actions"><input className="filter-select" type="month" value={period} onChange={(event) => setPeriod(event.target.value)}/><button className="button" onClick={exportCsv}><Download size={16}/> Exportar cierres del mes</button></div>
    </PageHeader>
    <div className="grid kpi-grid"><Kpi icon={<ReceiptText/>} label="Cierres del mes" value={String(periodReports.length)}/><Kpi icon={<Banknote/>} label="Ingreso cerrado del mes" value={formatCurrency(monthly)}/><Kpi icon={<BadgeCheck/>} label="Comisiones pendientes totales" value={formatCurrency(totalPending)}/><Kpi icon={<CircleDollarSign/>} label="Comisiones pagadas este mes" value={formatCurrency(paid)}/></div>

    <section className="card table-wrap"><div className="section-head"><div><h2>Comisiones pendientes de pago</h2><p>Todas las comisiones abiertas, sin importar el mes de cierre, permanecen aquí hasta marcarse pagadas.</p></div><span className="count">{pendingCommissions.length}</span></div>
      <SalesTable reports={pendingCommissions} users={users} accountName={(id) => accounts.find((item) => item.id === id)?.name} manager={manager} confirmFirstPayment={confirmFirstPayment} markCommissionPaid={markCommissionPaid}/>
      {pendingCommissions.length === 0 && <div className="empty-state"><BadgeCheck size={30}/><b>No hay comisiones pendientes</b><p>Todas las comisiones registradas han sido pagadas o revertidas.</p></div>}
    </section>

    {ranking.length > 0 && <section className="card seller-ranking"><div className="section-head"><div><h2>Desempeño por vendedor</h2><p>Cierres generados durante {period}</p></div><Trophy size={20} color="#f47721"/></div><div className="ranking-grid">{ranking.map((item, index) => <article key={item.user.id}><span>#{index + 1}</span><div><b>{item.user.fullName}</b><small>{item.closures} {item.closures === 1 ? "cierre" : "cierres"} · {formatCurrency(item.commissions)} en comisiones</small></div></article>)}</div></section>}

    <section className="card table-wrap"><div className="section-head"><div><h2>Reporte de cierres del mes</h2><p>Clientes cerrados en {period}, incluyendo comisiones pendientes y pagadas.</p></div><span className="count">{periodReports.length}</span></div>
      <SalesTable reports={periodReports} users={users} accountName={(id) => accounts.find((item) => item.id === id)?.name} manager={manager} confirmFirstPayment={confirmFirstPayment} markCommissionPaid={markCommissionPaid}/>
      {periodReports.length === 0 && <div className="empty-state"><b>No hay cierres en este mes</b><p>Cambia el mes para consultar el histórico de clientes cerrados.</p></div>}
    </section>
  </>;
}

function SalesTable({ reports, users, accountName, manager, confirmFirstPayment, markCommissionPaid }: {
  reports: SalesReport[]; users: UserProfile[]; accountName: (id: string) => string | undefined; manager: boolean;
  confirmFirstPayment: (id: string) => void; markCommissionPaid: (id: string) => void;
}) {
  if (reports.length === 0) return null;
  return <table className="table sales-table"><thead><tr><th>Cliente / contrato</th><th>Vendedor</th><th>Cierre</th><th>Inicial</th><th>Final</th><th>Variación</th><th>Comisión 50%</th><th>Estado</th>{manager && <th>Control</th>}</tr></thead><tbody>{reports.map((report) => {
    const seller = users.find((item) => item.id === report.sellerId);
    const variation = report.initialFee ? ((report.finalFee - report.initialFee) / report.initialFee) * 100 : 0;
    return <tr key={report.id}><td><strong>{accountName(report.accountId) ?? "Cuenta"}</strong><small>{report.contractReference}</small></td><td><strong>{seller?.fullName ?? "Vendedor"}</strong></td><td>{new Date(report.closedAt).toLocaleDateString("es-DO")}</td><td className="amount">{formatCurrency(report.initialFee)}</td><td className="amount">{formatCurrency(report.finalFee)}</td><td className={variation < 0 ? "negative" : "positive"}>{variation.toFixed(1)}%</td><td className="amount">{formatCurrency(report.commissionAmount)}</td><td><span className={`status-pill commission-${report.commissionStatus}`}>{statusLabels[report.commissionStatus]}</span>{report.commissionPaidAt && <small>Pagada: {new Date(report.commissionPaidAt).toLocaleDateString("es-DO")}</small>}</td>{manager && <td>{report.commissionStatus === "ganada" && <button className="button compact" onClick={() => confirmFirstPayment(report.id)}>Confirmar primer cobro</button>}{report.commissionStatus === "pagadera" && <button className="button button-primary compact" onClick={() => markCommissionPaid(report.id)}>Marcar pagada</button>}</td>}</tr>;
  })}</tbody></table>;
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <article className="card kpi-card"><div className="kpi-top"><span className="kpi-label">{label}</span><span className="kpi-icon">{icon}</span></div><div className="kpi-value">{value}</div><div className="kpi-foot">Información actualizada del CRM</div></article>;
}
