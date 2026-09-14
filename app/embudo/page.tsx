"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, FileText, Filter, GripVertical, MessageSquareText, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useCrm } from "@/components/crm-provider";
import { SpeechCoach } from "@/components/speech-coach";
import { AiSalesCoach } from "@/components/ai-sales-coach";
import { PageHeader } from "@/components/ui";
import { formatCurrency, pipelineStages, stageLabels } from "@/lib/constants";
import { canSeeOpportunity } from "@/lib/permissions";
import { calculateOpportunityScore } from "@/lib/opportunity-score";
import { stagePlaybook } from "@/lib/sales-playbook";
import { availableSpeeches } from "@/lib/sales-speeches";
import type { OpportunityStage } from "@/types/domain";

export default function EmbudoPage() {
  const router = useRouter();
  const { opportunities, accounts, stakeholders, proposals, tasks, users, currentUser, moveOpportunityStage, speechUsages } = useCrm();
  const [dragged, setDragged] = useState<string | null>(null); const [speechOpportunityId, setSpeechOpportunityId] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [aiOpportunityId, setAiOpportunityId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ opportunityId: string; stage: OpportunityStage } | null>(null);
  const [moveNote, setMoveNote] = useState("");
  const [moveError, setMoveError] = useState("");
  const [moving, setMoving] = useState(false);
  const visible = opportunities.filter((item) => canSeeOpportunity(currentUser, item) && item.stage !== "perdida");
  const selectedOpportunity = opportunities.find((item) => item.id === speechOpportunityId);
  const selectedAccount = accounts.find((item) => item.id === selectedOpportunity?.accountId);
  function drop(stage: OpportunityStage) {
    const opportunity = opportunities.find((item) => item.id === dragged);
    if (!opportunity || opportunity.stage === stage) { setDragged(null); return; }
    const hasProposal = proposals.some((proposal) => proposal.opportunityId === opportunity.id);
    if ((stage === "propuesta" || stage === "propuesta_enviada") && !hasProposal) {
      router.push(`/propuestas?nueva=${opportunity.id}&origen=embudo`);
      setDragged(null);
      return;
    }
    setPendingMove({ opportunityId: opportunity.id, stage });
    setDragged(null);
  }
  async function confirmMove() {
    if (!pendingMove) return;
    setMoving(true); setMoveError("");
    if (pendingMove.stage === "propuesta_enviada") {
      const latest = proposals.filter((proposal) => proposal.opportunityId === pendingMove.opportunityId).sort((a, b) => b.version - a.version)[0];
      if (!latest) { setMoving(false); router.push(`/propuestas?nueva=${pendingMove.opportunityId}&origen=embudo`); return; }
      const response = await fetch("/api/proposals/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposalId: latest.id, status: "enviada" }) });
      const body = await response.json().catch(() => ({}));
      setMoving(false);
      if (!response.ok) { setMoveError(body.error ?? "No fue posible confirmar el envío de la propuesta."); return; }
      await moveOpportunityStage(pendingMove.opportunityId, "propuesta_enviada", moveNote || `Propuesta v${latest.version} confirmada como enviada`);
      setPendingMove(null); setMoveNote("");
      return;
    }
    const result = await moveOpportunityStage(pendingMove.opportunityId, pendingMove.stage, moveNote);
    setMoving(false);
    if (!result.ok) { setMoveError(result.error ?? "No fue posible mover la oportunidad."); return; }
    setPendingMove(null); setMoveNote("");
  }
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("opportunity"); if (!id) return; setFocused(id); window.setTimeout(() => document.getElementById(`deal-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }), 180); }, [opportunities]);

  return <><PageHeader eyebrow="Venta consultiva" title="Embudo de soluciones" description="Cada etapa ofrece guiones aplicables, registra cuáles utilizaste y prioriza alternativas nuevas para cada decisor."><button className="button"><Filter size={17}/> Filtrar cartera</button></PageHeader>
    <div className="kanban">{pipelineStages.map((stage) => <section className="kanban-column" key={stage} onDragOver={(event) => event.preventDefault()} onDrop={() => drop(stage)}><header className="kanban-head"><div><b>{stageLabels[stage]}</b><small>{stagePlaybook[stage].objective}</small></div><span className="count">{visible.filter((item) => item.stage === stage).length}</span></header>{visible.filter((item) => item.stage === stage).map((opportunity) => { const account = accounts.find((item) => item.id === opportunity.accountId)!; const owner = users.find((user) => user.id === opportunity.ownerId); const unused = availableSpeeches(stage, speechUsages, opportunity.id).length; const score = calculateOpportunityScore(opportunity, stakeholders, proposals, tasks).score; return <article id={`deal-${opportunity.id}`} className={`deal ${focused === opportunity.id ? "deal-focused" : ""}`} key={opportunity.id} draggable onDragStart={() => setDragged(opportunity.id)}><div className="deal-title"><Link href={`/prospectos/${account.id}`}><h3>{account.name}</h3></Link><GripVertical size={15} color="#a6b1bd"/></div><p>{opportunity.primaryProblem}</p><div className="deal-owner"><UserRound size={12}/>{owner?.fullName ?? "Sin asignar"}</div><div className="deal-value">{formatCurrency(opportunity.monthlyFee)} <small>/mes</small></div><div className="deal-meta"><span>{account.units} unidades</span><b title="Probabilidad explicable">{score}%</b></div><div className="progress full-progress"><span style={{ width: `${score}%` }}/></div><div className="deal-action">Próximo: {opportunity.nextAction}</div><button className="deal-coach" type="button" onClick={() => setSpeechOpportunityId(opportunity.id)}><MessageSquareText size={13}/> Speeches de esta etapa <span>{unused} nuevos</span></button><button className="deal-coach ai-coach-button" type="button" onClick={() => setAiOpportunityId(opportunity.id)}><Bot size={13}/> Consultar coach IA</button></article>; })}</section>)}</div>
    {selectedOpportunity && selectedAccount && <SpeechCoach opportunity={selectedOpportunity} account={selectedAccount} onClose={() => setSpeechOpportunityId(null)}/>}
    {aiOpportunityId && (() => { const opportunity = opportunities.find((item) => item.id === aiOpportunityId); const account = accounts.find((item) => item.id === opportunity?.accountId); return opportunity && account ? <AiSalesCoach opportunityId={opportunity.id} clientName={account.name} onClose={() => setAiOpportunityId(null)}/> : null; })()}
    {pendingMove && <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="move-stage-title"><button className="modal-backdrop" aria-label="Cancelar movimiento" onClick={() => setPendingMove(null)}/><section className="modal"><div className="modal-head"><div><span className="eyebrow">Auditoría del Kanban</span><h2 id="move-stage-title">{pendingMove.stage === "propuesta_enviada" ? "¿La propuesta fue enviada?" : "Confirmar movimiento"}</h2></div></div><div className="modal-body">{pendingMove.stage === "propuesta_enviada" ? <p><FileText size={17}/> Confirma únicamente si la propuesta ya fue entregada al cliente. Se marcará la versión más reciente como enviada y se programará el seguimiento.</p> : <p>La oportunidad pasará a <strong>{stageLabels[pendingMove.stage]}</strong>. El cambio, la fecha, el vendedor y tu usuario quedarán registrados.</p>}<label className="field"><span>Motivo o nota (opcional)</span><textarea value={moveNote} maxLength={1000} onChange={(event) => setMoveNote(event.target.value)} placeholder="Ej.: reunión completada; cliente solicitó propuesta revisada"/></label>{moveError && <div className="field-error" role="alert">{moveError}</div>}<div className="form-actions"><button className="button" type="button" onClick={() => { setPendingMove(null); setMoveNote(""); setMoveError(""); }} disabled={moving}>Cancelar</button><button className="button button-primary" type="button" onClick={() => void confirmMove()} disabled={moving}>{moving ? "Guardando…" : pendingMove.stage === "propuesta_enviada" ? "Sí, fue enviada" : "Confirmar movimiento"}</button></div></div></section></div>}
  </>;
}
