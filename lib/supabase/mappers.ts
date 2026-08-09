import type { Account, AssignmentHistory, CommercialReference, Communication, Opportunity, Proposal, SalesReport, SpeechUsage, Stakeholder, Task, UserProfile } from "@/types/domain";

export const mapProfile = (row: Record<string, unknown>): UserProfile => ({
  id: String(row.id), fullName: String(row.full_name), email: String(row.email ?? ""),
  role: row.role as UserProfile["role"], active: Boolean(row.active)
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
  nextActionAt: String(row.next_action_at), ownerId: String(row.owner_id), updatedAt: String(row.updated_at)
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
  stakeholderId: row.stakeholder_id ? String(row.stakeholder_id) : undefined, channel: row.channel as Communication["channel"],
  direction: row.direction as Communication["direction"], fromAddress: String(row.from_address), toAddress: String(row.to_address),
  subject: row.subject ? String(row.subject) : undefined, bodyText: String(row.body_text), templateKey: row.template_key ? String(row.template_key) : undefined,
  provider: row.provider ? String(row.provider) : undefined, providerMessageId: row.provider_message_id ? String(row.provider_message_id) : undefined,
  attachmentFormat: row.attachment_format === "pdf" || row.attachment_format === "docx" ? row.attachment_format : undefined,
  status: String(row.status), errorMessage: row.error_message ? String(row.error_message) : undefined,
  sentAt: row.sent_at ? String(row.sent_at) : undefined, deliveredAt: row.delivered_at ? String(row.delivered_at) : undefined,
  openedAt: row.opened_at ? String(row.opened_at) : undefined, createdAt: String(row.created_at)
});
