import type { ArmAgent, ArmAgentAssignment, ArmInteraction } from "@/types/domain";

export const armStatusLabels: Record<ArmAgent["status"], string> = {
  borrador: "Borrador",
  piloto: "Piloto controlado",
  activo: "Activo",
  pausado: "Pausado",
  retirado: "Retirado"
};

export const armAutonomyLabels: Record<ArmAgent["autonomyLevel"], string> = {
  asesor: "Solo recomienda",
  supervisado: "Actúa con aprobación",
  acotado: "Autonomía limitada",
  autonomo: "Autónomo"
};

export const armDecisionLabels: Record<ArmInteraction["decisionStatus"], string> = {
  recomendacion: "Recomendación",
  pendiente_aprobacion: "Pendiente de aprobación",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  ejecutada: "Ejecutada",
  fallida: "Fallida"
};

export function canAgentExecute(agent: Pick<ArmAgent, "status" | "autonomyLevel" | "requiresHumanApproval" | "capabilities">, capability: string, approved = false) {
  if (agent.status !== "activo" && agent.status !== "piloto") return false;
  if (!agent.capabilities.includes(capability)) return false;
  if (agent.autonomyLevel === "asesor") return false;
  if (agent.requiresHumanApproval && !approved) return false;
  return true;
}

export function summarizeArm(agents: ArmAgent[], assignments: ArmAgentAssignment[], interactions: ArmInteraction[]) {
  const activeAgents = agents.filter((agent) => agent.status === "activo" || agent.status === "piloto").length;
  const coveredOpportunities = new Set(assignments.filter((item) => item.status === "activa").map((item) => item.opportunityId)).size;
  const pendingApprovals = interactions.filter((item) => item.decisionStatus === "pendiente_aprobacion").length;
  const completed = interactions.filter((item) => item.decisionStatus === "ejecutada" || item.decisionStatus === "fallida");
  const successful = completed.filter((item) => item.decisionStatus === "ejecutada").length;
  return { activeAgents, coveredOpportunities, pendingApprovals, successRate: completed.length ? Math.round((successful / completed.length) * 100) : 0 };
}
