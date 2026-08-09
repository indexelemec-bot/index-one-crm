import type { AccountType, OpportunityStage, UserRole } from "@/types/domain";

export const stageLabels: Record<OpportunityStage, string> = {
  prospecto_identificado: "Prospecto identificado", problema_detectado: "Problema detectado", contacto_decisor: "Contacto con decisor", diagnostico: "Diagnóstico", solucion_recomendada: "Solución recomendada", presentacion: "Presentación", propuesta: "Propuesta", negociacion: "Negociación", aprobacion: "Aprobación", contrato_transicion: "Contrato y transición", cliente_activo: "Cliente activo", perdida: "Oportunidad perdida"
};
export const pipelineStages = (Object.keys(stageLabels) as OpportunityStage[]).filter((s) => s !== "perdida");
export const accountTypeLabels: Record<AccountType, string> = { condominio_existente: "Condominio existente", torre_residencial: "Torre residencial", proyecto_nuevo: "Proyecto nuevo", constructora: "Constructora", desarrollador: "Desarrollador", aliado: "Aliado estratégico" };
export const roleLabels: Record<UserRole, string> = { superadmin: "Superadministrador", gerencia_comercial: "Gerencia comercial", ejecutivo: "Ejecutivo comercial", administracion: "Administración", consulta: "Solo consulta" };
export const formatCurrency = (value: number) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(value).replace("DOP", "RD$");
export const formatDate = (value: string) => new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
