import type { AccountType, OpportunityStage, UserRole } from "@/types/domain";

export const stageLabels: Record<OpportunityStage, string> = {
  prospecto_identificado: "Prospecto identificado", problema_detectado: "Problema detectado", contacto_decisor: "Contacto con decisor", diagnostico: "Diagnóstico", solucion_recomendada: "Solución recomendada", presentacion: "Presentación", propuesta: "Propuesta por preparar", propuesta_enviada: "Propuesta enviada", negociacion: "Negociación", aprobacion: "Aprobación", contrato_transicion: "Contrato y transición", cliente_activo: "Cliente activo", perdida: "Oportunidad perdida"
};

// La probabilidad representa cercanía al cierre, no una reducción del valor económico del prospecto.
// Se calcula automáticamente por etapa para mantener una lectura B2B consistente del embudo.
export const stageClosingProbability: Record<OpportunityStage, number> = {
  prospecto_identificado: 5,
  problema_detectado: 10,
  contacto_decisor: 20,
  diagnostico: 30,
  solucion_recomendada: 40,
  presentacion: 50,
  propuesta: 65,
  propuesta_enviada: 72,
  negociacion: 80,
  aprobacion: 90,
  contrato_transicion: 95,
  cliente_activo: 100,
  perdida: 0,
};

export const pipelineStages = (Object.keys(stageLabels) as OpportunityStage[]).filter((s) => s !== "perdida");

export type KanbanColumn = {
  id: "acercamiento" | "evaluacion" | "propuesta" | "cierre";
  label: string;
  objective: string;
  stages: OpportunityStage[];
  targetStage: OpportunityStage;
};

// El Kanban operativo es deliberadamente más simple que el histórico técnico.
// Las etapas detalladas permanecen disponibles para Timeline, reportes y automatizaciones.
export const kanbanColumns: KanbanColumn[] = [
  {
    id: "acercamiento",
    label: "Acercamiento inicial",
    objective: "Contactar al condominio y confirmar quién decide.",
    stages: ["prospecto_identificado", "problema_detectado", "contacto_decisor"],
    targetStage: "contacto_decisor",
  },
  {
    id: "evaluacion",
    label: "Evaluación",
    objective: "Entender la necesidad y definir la solución adecuada.",
    stages: ["diagnostico", "solucion_recomendada", "presentacion"],
    targetStage: "diagnostico",
  },
  {
    id: "propuesta",
    label: "Propuesta",
    objective: "Preparar, enviar y dar seguimiento a la propuesta.",
    stages: ["propuesta", "propuesta_enviada", "negociacion"],
    targetStage: "propuesta_enviada",
  },
  {
    id: "cierre",
    label: "Cierre final",
    objective: "Confirmar aprobación, contrato y registro del cierre.",
    stages: ["aprobacion", "contrato_transicion"],
    targetStage: "aprobacion",
  },
];

export function kanbanColumnForStage(stage: OpportunityStage) {
  return kanbanColumns.find((column) => column.stages.includes(stage));
}
export const accountTypeLabels: Record<AccountType, string> = { condominio_existente: "Condominio existente", torre_residencial: "Torre residencial", proyecto_nuevo: "Proyecto nuevo", constructora: "Constructora", desarrollador: "Desarrollador", aliado: "Aliado estratégico" };
export const roleLabels: Record<UserRole, string> = { superadmin: "Superadministrador", gerencia_comercial: "Gerencia comercial", ejecutivo: "Ejecutivo comercial", administracion: "Administración", consulta: "Solo consulta" };
export const formatCurrency = (value: number) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(value).replace("DOP", "RD$");
export const formatDate = (value: string) => new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
