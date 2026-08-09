import type { Account, CommercialReference, Opportunity, Proposal, Stakeholder, Task, UserProfile } from "@/types/domain";

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
  referenceIds: (row.reference_ids as string[]) ?? [], status: row.status as Proposal["status"], generatedAt: String(row.generated_at)
});

export const mapReference = (row: Record<string, unknown>): CommercialReference => ({
  id: String(row.id), clientName: String(row.client_name), location: String(row.location), units: Number(row.units),
  accountType: row.account_type as CommercialReference["accountType"], profile: String(row.profile ?? ""), approved: Boolean(row.approved)
});
