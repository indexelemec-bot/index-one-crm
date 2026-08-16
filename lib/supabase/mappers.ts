import type { Account, AssignmentHistory, CommercialReference, Communication, CommunicationAssignmentHistory, CommunicationThread, Opportunity, Proposal, SalesReport, ScheduledCommunication, SpeechUsage, Stakeholder, Task, UserProfile } from "@/types/domain";

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
  stakeholderId: row.stakeholder_id ? String(row.stakeholder_id) : undefined, threadId: row.thread_id ? String(row.thread_id) : undefined,
  channel: row.channel as Communication["channel"], direction: row.direction as Communication["direction"],
  fromAddress: String(row.from_address ?? ""), toAddress: String(row.to_address ?? ""), subject: row.subject ? String(row.subject) : undefined,
  bodyText: String(row.body_text ?? ""), templateKey: row.template_key ? String(row.template_key) : undefined,
  provider: row.provider ? String(row.provider) : undefined, providerMessageId: row.provider_message_id ? String(row.provider_message_id) : undefined,
  attachmentFormat: row.attachment_format === "pdf" || row.attachment_format === "docx" ? row.attachment_format : undefined,
  status: String(row.status), errorMessage: row.error_message ? String(row.error_message) : undefined,
  agentId: row.agent_id ? String(row.agent_id) : undefined, agentNameSnapshot: row.agent_name_snapshot ? String(row.agent_name_snapshot) : undefined,
  messageType: row.message_type ? String(row.message_type) : undefined, mediaPath: row.media_path ? String(row.media_path) : undefined,
  mediaName: row.media_name ? String(row.media_name) : undefined, mediaMime: row.media_mime_type ? String(row.media_mime_type) : undefined,
  replyToProviderMessageId: row.reply_to_provider_message_id ? String(row.reply_to_provider_message_id) : undefined,
  isInternal: Boolean(row.is_internal), sentAt: row.sent_at ? String(row.sent_at) : undefined,
  deliveredAt: row.delivered_at ? String(row.delivered_at) : undefined, openedAt: row.opened_at ? String(row.opened_at) : undefined,
  createdAt: String(row.created_at)
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
