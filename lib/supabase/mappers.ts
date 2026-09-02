import type { Account, ArmAgent, ArmAgentAssignment, ArmInteraction, AssignmentHistory, ClientDocument, CommercialReference, Communication, CommunicationAssignmentHistory, CommunicationThread, MarketingLead, Opportunity, Proposal, SalesReport, ScheduledCommunication, SpeechUsage, Stakeholder, Task, UserProfile } from "@/types/domain";

export const mapProfile = (row: Record<string, unknown>): UserProfile => ({
  id: String(row.id), fullName: String(row.full_name), email: String(row.email ?? ""),
  role: row.role as UserProfile["role"], active: Boolean(row.active),
  deletedAt: row.deleted_at ? String(row.deleted_at) : undefined,
  reassignedTo: row.reassigned_to ? String(row.reassigned_to) : undefined
});

export const mapAccount = (row: Record<string, unknown>): Account => ({
  id: String(row.id), name: String(row.name), accountType: row.account_type as Account["accountType"],
  address: String(row.address ?? ""), sector: String(row.sector ?? ""), city: String(row.city ?? ""),
  units: Number(row.units), towers: Number(row.towers), profile: String(row.profile ?? ""),
  ownerId: String(row.owner_id), source: String(row.source ?? ""), createdAt: String(row.created_at)
});

export const mapStakeholder = (row: Record<string, unknown>): Stakeholder => ({
  id: String(row.id), accountId: String(row.account_id), fullName: String(row.full_name),
  role: row.role as Stakeholder["role"], phone: String(row.phone ?? ""), email: String(row.email ?? ""),
  influence: Number(row.influence), position: row.position as Stakeholder["position"], isDecisionMaker: Boolean(row.is_decision_maker)
});

export const mapOpportunity = (row: Record<string, unknown>): Opportunity => ({
  id: String(row.id), accountId: String(row.account_id), stage: row.stage as Opportunity["stage"],
  primaryProblem: String(row.primary_problem), impact: String(row.impact ?? ""), proposedSolution: String(row.proposed_solution ?? ""),
  monthlyFee: Number(row.monthly_fee), probability: Number(row.probability), nextAction: String(row.next_action),
  nextActionAt: String(row.next_action_at), ownerId: String(row.owner_id), updatedAt: String(row.updated_at),
  lostReason: row.lost_reason ? String(row.lost_reason) : undefined,
  followupEnabled: Boolean(row.followup_enabled),
  nextFollowupAt: row.next_followup_at ? String(row.next_followup_at) : undefined,
  followupIntervalMonths: row.followup_interval_months ? Number(row.followup_interval_months) : undefined
});

export const mapTask = (row: Record<string, unknown>): Task => ({
  id: String(row.id), opportunityId: String(row.opportunity_id), title: String(row.title), dueAt: String(row.due_at),
  priority: row.priority as Task["priority"], status: row.status as Task["status"], ownerId: String(row.owner_id),
  outcome: row.outcome ? String(row.outcome) : undefined
});

export const mapProposal = (row: Record<string, unknown>): Proposal => ({
  id: String(row.id), opportunityId: String(row.opportunity_id), version: Number(row.version),
  clientName: String(row.client_name), issueDate: String(row.issue_date), monthlyFee: Number(row.monthly_fee),
  referenceIds: (row.reference_ids as string[]) ?? [], status: row.status as Proposal["status"], generatedAt: String(row.generated_at),
  fileFormat: row.file_format === "pdf" ? "pdf" : "docx", changeReason: row.change_reason ? String(row.change_reason) : undefined
});

export const mapReference = (row: Record<string, unknown>): CommercialReference => ({
  id: String(row.id), clientName: String(row.client_name), location: String(row.location), units: Number(row.units),
  accountType: row.account_type as CommercialReference["accountType"], profile: String(row.profile ?? ""), approved: Boolean(row.approved)
});

export const mapSalesReport = (row: Record<string, unknown>): SalesReport => ({
  id: String(row.id), opportunityId: String(row.opportunity_id), accountId: String(row.account_id), sellerId: String(row.seller_id),
  closedBy: String(row.closed_by), closedAt: String(row.closed_at), initialFee: Number(row.initial_fee), finalFee: Number(row.final_fee),
  annualValue: Number(row.annual_value), commissionRate: Number(row.commission_rate), commissionBase: Number(row.commission_base),
  commissionAmount: Number(row.commission_amount), commissionStatus: row.commission_status as SalesReport["commissionStatus"],
  firstPaymentReceivedAt: row.first_payment_received_at ? String(row.first_payment_received_at) : undefined,
  commissionPaidAt: row.commission_paid_at ? String(row.commission_paid_at) : undefined,
  contractReference: String(row.contract_reference), notes: row.notes ? String(row.notes) : undefined, createdAt: String(row.created_at)
});

export const mapAssignmentHistory = (row: Record<string, unknown>): AssignmentHistory => ({
  id: String(row.id), opportunityId: String(row.opportunity_id), previousOwnerId: row.previous_owner_id ? String(row.previous_owner_id) : undefined,
  newOwnerId: String(row.new_owner_id), changedBy: String(row.changed_by), changeReason: String(row.change_reason), changedAt: String(row.changed_at)
});

export const mapSpeechUsage = (row: Record<string, unknown>): SpeechUsage => ({
  id: String(row.id), speechId: String(row.speech_id), opportunityId: String(row.opportunity_id),
  stakeholderId: row.stakeholder_id ? String(row.stakeholder_id) : undefined, stage: row.stage as SpeechUsage["stage"],
  userId: String(row.user_id), channel: row.channel as SpeechUsage["channel"], outcome: row.outcome as SpeechUsage["outcome"],
  notes: row.notes ? String(row.notes) : undefined, nextAction: String(row.next_action), nextActionAt: String(row.next_action_at), usedAt: String(row.used_at)
});

export const mapCommunication = (row: Record<string, unknown>): Communication => ({
  id: String(row.id), opportunityId: String(row.opportunity_id), proposalId: row.proposal_id ? String(row.proposal_id) : undefined,
  clientDocumentId: row.client_document_id ? String(row.client_document_id) : undefined,
  stakeholderId: row.stakeholder_id ? String(row.stakeholder_id) : undefined, threadId: row.thread_id ? String(row.thread_id) : undefined,
  channel: row.channel as Communication["channel"], direction: row.direction as Communication["direction"],
  fromAddress: String(row.from_address ?? ""), toAddress: String(row.to_address ?? ""), subject: row.subject ? String(row.subject) : undefined,
  bodyText: String(row.body_text ?? ""), templateKey: row.template_key ? String(row.template_key) : undefined,
  provider: row.provider ? String(row.provider) : undefined, providerMessageId: row.provider_message_id ? String(row.provider_message_id) : undefined,
  providerMediaId: row.provider_media_id ? String(row.provider_media_id) : undefined,
  attachmentFormat: row.attachment_format === "pdf" || row.attachment_format === "docx" ? row.attachment_format : undefined,
  status: String(row.status), errorMessage: row.error_message ? String(row.error_message) : undefined,
  agentId: row.agent_id ? String(row.agent_id) : undefined, agentNameSnapshot: row.agent_name_snapshot ? String(row.agent_name_snapshot) : undefined,
  messageType: row.message_type ? String(row.message_type) : undefined, mediaPath: row.media_path ? String(row.media_path) : undefined,
  mediaName: row.media_name ? String(row.media_name) : undefined, mediaMime: row.media_mime_type ? String(row.media_mime_type) : undefined,
  transcriptionText: row.transcription_text ? String(row.transcription_text) : undefined,
  transcriptionStatus: row.transcription_status as Communication["transcriptionStatus"],
  transcriptionError: row.transcription_error ? String(row.transcription_error) : undefined,
  transcriptionProvider: row.transcription_provider ? String(row.transcription_provider) : undefined,
  transcriptionLanguage: row.transcription_language ? String(row.transcription_language) : undefined,
  transcriptionCompletedAt: row.transcription_completed_at ? String(row.transcription_completed_at) : undefined,
  replyToProviderMessageId: row.reply_to_provider_message_id ? String(row.reply_to_provider_message_id) : undefined,
  isInternal: Boolean(row.is_internal), sentAt: row.sent_at ? String(row.sent_at) : undefined,
  deliveredAt: row.delivered_at ? String(row.delivered_at) : undefined, openedAt: row.opened_at ? String(row.opened_at) : undefined,
  createdAt: String(row.created_at)
});

export const mapClientDocument = (row: Record<string, unknown>): ClientDocument => ({
  id: String(row.id), opportunityId: String(row.opportunity_id),
  stakeholderId: row.stakeholder_id ? String(row.stakeholder_id) : undefined,
  templateKey: row.template_key as ClientDocument["templateKey"], title: String(row.title), fileName: String(row.file_name),
  dataSnapshot: (row.data_snapshot as Record<string, unknown>) ?? {}, status: row.status as ClientDocument["status"],
  generatedBy: String(row.generated_by), generatedAt: String(row.generated_at), sentAt: row.sent_at ? String(row.sent_at) : undefined
});

export const mapCommunicationThread = (row: Record<string, unknown>): CommunicationThread => ({
  id: String(row.id), opportunityId: String(row.opportunity_id), stakeholderId: String(row.stakeholder_id),
  channel: row.channel as CommunicationThread["channel"], assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
  status: row.status as CommunicationThread["status"], unreadCount: Number(row.unread_count ?? 0),
  lastMessageAt: row.last_message_at ? String(row.last_message_at) : undefined,
  lastInboundAt: row.last_inbound_at ? String(row.last_inbound_at) : undefined,
  lastOutboundAt: row.last_outbound_at ? String(row.last_outbound_at) : undefined,
  createdAt: String(row.created_at), updatedAt: String(row.updated_at)
});

export const mapCommunicationAssignmentHistory = (row: Record<string, unknown>): CommunicationAssignmentHistory => ({
  id: String(row.id), threadId: String(row.thread_id),
  previousAgentId: row.previous_agent_id ? String(row.previous_agent_id) : undefined,
  newAgentId: row.new_agent_id ? String(row.new_agent_id) : undefined,
  changedBy: String(row.changed_by), reason: row.reason ? String(row.reason) : undefined, changedAt: String(row.changed_at)
});

export const mapScheduledCommunication = (row: Record<string, unknown>): ScheduledCommunication => ({
  id: String(row.id), threadId: row.thread_id ? String(row.thread_id) : undefined,
  opportunityId: String(row.opportunity_id), stakeholderId: String(row.stakeholder_id),
  channel: row.channel as ScheduledCommunication["channel"], bodyText: String(row.body_text ?? ""),
  templateKey: row.template_key ? String(row.template_key) : undefined,
  attachmentPath: row.attachment_path ? String(row.attachment_path) : undefined,
  attachmentName: row.attachment_name ? String(row.attachment_name) : undefined,
  scheduledFor: String(row.scheduled_for), recurrenceMonths: row.recurrence_months ? Number(row.recurrence_months) : undefined,
  status: row.status as ScheduledCommunication["status"], createdBy: String(row.created_by),
  sentCommunicationId: row.sent_communication_id ? String(row.sent_communication_id) : undefined,
  errorMessage: row.last_error ? String(row.last_error) : undefined,
  createdAt: String(row.created_at), updatedAt: String(row.updated_at)
});

export const mapMarketingLead = (row: Record<string, unknown>): MarketingLead => ({
  id: String(row.id), provider: String(row.provider ?? "meta"), sourceChannel: String(row.source_channel ?? "other"),
  leadId: row.lead_id ? String(row.lead_id) : undefined, formId: row.form_id ? String(row.form_id) : undefined,
  campaignId: row.campaign_id ? String(row.campaign_id) : undefined, campaignName: row.campaign_name ? String(row.campaign_name) : undefined,
  adId: row.ad_id ? String(row.ad_id) : undefined, adName: row.ad_name ? String(row.ad_name) : undefined,
  fullName: row.full_name ? String(row.full_name) : undefined, phone: row.phone ? String(row.phone) : undefined,
  email: row.email ? String(row.email) : undefined, condominiumName: row.condominium_name ? String(row.condominium_name) : undefined,
  sector: row.sector ? String(row.sector) : undefined, units: row.units ? Number(row.units) : undefined,
  primaryProblem: row.primary_problem ? String(row.primary_problem) : undefined, stakeholderRole: row.stakeholder_role ? String(row.stakeholder_role) : undefined,
  boardMember: row.board_member === null || row.board_member === undefined ? undefined : Boolean(row.board_member),
  wantsAssessment: row.wants_assessment === null || row.wants_assessment === undefined ? undefined : Boolean(row.wants_assessment),
  status: row.status as MarketingLead["status"], accountId: row.account_id ? String(row.account_id) : undefined,
  stakeholderId: row.stakeholder_id ? String(row.stakeholder_id) : undefined, opportunityId: row.opportunity_id ? String(row.opportunity_id) : undefined,
  assignedTo: row.assigned_to ? String(row.assigned_to) : undefined, errorMessage: row.error_message ? String(row.error_message) : undefined,
  receivedAt: String(row.received_at), convertedAt: row.converted_at ? String(row.converted_at) : undefined
});

export const mapArmAgent = (row: Record<string, unknown>): ArmAgent => ({
  id: String(row.id), name: String(row.name), slug: String(row.slug), kind: row.kind as ArmAgent["kind"],
  roleKey: String(row.role_key), description: String(row.description), status: row.status as ArmAgent["status"],
  autonomyLevel: row.autonomy_level as ArmAgent["autonomyLevel"], riskLevel: row.risk_level as ArmAgent["riskLevel"],
  requiresHumanApproval: Boolean(row.requires_human_approval), capabilities: (row.capabilities as string[]) ?? [],
  allowedChannels: (row.allowed_channels as string[]) ?? [], systemInstructions: row.system_instructions ? String(row.system_instructions) : undefined,
  ownerId: row.owner_id ? String(row.owner_id) : undefined, createdAt: String(row.created_at), updatedAt: String(row.updated_at)
});

export const mapArmAssignment = (row: Record<string, unknown>): ArmAgentAssignment => ({
  id: String(row.id), agentId: String(row.agent_id), opportunityId: String(row.opportunity_id),
  relationshipRole: row.relationship_role as ArmAgentAssignment["relationshipRole"], status: row.status as ArmAgentAssignment["status"],
  notes: row.notes ? String(row.notes) : undefined, assignedBy: String(row.assigned_by), assignedAt: String(row.assigned_at), updatedAt: String(row.updated_at)
});

export const mapArmInteraction = (row: Record<string, unknown>): ArmInteraction => ({
  id: String(row.id), agentId: String(row.agent_id), opportunityId: row.opportunity_id ? String(row.opportunity_id) : undefined,
  stakeholderId: row.stakeholder_id ? String(row.stakeholder_id) : undefined, initiatedBy: String(row.initiated_by),
  interactionType: String(row.interaction_type), inputSummary: String(row.input_summary), outputSummary: row.output_summary ? String(row.output_summary) : undefined,
  decisionStatus: row.decision_status as ArmInteraction["decisionStatus"], confidenceScore: row.confidence_score === null || row.confidence_score === undefined ? undefined : Number(row.confidence_score),
  requiresApproval: Boolean(row.requires_approval), approvedBy: row.approved_by ? String(row.approved_by) : undefined,
  approvedAt: row.approved_at ? String(row.approved_at) : undefined, outcome: row.outcome ? String(row.outcome) : undefined,
  createdAt: String(row.created_at), updatedAt: String(row.updated_at)
});
