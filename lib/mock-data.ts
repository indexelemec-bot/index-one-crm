import type { Account, CommercialReference, Opportunity, Proposal, SalesReport, Stakeholder, Task, UserProfile } from "@/types/domain";

export const users: UserProfile[] = [
  { id: "u1", fullName: "Wilmer Andújar", email: "admin@indexelemecsrl.com", role: "superadmin", active: true },
  { id: "u2", fullName: "Laura Méndez", email: "laura@indexelemecsrl.com", role: "gerencia_comercial", active: true },
  { id: "u3", fullName: "Carlos Peña", email: "carlos@indexelemecsrl.com", role: "ejecutivo", active: true },
  { id: "u4", fullName: "Ana Santos", email: "ana@indexelemecsrl.com", role: "administracion", active: false }
];

export const accounts: Account[] = [
  { id: "a1", name: "Torre Meridian Park", accountType: "torre_residencial", address: "Av. Abraham Lincoln 962", sector: "Piantini", city: "Santo Domingo", units: 64, towers: 1, profile: "premium", ownerId: "u3", source: "Referido", createdAt: "2026-07-12" },
  { id: "a2", name: "Residencial Altos del Este", accountType: "condominio_existente", address: "Av. Ecológica 18", sector: "Santo Domingo Este", city: "Santo Domingo", units: 36, towers: 3, profile: "familiar", ownerId: "u2", source: "Google", createdAt: "2026-07-19" },
  { id: "a3", name: "Proyecto Nova Center", accountType: "proyecto_nuevo", address: "Av. Winston Churchill 70", sector: "Ensanche Paraíso", city: "Santo Domingo", units: 110, towers: 2, profile: "premium", ownerId: "u3", source: "Constructora", createdAt: "2026-07-28" },
  { id: "a4", name: "Condominio Vista Verde", accountType: "condominio_existente", address: "C. Jacinto Mañón 12", sector: "Ensanche Serrallés", city: "Santo Domingo", units: 48, towers: 2, profile: "familiar", ownerId: "u3", source: "Evento", createdAt: "2026-08-02" }
];

export const stakeholders: Stakeholder[] = [
  { id: "s1", accountId: "a1", fullName: "María Fernanda Ruiz", role: "presidente", phone: "809-555-0142", email: "maria@meridian.do", influence: 5, position: "champion", isDecisionMaker: true },
  { id: "s2", accountId: "a1", fullName: "José Manuel Castro", role: "tesorero", phone: "809-555-0188", email: "jose@meridian.do", influence: 5, position: "neutral", isDecisionMaker: true },
  { id: "s3", accountId: "a2", fullName: "Patricia Gómez", role: "presidente", phone: "809-555-0161", email: "patricia@altos.do", influence: 5, position: "champion", isDecisionMaker: true },
  { id: "s4", accountId: "a3", fullName: "Ricardo Valdez", role: "constructora", phone: "809-555-0199", email: "ricardo@novacenter.do", influence: 5, position: "neutral", isDecisionMaker: true }
];

export const opportunities: Opportunity[] = [
  { id: "o1", accountId: "a1", stage: "diagnostico", primaryProblem: "Morosidad y falta de reportes", impact: "Decisiones tardías y baja confianza de propietarios", proposedSolution: "Administración integral con control financiero y reportes mensuales", monthlyFee: 42000, probability: 45, nextAction: "Reunión de diagnóstico con tesorero", nextActionAt: "2026-08-10T10:00:00-04:00", ownerId: "u3", updatedAt: "2026-08-07" },
  { id: "o2", accountId: "a2", stage: "propuesta", primaryProblem: "Cambio de administración", impact: "Incidencias abiertas y deterioro de áreas comunes", proposedSolution: "Transición ordenada y plan de mantenimiento preventivo", monthlyFee: 36000, probability: 70, nextAction: "Seguimiento de propuesta con la presidenta", nextActionAt: "2026-08-09T09:30:00-04:00", ownerId: "u2", updatedAt: "2026-08-08" },
  { id: "o3", accountId: "a3", stage: "presentacion", primaryProblem: "Estructurar administración inicial", impact: "Riesgo operativo antes de la entrega del proyecto", proposedSolution: "Diseño de operación, presupuesto y apertura administrativa", monthlyFee: 68000, probability: 60, nextAction: "Presentar solución a la constructora", nextActionAt: "2026-08-12T15:00:00-04:00", ownerId: "u3", updatedAt: "2026-08-06" },
  { id: "o4", accountId: "a4", stage: "problema_detectado", primaryProblem: "Mantenimiento reactivo", impact: "Averías repetitivas y gastos no presupuestados", proposedSolution: "Diagnóstico técnico y plan anual de conservación", monthlyFee: 39000, probability: 30, nextAction: "Coordinar visita de levantamiento", nextActionAt: "2026-08-11T11:00:00-04:00", ownerId: "u3", updatedAt: "2026-08-05" }
];

export const tasks: Task[] = [
  { id: "t1", opportunityId: "o2", title: "Confirmar recepción de propuesta", dueAt: "2026-08-09T09:30:00-04:00", priority: "alta", status: "pendiente", ownerId: "u2" },
  { id: "t2", opportunityId: "o1", title: "Preparar preguntas de diagnóstico", dueAt: "2026-08-10T09:00:00-04:00", priority: "alta", status: "pendiente", ownerId: "u3" },
  { id: "t3", opportunityId: "o4", title: "Solicitar inventario de equipos", dueAt: "2026-08-08T12:00:00-04:00", priority: "media", status: "vencida", ownerId: "u3" },
  { id: "t4", opportunityId: "o3", title: "Enviar agenda de presentación", dueAt: "2026-08-12T12:00:00-04:00", priority: "media", status: "pendiente", ownerId: "u3" }
];

export const references: CommercialReference[] = [
  { id: "r1", clientName: "Condominio Torre Ducal", location: "C. Padre Fantino Falco 79, Serrallés, D.N.", units: 64, accountType: "torre_residencial", profile: "premium", approved: true },
  { id: "r2", clientName: "Torre Arche Tres", location: "C. General Cambiazo No. 8, Ens. Naco, D.N.", units: 23, accountType: "torre_residencial", profile: "premium", approved: true },
  { id: "r3", clientName: "Torre Kesington", location: "C. Rafael Augusto Sánchez 13, Ens. Naco", units: 16, accountType: "torre_residencial", profile: "premium", approved: true },
  { id: "r4", clientName: "Residencial Jardines del Sur", location: "Av. Independencia, D.N.", units: 40, accountType: "condominio_existente", profile: "familiar", approved: true },
  { id: "r5", clientName: "Condominio Paseo del Este", location: "Av. Ecológica, Santo Domingo Este", units: 32, accountType: "condominio_existente", profile: "familiar", approved: true },
  { id: "r6", clientName: "Torres del Parque", location: "Ensanche Paraíso, D.N.", units: 96, accountType: "proyecto_nuevo", profile: "premium", approved: true }
];

export const proposals: Proposal[] = [
  { id: "p1", opportunityId: "o2", version: 1, clientName: "Residencial Altos del Este", issueDate: "2026-08-05", monthlyFee: 39000, referenceIds: ["r4", "r5", "r2"], status: "enviada", generatedAt: "2026-08-05T14:30:00-04:00", fileFormat: "pdf" },
  { id: "p2", opportunityId: "o2", version: 2, clientName: "Residencial Altos del Este", issueDate: "2026-08-08", monthlyFee: 36000, referenceIds: ["r4", "r5", "r2"], status: "generada", generatedAt: "2026-08-08T11:20:00-04:00", fileFormat: "docx", changeReason: "Rebaja solicitada durante la negociación" }
];

export const salesReports: SalesReport[] = [
  { id: "sr1", opportunityId: "o2", accountId: "a2", sellerId: "u2", closedBy: "u1", closedAt: "2026-08-08T16:00:00-04:00", initialFee: 39000, finalFee: 36000, annualValue: 432000, commissionRate: 0.5, commissionBase: 36000, commissionAmount: 18000, commissionStatus: "pagadera", firstPaymentReceivedAt: "2026-08-08T16:00:00-04:00", contractReference: "Contrato INDEX-2026-008", notes: "Aprobado por la junta directiva.", createdAt: "2026-08-08T16:00:00-04:00" }
];
