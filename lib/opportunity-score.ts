import type { Opportunity, Proposal, Stakeholder, Task } from "@/types/domain";

export interface OpportunityScoreFactor {
  label: string;
  points: number;
  achieved: boolean;
  recommendation?: string;
}

const stageScores: Record<Opportunity["stage"], number> = {
  prospecto_identificado: 10,
  problema_detectado: 18,
  contacto_decisor: 27,
  diagnostico: 38,
  solucion_recomendada: 48,
  presentacion: 58,
  propuesta: 67,
  negociacion: 76,
  aprobacion: 87,
  contrato_transicion: 94,
  cliente_activo: 100,
  perdida: 0
};

const isUseful = (value: string) => Boolean(value.trim()) && !value.toLowerCase().includes("pendiente");

export function calculateOpportunityScore(opportunity: Opportunity, stakeholders: Stakeholder[], proposals: Proposal[], tasks: Task[], now = new Date()) {
  if (opportunity.stage === "cliente_activo" || opportunity.stage === "perdida") return { score: stageScores[opportunity.stage], factors: [] as OpportunityScoreFactor[] };

  const contacts = stakeholders.filter((item) => item.accountId === opportunity.accountId);
  const history = proposals.filter((item) => item.opportunityId === opportunity.id);
  const openTasks = tasks.filter((item) => item.opportunityId === opportunity.id && item.status !== "completada");
  const nextActionDate = opportunity.nextActionAt ? new Date(opportunity.nextActionAt) : undefined;
  const factors: OpportunityScoreFactor[] = [
    { label: "Decisor confirmado", points: 5, achieved: contacts.some((item) => item.isDecisionMaker), recommendation: "Identifica quién puede autorizar la contratación." },
    { label: "Comité o influenciadores mapeados", points: 3, achieved: contacts.length >= 2, recommendation: "Agrega al menos otro miembro de junta o influenciador." },
    { label: "Problema e impacto validados", points: 5, achieved: isUseful(opportunity.primaryProblem) && isUseful(opportunity.impact), recommendation: "Documenta el impacto operativo o financiero con palabras del cliente." },
    { label: "Solución conectada al diagnóstico", points: 4, achieved: isUseful(opportunity.proposedSolution), recommendation: "Relaciona cada necesidad prioritaria con una capacidad de INDEX CONDO." },
    { label: "Propuesta enviada y registrada", points: 5, achieved: history.some((item) => ["enviada", "vista", "aceptada"].includes(item.status)), recommendation: "Envía la propuesta desde el CRM y acuerda cuándo será revisada." },
    { label: "Próxima acción vigente", points: 3, achieved: Boolean(opportunity.nextAction.trim() && nextActionDate && nextActionDate.getTime() >= now.getTime() - 86_400_000), recommendation: "Define una acción concreta con fecha y responsable." },
    { label: "Tarea de seguimiento activa", points: 2, achieved: openTasks.some((item) => new Date(item.dueAt).getTime() >= now.getTime() - 86_400_000), recommendation: "Programa el próximo seguimiento de la oportunidad." }
  ];
  const earned = factors.reduce((total, factor) => total + (factor.achieved ? factor.points : 0), 0);
  return { score: Math.min(97, stageScores[opportunity.stage] + earned), factors };
}
