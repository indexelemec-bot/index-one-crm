export type UserRole = "superadmin" | "gerencia_comercial" | "ejecutivo" | "administracion" | "consulta";
export type AccountType = "condominio_existente" | "torre_residencial" | "proyecto_nuevo" | "constructora" | "desarrollador" | "aliado";
export type StakeholderRole = "presidente" | "tesorero" | "secretario" | "miembro_junta" | "propietario_influyente" | "constructora" | "administrador_actual" | "otro";
export type OpportunityStage = "prospecto_identificado" | "problema_detectado" | "contacto_decisor" | "diagnostico" | "solucion_recomendada" | "presentacion" | "propuesta" | "negociacion" | "aprobacion" | "contrato_transicion" | "cliente_activo" | "perdida";
export type TaskStatus = "pendiente" | "completada" | "vencida";
export type ProposalStatus = "borrador" | "generada" | "enviada" | "vista" | "aceptada" | "rechazada";
export type ProposalFileFormat = "docx" | "pdf";
export type CommissionStatus = "proyectada" | "ganada" | "pagadera" | "pagada" | "revertida";
export type SpeechChannel = "llamada" | "reunion" | "email" | "whatsapp";
export type SpeechOutcome = "sin_respuesta" | "interes" | "reunion" | "propuesta" | "objecion" | "cierre" | "no_interes";
export type CommunicationChannel = "email" | "whatsapp";
export type CommunicationDirection = "outbound" | "inbound";
export type CommunicationThreadStatus = "open" | "pending" | "closed" | "archived";
export type ScheduledCommunicationStatus = "scheduled" | "processing" | "sent" | "cancelled" | "failed";

export interface UserProfile { id: string; fullName: string; email: string; role: UserRole; active: boolean; deletedAt?: string; reassignedTo?: string; }
export interface Account { id: string; name: string; accountType: AccountType; address: string; sector: string; city: string; units: number; towers: number; profile: string; ownerId: string; source: string; createdAt: string; }
export interface Stakeholder { id: string; accountId: string; fullName: string; role: StakeholderRole; phone: string; email: string; influence: number; position: "champion" | "neutral" | "opposed" | "unknown"; isDecisionMaker: boolean; }
export interface Opportunity { id: string; accountId: string; stage: OpportunityStage; primaryProblem: string; impact: string; proposedSolution: string; monthlyFee: number; probability: number; nextAction: string; nextActionAt: string; ownerId: string; updatedAt: string; lostReason?: string; followupEnabled?: boolean; nextFollowupAt?: string; followupIntervalMonths?: number; }
export interface Task { id: string; opportunityId: string; title: string; dueAt: string; priority: "alta" | "media" | "baja"; status: TaskStatus; ownerId: string; outcome?: string; }
export interface CommercialReference { id: string; clientName: string; location: string; units: number; accountType: AccountType; profile: string; approved: boolean; }
export interface Proposal { id: string; opportunityId: string; version: number; clientName: string; issueDate: string; monthlyFee: number; referenceIds: string[]; status: ProposalStatus; generatedAt: string; fileFormat: ProposalFileFormat; changeReason?: string; }
export interface Communication { id: string; opportunityId: string; proposalId?: string; stakeholderId?: string; threadId?: string; channel: CommunicationChannel; direction: CommunicationDirection; fromAddress: string; toAddress: string; subject?: string; bodyText: string; templateKey?: string; provider?: string; providerMessageId?: string; attachmentFormat?: ProposalFileFormat; status: string; errorMessage?: string; agentId?: string; agentNameSnapshot?: string; messageType?: string; mediaPath?: string; mediaName?: string; mediaMime?: string; replyToProviderMessageId?: string; isInternal?: boolean; sentAt?: string; deliveredAt?: string; openedAt?: string; createdAt: string; }
export interface CommunicationThread { id: string; opportunityId: string; stakeholderId: string; channel: CommunicationChannel; assignedTo?: string; status: CommunicationThreadStatus; unreadCount: number; lastMessageAt?: string; lastInboundAt?: string; lastOutboundAt?: string; createdAt: string; updatedAt: string; }
export interface CommunicationAssignmentHistory { id: string; threadId: string; previousAgentId?: string; newAgentId?: string; changedBy: string; reason?: string; changedAt: string; }
export interface ScheduledCommunication { id: string; threadId?: string; opportunityId: string; stakeholderId: string; channel: CommunicationChannel; bodyText: string; templateKey?: string; attachmentPath?: string; attachmentName?: string; scheduledFor: string; recurrenceMonths?: number; status: ScheduledCommunicationStatus; createdBy: string; sentCommunicationId?: string; errorMessage?: string; createdAt: string; updatedAt: string; }
export interface SalesReport { id: string; opportunityId: string; accountId: string; sellerId: string; closedBy: string; closedAt: string; initialFee: number; finalFee: number; annualValue: number; commissionRate: number; commissionBase: number; commissionAmount: number; commissionStatus: CommissionStatus; firstPaymentReceivedAt?: string; commissionPaidAt?: string; contractReference: string; notes?: string; createdAt: string; }
export interface AssignmentHistory { id: string; opportunityId: string; previousOwnerId?: string; newOwnerId: string; changedBy: string; changeReason: string; changedAt: string; }
export interface SpeechUsage { id: string; speechId: string; opportunityId: string; stakeholderId?: string; stage: OpportunityStage; userId: string; channel: SpeechChannel; outcome: SpeechOutcome; notes?: string; nextAction: string; nextActionAt: string; usedAt: string; }
