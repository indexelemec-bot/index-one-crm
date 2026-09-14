import type { OpportunityStage, ProjectType } from "@/types/domain";

export type WeeklyReportFilters = {
  start: string;
  endExclusive: string;
  sellerId?: string;
  projectType?: ProjectType;
  source?: string;
  stage?: OpportunityStage;
  status?: "active" | "won" | "lost";
};

export type ReportSettings = {
  neverContactedBusinessDays: number;
  inactiveDays: number;
  proposalFollowupDays: number;
};

type AccountRow = {
  id: string; name: string; owner_id: string; source: string | null; project_type: ProjectType;
  residential_subtype: string | null; created_at: string;
};
type OpportunityRow = {
  id: string; account_id: string; owner_id: string; stage: OpportunityStage; next_action: string | null;
  next_action_at: string | null; monthly_fee: number | string | null; created_at: string; updated_at: string;
};
type ActivityRow = { opportunity_id: string; activity_type: string; due_at: string | null; completed_at: string | null; created_at: string };
type TaskRow = { opportunity_id: string; owner_id: string; status: string; due_at: string; created_at: string };
type ProposalRow = { opportunity_id: string; status: string; generated_at: string; sent_at: string | null };
type CommunicationRow = { opportunity_id: string; created_at: string; sent_at: string | null };
type SaleRow = { opportunity_id: string; seller_id: string; closed_at: string; final_fee: number | string };
type StageHistoryRow = {
  id: string; opportunity_id: string; previous_stage: OpportunityStage | null; new_stage: OpportunityStage;
  moved_by: string | null; owner_id_snapshot: string; moved_at: string; previous_stage_duration_seconds: number | string | null;
  change_note: string | null;
};
type ProfileRow = { id: string; full_name: string; role: string; active: boolean };

export type WeeklyReportInput = {
  filters: WeeklyReportFilters;
  settings: ReportSettings;
  accounts: AccountRow[];
  opportunities: OpportunityRow[];
  activities: ActivityRow[];
  tasks: TaskRow[];
  proposals: ProposalRow[];
  communications: CommunicationRow[];
  sales: SaleRow[];
  stageHistory: StageHistoryRow[];
  profiles: ProfileRow[];
};

export type WeeklyReport = ReturnType<typeof buildWeeklyReport>;

const activeStages = new Set<OpportunityStage>([
  "prospecto_identificado", "problema_detectado", "contacto_decisor", "diagnostico", "solucion_recomendada",
  "presentacion", "propuesta", "propuesta_enviada", "negociacion", "aprobacion", "contrato_transicion"
]);

const inRange = (value: string | null | undefined, start: number, end: number) => {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= start && time < end;
};

const maxTime = (...values: Array<string | null | undefined>) => values.reduce<number>((latest, value) => {
  if (!value) return latest;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.max(latest, time) : latest;
}, 0);

const businessDaysBetween = (from: string, to: Date) => {
  const cursor = new Date(from);
  if (Number.isNaN(cursor.getTime()) || cursor >= to) return 0;
  cursor.setHours(0, 0, 0, 0);
  const limit = new Date(to); limit.setHours(0, 0, 0, 0);
  let days = 0;
  while (cursor < limit) {
    cursor.setDate(cursor.getDate() + 1);
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
  }
  return days;
};

const isContactActivity = (activityType: string) => /(contact|llamad|reuni|correo|email|whatsapp|visita|presentaci)/i.test(activityType);
const hours = (seconds: number | string | null) => seconds == null ? null : Math.round(Number(seconds) / 3600);

export function buildWeeklyReport(input: WeeklyReportInput) {
  const { filters, settings } = input;
  const start = new Date(filters.start).getTime();
  const end = new Date(filters.endExclusive).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error("Rango semanal inválido");
  const asOf = new Date(Math.min(Date.now(), end - 1));
  const accountById = new Map(input.accounts.map((row) => [row.id, row]));
  const profileById = new Map(input.profiles.map((row) => [row.id, row]));

  const opportunities = input.opportunities.filter((opportunity) => {
    const account = accountById.get(opportunity.account_id);
    if (!account) return false;
    if (filters.sellerId && opportunity.owner_id !== filters.sellerId) return false;
    if (filters.projectType && account.project_type !== filters.projectType) return false;
    if (filters.source && account.source !== filters.source) return false;
    if (filters.stage && opportunity.stage !== filters.stage) return false;
    if (filters.status === "active" && !activeStages.has(opportunity.stage)) return false;
    if (filters.status === "won" && opportunity.stage !== "cliente_activo") return false;
    if (filters.status === "lost" && opportunity.stage !== "perdida") return false;
    return true;
  });
  const opportunityIds = new Set(opportunities.map((row) => row.id));
  const accountIds = new Set(opportunities.map((row) => row.account_id));
  const activities = input.activities.filter((row) => opportunityIds.has(row.opportunity_id));
  const tasks = input.tasks.filter((row) => opportunityIds.has(row.opportunity_id));
  const proposals = input.proposals.filter((row) => opportunityIds.has(row.opportunity_id));
  const communications = input.communications.filter((row) => opportunityIds.has(row.opportunity_id));
  const sales = input.sales.filter((row) => opportunityIds.has(row.opportunity_id));
  const stageHistory = input.stageHistory.filter((row) => opportunityIds.has(row.opportunity_id));

  const contactDates = new Map<string, string[]>();
  communications.forEach((row) => contactDates.set(row.opportunity_id, [...(contactDates.get(row.opportunity_id) ?? []), row.sent_at ?? row.created_at]));
  activities.filter((row) => isContactActivity(row.activity_type)).forEach((row) => contactDates.set(row.opportunity_id, [...(contactDates.get(row.opportunity_id) ?? []), row.completed_at ?? row.created_at]));

  const contactedThisWeek = new Set<string>();
  contactDates.forEach((dates, opportunityId) => { if (dates.some((date) => inRange(date, start, end))) contactedThisWeek.add(opportunityId); });
  const neverContacted = opportunities.filter((row) => {
    const account = accountById.get(row.account_id)!;
    return activeStages.has(row.stage) && !(contactDates.get(row.id)?.length) && businessDaysBetween(account.created_at, asOf) > settings.neverContactedBusinessDays;
  });

  const lastMovementByOpportunity = new Map<string, number>();
  stageHistory.forEach((row) => lastMovementByOpportunity.set(row.opportunity_id, Math.max(lastMovementByOpportunity.get(row.opportunity_id) ?? 0, new Date(row.moved_at).getTime())));
  const lastActivityByOpportunity = new Map<string, number>();
  opportunities.forEach((row) => lastActivityByOpportunity.set(row.id, maxTime(row.created_at, row.updated_at)));
  activities.forEach((row) => lastActivityByOpportunity.set(row.opportunity_id, Math.max(lastActivityByOpportunity.get(row.opportunity_id) ?? 0, maxTime(row.created_at, row.completed_at))));
  tasks.forEach((row) => lastActivityByOpportunity.set(row.opportunity_id, Math.max(lastActivityByOpportunity.get(row.opportunity_id) ?? 0, maxTime(row.created_at))));
  proposals.forEach((row) => lastActivityByOpportunity.set(row.opportunity_id, Math.max(lastActivityByOpportunity.get(row.opportunity_id) ?? 0, maxTime(row.generated_at, row.sent_at))));
  communications.forEach((row) => lastActivityByOpportunity.set(row.opportunity_id, Math.max(lastActivityByOpportunity.get(row.opportunity_id) ?? 0, maxTime(row.created_at, row.sent_at))));
  stageHistory.forEach((row) => lastActivityByOpportunity.set(row.opportunity_id, Math.max(lastActivityByOpportunity.get(row.opportunity_id) ?? 0, maxTime(row.moved_at))));

  const stagnant = opportunities.filter((row) => activeStages.has(row.stage) && asOf.getTime() - (lastActivityByOpportunity.get(row.id) ?? 0) > settings.inactiveDays * 86_400_000);
  const overdueTasks = tasks.filter((row) => row.status !== "completada" && new Date(row.due_at).getTime() < asOf.getTime());
  const movements = stageHistory.filter((row) => row.previous_stage && inRange(row.moved_at, start, end));
  const generatedProposals = proposals.filter((row) => inRange(row.generated_at, start, end));
  const sentProposals = proposals.filter((row) => row.status === "enviada" || inRange(row.sent_at, start, end)).filter((row) => inRange(row.sent_at ?? row.generated_at, start, end));
  const meetingsScheduled = activities.filter((row) => /reuni/i.test(row.activity_type) && inRange(row.due_at ?? row.created_at, start, end));
  const meetingsHeld = activities.filter((row) => /reuni/i.test(row.activity_type) && inRange(row.completed_at, start, end));
  const won = sales.filter((row) => inRange(row.closed_at, start, end));
  const lost = movements.filter((row) => row.new_stage === "perdida");
  const newAccounts = input.accounts.filter((row) => accountIds.has(row.id) && inRange(row.created_at, start, end));
  const nextActions = opportunities.filter((row) => activeStages.has(row.stage) && row.next_action && row.next_action_at);
  const approachingClose = opportunities.filter((row) => ["negociacion", "aprobacion", "contrato_transicion"].includes(row.stage));

  const attention = opportunities.flatMap((row) => {
    const account = accountById.get(row.account_id)!;
    const reasons: string[] = [];
    if (neverContacted.some((item) => item.id === row.id)) reasons.push("Nunca contactado");
    if (stagnant.some((item) => item.id === row.id)) reasons.push(`Sin actividad por más de ${settings.inactiveDays} días`);
    if (overdueTasks.some((item) => item.opportunity_id === row.id)) reasons.push("Seguimiento vencido");
    if (activeStages.has(row.stage) && (!row.next_action || !row.next_action_at)) reasons.push("Sin próxima acción");
    const sent = proposals.filter((proposal) => proposal.opportunity_id === row.id && proposal.sent_at).sort((a, b) => new Date(b.sent_at!).getTime() - new Date(a.sent_at!).getTime())[0];
    if (sent && asOf.getTime() - new Date(sent.sent_at!).getTime() > settings.proposalFollowupDays * 86_400_000 && !contactDates.get(row.id)?.some((date) => new Date(date) > new Date(sent.sent_at!))) reasons.push("Propuesta enviada sin seguimiento");
    return reasons.length ? [{ opportunityId: row.id, accountId: row.account_id, accountName: account.name, sellerId: row.owner_id, sellerName: profileById.get(row.owner_id)?.full_name ?? "Sin asignar", stage: row.stage, lastActivityAt: new Date(lastActivityByOpportunity.get(row.id) ?? 0).toISOString(), reasons }] : [];
  });

  const sellerIds = [...new Set(opportunities.map((row) => row.owner_id))];
  const sellers = sellerIds.map((sellerId) => {
    const portfolio = opportunities.filter((row) => row.owner_id === sellerId);
    const ids = new Set(portfolio.map((row) => row.id));
    const assignedAccounts = new Set(portfolio.map((row) => row.account_id));
    const withNextAction = portfolio.filter((row) => activeStages.has(row.stage) && row.next_action && row.next_action_at).length;
    const active = portfolio.filter((row) => activeStages.has(row.stage));
    return {
      sellerId,
      sellerName: profileById.get(sellerId)?.full_name ?? "Sin asignar",
      portfolio: portfolio.length,
      active: active.length,
      newAssigned: input.accounts.filter((row) => assignedAccounts.has(row.id) && inRange(row.created_at, start, end)).length,
      contacts: new Set([...contactedThisWeek].filter((id) => ids.has(id))).size,
      meetings: meetingsHeld.filter((row) => ids.has(row.opportunity_id)).length,
      proposals: generatedProposals.filter((row) => ids.has(row.opportunity_id)).length,
      movements: movements.filter((row) => ids.has(row.opportunity_id)).length,
      won: won.filter((row) => ids.has(row.opportunity_id)).length,
      lost: lost.filter((row) => ids.has(row.opportunity_id)).length,
      stagnant: stagnant.filter((row) => ids.has(row.id)).length,
      neverContacted: neverContacted.filter((row) => ids.has(row.id)).length,
      overdue: overdueTasks.filter((row) => ids.has(row.opportunity_id)).length,
      nextActionCoverage: active.length ? Math.round((withNextAction / active.length) * 100) : 100
    };
  }).sort((a, b) => b.won - a.won || b.movements - a.movements || b.contacts - a.contacts);

  return {
    generatedAt: new Date().toISOString(),
    range: { start: filters.start, endExclusive: filters.endExclusive },
    settings,
    kpis: {
      newProspects: newAccounts.length,
      contacted: contactedThisWeek.size,
      neverContacted: neverContacted.length,
      stageMovements: movements.length,
      stagnant: stagnant.length,
      meetingsScheduled: meetingsScheduled.length,
      meetingsHeld: meetingsHeld.length,
      proposalsGenerated: generatedProposals.length,
      proposalsSent: sentProposals.length,
      inNegotiation: opportunities.filter((row) => row.stage === "negociacion").length,
      won: won.length,
      lost: lost.length,
      overdueFollowups: overdueTasks.length,
      pendingNextActions: nextActions.length,
      approachingClose: approachingClose.length,
      wonMonthlyValue: won.reduce((sum, row) => sum + Number(row.final_fee || 0), 0)
    },
    executive: {
      advanced: movements.filter((row) => row.new_stage !== "perdida").length,
      atRisk: attention.length,
      approachingClose: approachingClose.map((row) => ({ opportunityId: row.id, accountId: row.account_id, accountName: accountById.get(row.account_id)?.name ?? "Prospecto", stage: row.stage, monthlyFee: Number(row.monthly_fee || 0) }))
    },
    movements: movements.sort((a, b) => new Date(b.moved_at).getTime() - new Date(a.moved_at).getTime()).map((row) => ({
      id: row.id,
      opportunityId: row.opportunity_id,
      accountId: opportunities.find((item) => item.id === row.opportunity_id)?.account_id ?? "",
      accountName: accountById.get(opportunities.find((item) => item.id === row.opportunity_id)?.account_id ?? "")?.name ?? "Prospecto",
      previousStage: row.previous_stage,
      newStage: row.new_stage,
      sellerName: profileById.get(row.owner_id_snapshot)?.full_name ?? "Sin asignar",
      changedByName: row.moved_by ? profileById.get(row.moved_by)?.full_name ?? "Usuario" : "Sistema",
      movedAt: row.moved_at,
      previousStageHours: hours(row.previous_stage_duration_seconds),
      note: row.change_note
    })),
    attention: attention.sort((a, b) => b.reasons.length - a.reasons.length || a.accountName.localeCompare(b.accountName)),
    sellers,
    sources: [...new Set(input.accounts.map((row) => row.source).filter((source): source is string => Boolean(source)))].sort(),
    profiles: input.profiles.filter((row) => row.active && ["superadmin", "gerencia_comercial", "ejecutivo"].includes(row.role)).map((row) => ({ id: row.id, name: row.full_name }))
  };
}
