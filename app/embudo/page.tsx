"use client";
import Link from "next/link";
import { Filter, GripVertical, MessageSquareText, UserRound } from "lucide-react";
import { useState } from "react";
import { useCrm } from "@/components/crm-provider";
import { SpeechCoach } from "@/components/speech-coach";
import { PageHeader } from "@/components/ui";
import { formatCurrency, pipelineStages, stageLabels } from "@/lib/constants";
import { canSeeOpportunity } from "@/lib/permissions";
import { stagePlaybook } from "@/lib/sales-playbook";
import { availableSpeeches } from "@/lib/sales-speeches";
import type { OpportunityStage } from "@/types/domain";

export default function EmbudoPage() {
  const { opportunities, accounts, users, currentUser, updateOpportunity, speechUsages } = useCrm();
  const [dragged, setDragged] = useState<string | null>(null); const [speechOpportunityId, setSpeechOpportunityId] = useState<string | null>(null);
  const visible = opportunities.filter((item) => canSeeOpportunity(currentUser, item) && item.stage !== "perdida");
  const selectedOpportunity = opportunities.find((item) => item.id === speechOpportunityId);
  const selectedAccount = accounts.find((item) => item.id === selectedOpportunity?.accountId);
  function drop(stage: OpportunityStage) { if (dragged) updateOpportunity(dragged, { stage }); setDragged(null); }

  return <><PageHeader eyebrow="Venta consultiva" title="Embudo de soluciones" description="Cada etapa ofrece guiones aplicables, registra cuáles utilizaste y prioriza alternativas nuevas para cada decisor."><button className="button"><Filter size={17}/> Filtrar cartera</button></PageHeader>
    <div className="kanban">{pipelineStages.map((stage) => <section className="kanban-column" key={stage} onDragOver={(event) => event.preventDefault()} onDrop={() => drop(stage)}><header className="kanban-head"><div><b>{stageLabels[stage]}</b><small>{stagePlaybook[stage].objective}</small></div><span className="count">{visible.filter((item) => item.stage === stage).length}</span></header>{visible.filter((item) => item.stage === stage).map((opportunity) => { const account = accounts.find((item) => item.id === opportunity.accountId)!; const owner = users.find((user) => user.id === opportunity.ownerId); const unused = availableSpeeches(stage, speechUsages, opportunity.id).length; return <article className="deal" key={opportunity.id} draggable onDragStart={() => setDragged(opportunity.id)}><div className="deal-title"><Link href={`/prospectos/${account.id}`}><h3>{account.name}</h3></Link><GripVertical size={15} color="#a6b1bd"/></div><p>{opportunity.primaryProblem}</p><div className="deal-owner"><UserRound size={12}/>{owner?.fullName ?? "Sin asignar"}</div><div className="deal-value">{formatCurrency(opportunity.monthlyFee)} <small>/mes</small></div><div className="deal-meta"><span>{account.units} unidades</span><b>{opportunity.probability}%</b></div><div className="progress full-progress"><span style={{ width: `${opportunity.probability}%` }}/></div><div className="deal-action">Próximo: {opportunity.nextAction}</div><button className="deal-coach" type="button" onClick={() => setSpeechOpportunityId(opportunity.id)}><MessageSquareText size={13}/> Speeches de esta etapa <span>{unused} nuevos</span></button></article>; })}</section>)}</div>
    {selectedOpportunity && selectedAccount && <SpeechCoach opportunity={selectedOpportunity} account={selectedAccount} onClose={() => setSpeechOpportunityId(null)}/>}
  </>;
}
