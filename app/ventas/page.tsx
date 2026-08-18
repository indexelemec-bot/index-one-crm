"use client";

import { BadgeCheck, Banknote, CircleDollarSign, Download, ReceiptText, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui";
import { useCrm } from "@/components/crm-provider";
import { formatCurrency } from "@/lib/constants";
import type { CommissionStatus } from "@/types/domain";

const statusLabels: Record<CommissionStatus, string> = { pendiente: "Pendiente", pagada: "Pagada" };
type StatusFilter = "todas" | CommissionStatus;

export default function VentasPage() {
  const { salesReports, commissionHistory, accounts, users, currentUser, markCommissionPaid } = useCrm();
  const manager = ["superadmin", "gerencia_comercial", "administracion"].includes(currentUser.role);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [payingId, setPayingId] = useState("");

  const visible = useMemo(
    () => manager ? salesReports : salesReports.filter((item) => item.sellerId === currentUser.id),
    [manager, salesReports, currentUser.id]
  );
  const periodReports = useMemo(() => visible.filter((item) => item.closedAt.slice(0, 7) === period), [visible, period]);
  const reports = useMemo(
    () => periodReports.filter((item) => statusFilter === "todas" || item.commissionStatus === statusFilter),
    [periodReports, statusFilter]
  );
  const paidInPeriod = useMemo(() => visible.filter((item) => item.commissionPaidAt?.slice(0, 7) === period), [visible, period]);
  const monthly = periodReports.reduce((sum, item) => sum + item.finalFee, 0);
  const payable = periodReports.filter((item) => item.commissionStatus === "pendiente").reduce((sum, item) => sum + item.commissionAmount, 0);
  const paid = paidInPeriod.reduce((sum, item) => sum + item.commissionAmount, 0);
  const ranking = users.map((user) => {
    const rows = periodReports.filter((item) => item.sellerId === user.id);
    return { user, closures: rows.length, commissions: rows.reduce((sum, item) => sum + item.commissionAmount, 0) };
  }).filter((item) => item.closures).sort((a, b) => b.closures - a.closures || b.commissions - a.commissions);

  async function payCommission(reportId: string) {
    setPayingId(reportId);
    await markCommissionPaid(reportId);
    setPayingId("");
  }

  function exportCsv() {
    const rows = [
      ["Cliente", "Vendedor", "Fecha cierre", "Monto inicial", "Monto final", "Comisión", "Estado", "Fecha pago", "Marcada por"],
      ...reports.map((report) => [
        accounts.find((item) => item.id === report.accountId)?.name ?? "",
        users.find((item) => item.id === report.sellerId)?.fullName ?? "",
        report.closedAt.slice(0, 10), report.initialFee, report.finalFee, report.commissionAmount,
        statusLabels[report.commissionStatus], report.commissionPaidAt?.slice(0, 10) ?? "",
        users.find((item) => item.id === report.commissionPaidBy)?.fullName ?? ""
      ])
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `comisiones-${period}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return <>
    <PageHeader eyebrow="Cierres auditables" title="Ventas y comisiones" description="Controla comisiones pendientes y pagadas con fecha, responsable e historial de cada pago.">
      <div className="page-actions">
        <input className="filter-select" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
        <select className="filter-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} aria-label="Filtrar comisiones por estado">
          <option value="todas">Todas las comisiones</option><option value="pendiente">Pendientes</option><option value="pagada">Pagadas</option>
        </select>
        <button className="button" onClick={exportCsv}><Download size={16} /> Exportar reporte</button>
      </div>
    </PageHeader>
    <div className="grid kpi-grid">
      <Kpi icon={<ReceiptText />} label="Cierres del período" value={String(periodReports.length)} />
      <Kpi icon={<Banknote />} label="Ingreso mensual cerrado" value={formatCurrency(monthly)} />
      <Kpi icon={<BadgeCheck />} label="Comisiones pendientes" value={formatCurrency(payable)} />
      <Kpi icon={<CircleDollarSign />} label="Comisiones pagadas" value={formatCurrency(paid)} />
    </div>
    {ranking.length > 0 && <section className="card seller-ranking">
      <div className="section-head"><div><h2>Desempeño por vendedor</h2><p>Cierres y comisiones generadas durante {period}</p></div><Trophy size={20} color="#f47721" /></div>
      <div className="ranking-grid">{ranking.map((item, index) => <article key={item.user.id}><span>#{index + 1}</span><div><b>{item.user.fullName}</b><small>{item.closures} {item.closures === 1 ? "cierre" : "cierres"} · {formatCurrency(item.commissions)} en comisiones</small></div></article>)}</div>
    </section>}
    <div className="card table-wrap">
      <table className="table sales-table">
        <thead><tr><th>Cliente / contrato</th><th>Vendedor</th><th>Cierre</th><th>Inicial</th><th>Final</th><th>Variación</th><th>Comisión 50%</th><th>Estado y auditoría</th>{manager && <th>Control</th>}</tr></thead>
        <tbody>{reports.map((report) => {
          const account = accounts.find((item) => item.id === report.accountId);
          const seller = users.find((item) => item.id === report.sellerId);
          const paidBy = users.find((item) => item.id === report.commissionPaidBy);
          const history = commissionHistory.filter((item) => item.salesReportId === report.id);
          const variation = report.initialFee ? ((report.finalFee - report.initialFee) / report.initialFee) * 100 : 0;
          return <tr key={report.id}>
            <td><strong>{account?.name ?? "Cuenta"}</strong><small>{report.contractReference}</small></td>
            <td><strong>{seller?.fullName ?? "Vendedor"}</strong></td>
            <td>{new Date(report.closedAt).toLocaleDateString("es-DO")}</td>
            <td className="amount">{formatCurrency(report.initialFee)}</td><td className="amount">{formatCurrency(report.finalFee)}</td>
            <td className={variation < 0 ? "negative" : "positive"}>{variation.toFixed(1)}%</td><td className="amount">{formatCurrency(report.commissionAmount)}</td>
            <td><span className={`status-pill commission-${report.commissionStatus}`}>{statusLabels[report.commissionStatus]}</span>
              {report.commissionPaidAt && <small>Pago: {new Date(report.commissionPaidAt).toLocaleString("es-DO")} · {paidBy?.fullName ?? "Usuario no disponible"}</small>}
              {history.length > 0 && <details className="commission-audit"><summary>Ver auditoría ({history.length})</summary>{history.map((entry) => <small key={entry.id}>{statusLabels[entry.previousStatus]} → {statusLabels[entry.newStatus]} · {users.find((user) => user.id === entry.changedBy)?.fullName ?? "Usuario"} · {new Date(entry.changedAt).toLocaleString("es-DO")}</small>)}</details>}
            </td>
            {manager && <td>{report.commissionStatus === "pendiente" && <button className="button button-primary compact" disabled={payingId === report.id} onClick={() => void payCommission(report.id)}>{payingId === report.id ? "Guardando…" : "Marcar como pagada"}</button>}</td>}
          </tr>;
        })}</tbody>
      </table>
      {reports.length === 0 && <div className="empty-state"><b>No hay comisiones con este filtro</b><p>Cambia el mes o el estado para consultar otros registros.</p></div>}
    </div>
  </>;
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <article className="card kpi-card"><div className="kpi-top"><span className="kpi-label">{label}</span><span className="kpi-icon">{icon}</span></div><div className="kpi-value">{value}</div><div className="kpi-foot">Período seleccionado</div></article>;
}
