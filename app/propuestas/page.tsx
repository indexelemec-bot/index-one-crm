"use client";

import { Download, FileCheck2, FileText, History, Plus, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCrm } from "@/components/crm-provider";
import { Modal, PageHeader } from "@/components/ui";
import { formatCurrency } from "@/lib/constants";
import { selectComparableReferences } from "@/lib/reference-matching";
import type { Proposal, ProposalFileFormat } from "@/types/domain";

function proposalHistory(proposals: Proposal[], opportunityId: string) {
  return proposals.filter((proposal) => proposal.opportunityId === opportunityId).sort((a, b) => a.version - b.version);
}

function variationLabel(proposal: Proposal, history: Proposal[]) {
  const initial = history[0]?.monthlyFee ?? proposal.monthlyFee;
  const difference = proposal.monthlyFee - initial;
  if (!difference) return proposal.version === 1 ? "Monto inicial" : "Sin variación";
  const percentage = initial ? (difference / initial) * 100 : 0;
  return `${difference > 0 ? "+" : "-"}${formatCurrency(Math.abs(difference))} (${difference > 0 ? "+" : ""}${percentage.toFixed(1)}%)`;
}

export default function PropuestasPage() {
  const { proposals, opportunities, accounts, references, addProposal, updateOpportunity } = useCrm();
  const [open, setOpen] = useState(false);
  const [opportunityId, setOpportunityId] = useState("");
  const [fee, setFee] = useState(36000);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<string[]>([]);
  const [format, setFormat] = useState<ProposalFileFormat>("pdf");
  const [changeReason, setChangeReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const opportunity = opportunities.find((item) => item.id === opportunityId);
  const account = accounts.find((item) => item.id === opportunity?.accountId);
  const history = useMemo(() => proposalHistory(proposals, opportunityId), [proposals, opportunityId]);
  const previous = history.at(-1);
  const initial = history[0];
  const priceChanged = Boolean(previous && previous.monthlyFee !== fee);
  const suggestions = useMemo(() => account ? selectComparableReferences(account, references, 6) : [], [account, references]);
  const orderedProposals = useMemo(() => [...proposals].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)), [proposals]);

  function selectOpportunity(id: string) {
    setOpportunityId(id);
    const selectedOpportunity = opportunities.find((item) => item.id === id);
    const selectedHistory = proposalHistory(proposals, id);
    setFee(selectedHistory.at(-1)?.monthlyFee || selectedOpportunity?.monthlyFee || 36000);
    setChangeReason("");
  }

  useEffect(() => {
    const incoming = new URLSearchParams(window.location.search).get("nueva");
    if (incoming) { selectOpportunity(incoming); setOpen(true); }
    // The query string is only used to seed the modal when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunities]);

  useEffect(() => {
    if (account) setSelected(selectComparableReferences(account, references, 3).map((reference) => reference.id));
  }, [account, references]);

  function start() {
    const next = opportunities.find((item) => !["cliente_activo", "perdida"].includes(item.stage));
    selectOpportunity(next?.id ?? "");
    setFormat("pdf");
    setOpen(true);
  }

  async function generate() {
    if (!account || !opportunity || selected.length !== 3 || (priceChanged && !changeReason.trim())) return;
    setLoading(true);
    try {
      const chosen = selected.map((id) => references.find((reference) => reference.id === id)!);
      const response = await fetch("/api/proposals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, clientName: account.name, monthlyFee: fee, issueDate: date, referenceIds: selected, references: chosen, format })
      });
      if (!response.ok) throw new Error("generation");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `propuesta-index-${account.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
      addProposal({
        id: `p${Date.now()}`,
        opportunityId,
        version: history.length + 1,
        clientName: account.name,
        issueDate: date,
        monthlyFee: fee,
        referenceIds: selected,
        status: "generada",
        generatedAt: new Date().toISOString(),
        fileFormat: format,
        changeReason: changeReason.trim() || undefined
      });
      updateOpportunity(opportunityId, { monthlyFee: fee, stage: opportunity.stage === "propuesta" ? "negociacion" : opportunity.stage });
      setToast(`Versión ${history.length + 1} generada en ${format === "pdf" ? "PDF" : "Word"} y registrada en el historial`);
      setOpen(false);
      setTimeout(() => setToast(""), 4000);
    } finally { setLoading(false); }
  }

  function toggle(id: string) {
    setSelected((values) => values.includes(id) ? values.filter((value) => value !== id) : values.length < 3 ? [...values, id] : values);
  }

  return <>
    <PageHeader eyebrow="Plantilla corporativa bloqueada" title="Propuestas comerciales" description="Genera Word o PDF y conserva cada versión para seguir la negociación y sus variaciones de precio.">
      <button className="button button-primary" onClick={start}><Plus size={18}/> Generar propuesta</button>
    </PageHeader>

    <div className="card table-wrap">
      <table className="table proposal-history-table">
        <thead><tr><th>Cliente</th><th>Versión</th><th>Fecha</th><th>Honorarios</th><th>Variación vs. inicial</th><th>Motivo</th><th>Archivo</th></tr></thead>
        <tbody>{orderedProposals.map((proposal) => {
          const versions = proposalHistory(proposals, proposal.opportunityId);
          const variation = proposal.monthlyFee - (versions[0]?.monthlyFee ?? proposal.monthlyFee);
          return <tr key={proposal.id}>
            <td><strong>{proposal.clientName}</strong><small><History size={11}/> {versions.length} {versions.length === 1 ? "versión" : "versiones"}</small></td>
            <td><span className="version-badge">v{proposal.version}</span></td>
            <td>{new Date(`${proposal.issueDate}T12:00:00`).toLocaleDateString("es-DO")}</td>
            <td className="amount">{formatCurrency(proposal.monthlyFee)}</td>
            <td><span className={`price-variation ${variation < 0 ? "discount" : variation > 0 ? "increase" : "initial"}`}>{variationLabel(proposal, versions)}</span></td>
            <td>{proposal.changeReason || <span className="muted-copy">Primera propuesta</span>}</td>
            <td><span className="file-format"><FileText size={13}/>{proposal.fileFormat === "pdf" ? "PDF" : "Word"}</span><small>{proposal.status}</small></td>
          </tr>;
        })}</tbody>
      </table>
    </div>

    {open && <Modal title="Generar propuesta oficial" description="Elige el formato. Cada generación crea una nueva versión inalterable en el historial." onClose={() => setOpen(false)} wide>
      <div className="proposal-layout">
        <section className="proposal-form">
          <div className="form-grid">
            <label className="field field-wide"><span>Oportunidad</span><select value={opportunityId} onChange={(event) => selectOpportunity(event.target.value)}><option value="">Selecciona una cuenta</option>{opportunities.filter((item) => !["cliente_activo", "perdida"].includes(item.stage)).map((item) => <option value={item.id} key={item.id}>{accounts.find((candidate) => candidate.id === item.accountId)?.name}</option>)}</select></label>
            <label className="field"><span>Fecha</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label>
            <label className="field"><span>Honorarios mensuales</span><input type="number" min="1" value={fee} onChange={(event) => setFee(Number(event.target.value))}/></label>
          </div>

          <div className="format-section">
            <b>Formato de salida</b>
            <div className="format-picker">
              <label className={`format-option ${format === "pdf" ? "selected" : ""}`}><input type="radio" name="format" value="pdf" checked={format === "pdf"} onChange={() => setFormat("pdf")}/><FileText size={18}/><span><b>PDF</b><small>Listo para enviar</small></span></label>
              <label className={`format-option ${format === "docx" ? "selected" : ""}`}><input type="radio" name="format" value="docx" checked={format === "docx"} onChange={() => setFormat("docx")}/><FileText size={18}/><span><b>Word</b><small>Documento editable</small></span></label>
            </div>
          </div>

          {previous && <div className="negotiation-summary">
            <div><small>Monto inicial</small><b>{formatCurrency(initial.monthlyFee)}</b></div>
            <div><small>Última versión</small><b>{formatCurrency(previous.monthlyFee)}</b></div>
            <div><small>Nueva versión</small><b className={fee < initial.monthlyFee ? "discount-text" : ""}>{formatCurrency(fee)}</b></div>
          </div>}

          {priceChanged && <label className="field" style={{marginTop: 14}}><span>Motivo de la variación</span><textarea value={changeReason} onChange={(event) => setChangeReason(event.target.value)} required placeholder="Ej. Rebaja solicitada por la junta durante la negociación"/><small className="field-error">Este motivo quedará guardado en el historial comercial.</small></label>}

          {account && <>
            <div style={{display:"flex",alignItems:"center",gap:7,marginTop:18}}><Sparkles size={15} color="#f47721"/><b style={{fontSize:12}}>Referencias comparables sugeridas</b></div>
            <div className="reference-list">{suggestions.map((reference) => <label className="reference-option" key={reference.id}><input type="checkbox" checked={selected.includes(reference.id)} onChange={() => toggle(reference.id)}/><span><b>{reference.clientName}</b><small>{reference.units} unidades · {reference.location}</small></span><span className="match">{reference.score}%</span></label>)}</div>
            <small style={{color:selected.length === 3 ? "#1b8a5a" : "#c9364f"}}>{selected.length}/3 referencias seleccionadas</small>
          </>}

          <div className="form-actions"><button className="button" onClick={() => setOpen(false)}>Cancelar</button><button className="button button-primary" onClick={generate} disabled={!account || selected.length !== 3 || loading || (priceChanged && !changeReason.trim())}><Download size={17}/>{loading ? "Generando…" : `Generar ${format === "pdf" ? "PDF" : "Word"}`}</button></div>
        </section>

        <section className="proposal-preview"><div className="paper"><div className="paper-logo">⌂<br/>INDEX CONDO</div><h2>PROPUESTA DE ADMINISTRACIÓN<br/>DE EDIFICIOS Y CONDOMINIOS</h2><div className="orange">PLAN DE ADMINISTRACIÓN INTEGRAL</div><div className="paper-client">{account?.name || "Nombre del cliente"}</div><div className="paper-meta">Santo Domingo, República Dominicana<br/>{new Date(`${date}T12:00:00`).toLocaleDateString("es-DO", {day:"numeric",month:"long",year:"numeric"})}</div><div className="paper-sections"><div className="paper-line"/><div className="paper-line"/><div className="paper-line short"/><div className="paper-line"/><div className="paper-line short"/></div><div className="paper-price">{formatCurrency(fee)} / mes</div></div></section>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:7,marginTop:14,color:"#667085",fontSize:11}}><FileCheck2 size={15}/> El archivo maestro permanece sin cambios; cada propuesta se genera como una copia versionada.</div>
    </Modal>}
    {toast && <div className="toast">{toast}</div>}
  </>;
}
