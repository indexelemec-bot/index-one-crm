"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  accounts as demoAccounts, opportunities as demoOpportunities, proposals as demoProposals,
  references as demoReferences, salesReports as demoSalesReports, stakeholders as demoStakeholders, tasks as demoTasks, users as demoUsers
} from "@/lib/mock-data";
import { calculateSaleFigures } from "@/lib/commissions";
import { mapAccount, mapAssignmentHistory, mapOpportunity, mapProfile, mapProposal, mapReference, mapSalesReport, mapSpeechUsage, mapStakeholder, mapTask } from "@/lib/supabase/mappers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Account, AssignmentHistory, CommercialReference, Opportunity, Proposal, SalesReport, SpeechUsage, Stakeholder, Task, UserProfile } from "@/types/domain";

type NewProspect = { account: Account; stakeholder: Stakeholder; opportunity: Opportunity };
type CloseSaleInput = { opportunityId: string; finalFee: number; closedAt: string; contractReference: string; firstPaymentReceived: boolean; notes?: string };
type InviteUserInput = Pick<UserProfile, "fullName" | "email" | "role">;
type Store = {
  accounts: Account[]; opportunities: Opportunity[]; stakeholders: Stakeholder[]; tasks: Task[]; proposals: Proposal[];
  references: CommercialReference[]; users: UserProfile[]; salesReports: SalesReport[]; assignmentHistory: AssignmentHistory[]; speechUsages: SpeechUsage[]; currentUser: UserProfile; loading: boolean; syncError: string;
  setCurrentUser: (user: UserProfile) => void; addProspect: (data: NewProspect) => void;
  updateOpportunity: (id: string, patch: Partial<Opportunity>) => void; addTask: (task: Task) => void;
  completeTask: (id: string, outcome: string, nextTask?: Task) => void; addProposal: (proposal: Proposal) => void;
  toggleUser: (id: string) => void; resetDemo: () => void; inviteUser: (input: InviteUserInput) => Promise<{ ok: boolean; error?: string }>;
  assignOpportunity: (id: string, newOwnerId: string, reason: string) => void; closeSale: (input: CloseSaleInput) => void;
  confirmFirstPayment: (reportId: string) => void; markCommissionPaid: (reportId: string) => void;
  markSpeechUsed: (usage: SpeechUsage) => Promise<boolean>;
};

const CrmContext = createContext<Store | null>(null);
const storageKey = "index-one-crm-v03";

const opportunityPatchToDb = (patch: Partial<Opportunity>) => ({
  ...(patch.stage !== undefined && { stage: patch.stage }),
  ...(patch.primaryProblem !== undefined && { primary_problem: patch.primaryProblem }),
  ...(patch.impact !== undefined && { impact: patch.impact }),
  ...(patch.proposedSolution !== undefined && { proposed_solution: patch.proposedSolution }),
  ...(patch.monthlyFee !== undefined && { monthly_fee: patch.monthlyFee }),
  ...(patch.probability !== undefined && { probability: patch.probability }),
  ...(patch.nextAction !== undefined && { next_action: patch.nextAction }),
  ...(patch.nextActionAt !== undefined && { next_action_at: patch.nextActionAt }),
  updated_at: new Date().toISOString()
});

export function CrmProvider({ children }: { children: React.ReactNode }) {
  const remote = isSupabaseConfigured;
  const [accounts, setAccounts] = useState(remote ? [] : demoAccounts);
  const [opportunities, setOpportunities] = useState(remote ? [] : demoOpportunities);
  const [stakeholders, setStakeholders] = useState(remote ? [] : demoStakeholders);
  const [tasks, setTasks] = useState(remote ? [] : demoTasks);
  const [proposals, setProposals] = useState(remote ? [] : demoProposals);
  const [references, setReferences] = useState(remote ? [] : demoReferences);
  const [salesReports, setSalesReports] = useState(remote ? [] : demoSalesReports);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistory[]>([]);
  const [speechUsages, setSpeechUsages] = useState<SpeechUsage[]>([]);
  const [profiles, setProfiles] = useState(demoUsers);
  const [currentUser, setCurrentUser] = useState(demoUsers[0]);
  const [loading, setLoading] = useState(remote);
  const [syncError, setSyncError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const loadRemote = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    setLoading(true); setSyncError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw authError ?? new Error("Sesión no disponible");
      const [profileResult, accountResult, stakeholderResult, opportunityResult, taskResult, proposalResult, referenceResult, reportResult, assignmentResult, speechUsageResult] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("accounts").select("*").order("created_at", { ascending: false }),
        supabase.from("stakeholders").select("*").order("created_at", { ascending: false }),
        supabase.from("opportunities").select("*").order("updated_at", { ascending: false }),
        supabase.from("tasks").select("*").order("due_at"),
        supabase.from("proposals").select("*").order("generated_at", { ascending: false }),
        supabase.from("references_catalog").select("*").eq("approved", true).order("client_name"),
        supabase.from("sales_reports").select("*").order("closed_at", { ascending: false }),
        supabase.from("opportunity_assignment_history").select("*").order("changed_at", { ascending: false }),
        supabase.from("opportunity_speech_usage").select("*").order("used_at", { ascending: false })
      ]);
      const failure = [profileResult, accountResult, stakeholderResult, opportunityResult, taskResult, proposalResult, referenceResult, reportResult, assignmentResult, speechUsageResult].find((result) => result.error)?.error;
      if (failure) throw failure;
      const mappedProfiles = (profileResult.data ?? []).map((row) => mapProfile(row));
      const authenticatedProfile = mappedProfiles.find((profile) => profile.id === authData.user.id);
      if (!authenticatedProfile) throw new Error("El usuario autenticado no tiene perfil CRM");
      setProfiles(mappedProfiles); setCurrentUser(authenticatedProfile);
      setAccounts((accountResult.data ?? []).map((row) => mapAccount(row)));
      setStakeholders((stakeholderResult.data ?? []).map((row) => mapStakeholder(row)));
      setOpportunities((opportunityResult.data ?? []).map((row) => mapOpportunity(row)));
      setTasks((taskResult.data ?? []).map((row) => mapTask(row)));
      setProposals((proposalResult.data ?? []).map((row) => mapProposal(row)));
      setReferences((referenceResult.data ?? []).map((row) => mapReference(row)));
      setSalesReports((reportResult.data ?? []).map((row) => mapSalesReport(row)));
      setAssignmentHistory((assignmentResult.data ?? []).map((row) => mapAssignmentHistory(row)));
      setSpeechUsages((speechUsageResult.data ?? []).map((row) => mapSpeechUsage(row)));
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No fue posible sincronizar con Supabase");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (remote) { void loadRemote(); return; }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        setAccounts(data.accounts ?? demoAccounts); setOpportunities(data.opportunities ?? demoOpportunities);
        setStakeholders(data.stakeholders ?? demoStakeholders); setTasks(data.tasks ?? demoTasks);
        setProposals(data.proposals ?? demoProposals); setProfiles(data.users ?? demoUsers); setSalesReports(data.salesReports ?? demoSalesReports); setSpeechUsages(data.speechUsages ?? []);
      }
    } catch { localStorage.removeItem(storageKey); }
    setHydrated(true);
  }, [loadRemote, remote]);

  useEffect(() => {
    if (!remote && hydrated) localStorage.setItem(storageKey, JSON.stringify({ accounts, opportunities, stakeholders, tasks, proposals, salesReports, assignmentHistory, speechUsages, users: profiles }));
  }, [accounts, opportunities, stakeholders, tasks, proposals, salesReports, assignmentHistory, speechUsages, profiles, hydrated, remote]);

  const recoverFrom = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : "No fue posible guardar el cambio";
    setSyncError(message);
    void loadRemote();
  }, [loadRemote]);

  const value = useMemo<Store>(() => ({
    accounts, opportunities, stakeholders, tasks, proposals, references, salesReports, assignmentHistory, speechUsages, users: profiles, currentUser, loading, syncError, setCurrentUser,
    addProspect: (data) => {
      if (!remote) { setAccounts((items) => [data.account, ...items]); setStakeholders((items) => [data.stakeholder, ...items]); setOpportunities((items) => [data.opportunity, ...items]); return; }
      const accountId = crypto.randomUUID(); const stakeholderId = crypto.randomUUID(); const opportunityId = crypto.randomUUID();
      const account = { ...data.account, id: accountId, ownerId: currentUser.id };
      const stakeholder = { ...data.stakeholder, id: stakeholderId, accountId };
      const opportunity = { ...data.opportunity, id: opportunityId, accountId, ownerId: currentUser.id };
      setAccounts((items) => [account, ...items]); setStakeholders((items) => [stakeholder, ...items]); setOpportunities((items) => [opportunity, ...items]);
      void (async () => {
        const supabase = createClient()!;
        const { error: accountError } = await supabase.from("accounts").insert({ id: accountId, name: account.name, account_type: account.accountType, address: account.address, sector: account.sector, city: account.city, units: account.units, towers: account.towers, profile: account.profile, source: account.source, created_by: currentUser.id, owner_id: currentUser.id });
        if (accountError) throw accountError;
        const [{ error: stakeholderError }, { error: opportunityError }] = await Promise.all([
          supabase.from("stakeholders").insert({ id: stakeholderId, account_id: accountId, full_name: stakeholder.fullName, role: stakeholder.role, phone: stakeholder.phone, email: stakeholder.email, influence: stakeholder.influence, position: stakeholder.position, is_decision_maker: stakeholder.isDecisionMaker }),
          supabase.from("opportunities").insert({ id: opportunityId, account_id: accountId, stage: opportunity.stage, primary_problem: opportunity.primaryProblem, impact: opportunity.impact, proposed_solution: opportunity.proposedSolution, monthly_fee: opportunity.monthlyFee, probability: opportunity.probability, next_action: opportunity.nextAction, next_action_at: opportunity.nextActionAt, owner_id: currentUser.id })
        ]);
        if (stakeholderError || opportunityError) throw stakeholderError ?? opportunityError;
      })().catch(recoverFrom);
    },
    updateOpportunity: (id, patch) => {
      setOpportunities((items) => items.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
      if (remote) void createClient()!.from("opportunities").update(opportunityPatchToDb(patch)).eq("id", id).then(({ error }) => { if (error) recoverFrom(error); });
    },
    addTask: (task) => {
      const savedTask = remote ? { ...task, id: crypto.randomUUID(), ownerId: currentUser.id } : task;
      setTasks((items) => [savedTask, ...items]);
      if (remote) void createClient()!.from("tasks").insert({ id: savedTask.id, opportunity_id: savedTask.opportunityId, title: savedTask.title, due_at: savedTask.dueAt, priority: savedTask.priority, status: savedTask.status, owner_id: savedTask.ownerId }).then(({ error }) => { if (error) recoverFrom(error); });
    },
    completeTask: (id, outcome, nextTask) => {
      const savedNext = nextTask && remote ? { ...nextTask, id: crypto.randomUUID() } : nextTask;
      setTasks((items) => items.map((task) => task.id === id ? { ...task, status: "completada", outcome } : task));
      if (savedNext) setTasks((items) => [savedNext, ...items]);
      if (remote) void (async () => {
        const supabase = createClient()!;
        const { error: taskError } = await supabase.from("tasks").update({ status: "completada", outcome }).eq("id", id);
        if (taskError) throw taskError;
        if (savedNext) {
          const { error: nextError } = await supabase.from("tasks").insert({ id: savedNext.id, opportunity_id: savedNext.opportunityId, title: savedNext.title, due_at: savedNext.dueAt, priority: savedNext.priority, status: savedNext.status, owner_id: savedNext.ownerId });
          if (nextError) throw nextError;
          const { error: opportunityError } = await supabase.from("opportunities").update({ next_action: savedNext.title, next_action_at: savedNext.dueAt, updated_at: new Date().toISOString() }).eq("id", savedNext.opportunityId);
          if (opportunityError) throw opportunityError;
        }
      })().catch(recoverFrom);
    },
    addProposal: (proposal) => {
      const savedProposal = remote ? { ...proposal, id: crypto.randomUUID() } : proposal;
      setProposals((items) => [savedProposal, ...items]);
      if (remote) void createClient()!.from("proposals").insert({ id: savedProposal.id, opportunity_id: savedProposal.opportunityId, version: savedProposal.version, client_name: savedProposal.clientName, issue_date: savedProposal.issueDate, monthly_fee: savedProposal.monthlyFee, reference_ids: savedProposal.referenceIds, status: savedProposal.status, file_format: savedProposal.fileFormat, change_reason: savedProposal.changeReason || null, generated_by: currentUser.id }).then(({ error }) => { if (error) recoverFrom(error); });
    },
    inviteUser: async (input) => {
      if (!remote) { setProfiles((items) => [{ id: `u${Date.now()}`, ...input, active: true }, ...items]); return { ok: true }; }
      const response = await fetch("/api/admin/users/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { const message = result.error ?? "No fue posible enviar la invitación."; setSyncError(message); return { ok: false, error: message }; }
      await loadRemote(); return { ok: true };
    },
    toggleUser: (id) => {
      const target = profiles.find((profile) => profile.id === id); if (!target) return;
      setProfiles((items) => items.map((profile) => profile.id === id ? { ...profile, active: !profile.active } : profile));
      if (remote) void createClient()!.from("profiles").update({ active: !target.active, updated_at: new Date().toISOString() }).eq("id", id).then(({ error }) => { if (error) recoverFrom(error); });
    },
    assignOpportunity: (id, newOwnerId, reason) => {
      const target = opportunities.find((item) => item.id === id); if (!target || target.ownerId === newOwnerId) return;
      const history: AssignmentHistory = { id: remote ? crypto.randomUUID() : `ah${Date.now()}`, opportunityId: id, previousOwnerId: target.ownerId, newOwnerId, changedBy: currentUser.id, changeReason: reason.trim(), changedAt: new Date().toISOString() };
      setOpportunities((items) => items.map((item) => item.id === id ? { ...item, ownerId: newOwnerId, updatedAt: history.changedAt } : item));
      setAssignmentHistory((items) => [history, ...items]);
      if (remote) void (async () => { const supabase = createClient()!; const { error: updateError } = await supabase.from("opportunities").update({ owner_id: newOwnerId, updated_at: history.changedAt }).eq("id", id); if (updateError) throw updateError; const { error: historyError } = await supabase.from("opportunity_assignment_history").insert({ id: history.id, opportunity_id: id, previous_owner_id: target.ownerId, new_owner_id: newOwnerId, changed_by: currentUser.id, change_reason: history.changeReason, changed_at: history.changedAt }); if (historyError) throw historyError; })().catch(recoverFrom);
    },
    closeSale: (input) => {
      const opportunity = opportunities.find((item) => item.id === input.opportunityId); if (!opportunity || salesReports.some((item) => item.opportunityId === input.opportunityId)) return;
      const history = proposals.filter((item) => item.opportunityId === input.opportunityId).sort((a,b) => a.version-b.version);
      const figures = calculateSaleFigures(history[0]?.monthlyFee ?? opportunity.monthlyFee, input.finalFee, input.firstPaymentReceived);
      const now = new Date().toISOString();
      const report: SalesReport = { id: remote ? crypto.randomUUID() : `sr${Date.now()}`, opportunityId: opportunity.id, accountId: opportunity.accountId, sellerId: opportunity.ownerId, closedBy: currentUser.id, closedAt: new Date(input.closedAt).toISOString(), ...figures, firstPaymentReceivedAt: input.firstPaymentReceived ? now : undefined, contractReference: input.contractReference.trim(), notes: input.notes?.trim() || undefined, createdAt: now };
      setSalesReports((items) => [report, ...items]);
      setOpportunities((items) => items.map((item) => item.id === opportunity.id ? { ...item, stage: "cliente_activo", monthlyFee: report.finalFee, probability: 100, nextAction: "Iniciar transición y onboarding", nextActionAt: now, updatedAt: now } : item));
      if (remote) void (async () => { const supabase = createClient()!; const { error: reportError } = await supabase.from("sales_reports").insert({ id: report.id, opportunity_id: report.opportunityId, account_id: report.accountId, seller_id: report.sellerId, closed_by: report.closedBy, closed_at: report.closedAt, initial_fee: report.initialFee, final_fee: report.finalFee, annual_value: report.annualValue, commission_rate: report.commissionRate, commission_base: report.commissionBase, commission_amount: report.commissionAmount, commission_status: report.commissionStatus, first_payment_received_at: report.firstPaymentReceivedAt ?? null, contract_reference: report.contractReference, notes: report.notes ?? null }); if (reportError) throw reportError; const { error: opportunityError } = await supabase.from("opportunities").update({ stage: "cliente_activo", monthly_fee: report.finalFee, probability: 100, next_action: "Iniciar transición y onboarding", next_action_at: now, updated_at: now }).eq("id", opportunity.id); if (opportunityError) throw opportunityError; })().catch(recoverFrom);
    },
    confirmFirstPayment: (reportId) => {
      const at = new Date().toISOString(); setSalesReports((items) => items.map((item) => item.id === reportId ? { ...item, commissionStatus: "pagadera", firstPaymentReceivedAt: at } : item));
      if (remote) void createClient()!.from("sales_reports").update({ commission_status: "pagadera", first_payment_received_at: at }).eq("id", reportId).then(({ error }) => { if (error) recoverFrom(error); });
    },
    markCommissionPaid: (reportId) => {
      const at = new Date().toISOString(); setSalesReports((items) => items.map((item) => item.id === reportId ? { ...item, commissionStatus: "pagada", commissionPaidAt: at } : item));
      if (remote) void createClient()!.from("sales_reports").update({ commission_status: "pagada", commission_paid_at: at }).eq("id", reportId).then(({ error }) => { if (error) recoverFrom(error); });
    },
    markSpeechUsed: async (usage) => {
      const saved = remote ? { ...usage, id: crypto.randomUUID(), userId: currentUser.id } : usage;
      setSpeechUsages((items) => [saved, ...items]);
      setOpportunities((items) => items.map((item) => item.id === saved.opportunityId ? { ...item, nextAction: saved.nextAction, nextActionAt: saved.nextActionAt, updatedAt: new Date().toISOString() } : item));
      if (!remote) return true;
      const supabase = createClient()!;
      const [{ error: usageError }, { error: opportunityError }] = await Promise.all([
        supabase.from("opportunity_speech_usage").insert({ id: saved.id, speech_id: saved.speechId, opportunity_id: saved.opportunityId, stakeholder_id: saved.stakeholderId ?? null, stage: saved.stage, user_id: saved.userId, channel: saved.channel, outcome: saved.outcome, notes: saved.notes ?? null, next_action: saved.nextAction, next_action_at: saved.nextActionAt, used_at: saved.usedAt }),
        supabase.from("opportunities").update({ next_action: saved.nextAction, next_action_at: saved.nextActionAt, updated_at: new Date().toISOString() }).eq("id", saved.opportunityId)
      ]);
      if (usageError || opportunityError) { recoverFrom(usageError ?? opportunityError); return false; }
      return true;
    },
    resetDemo: () => {
      if (remote) { void loadRemote(); return; }
      setAccounts(demoAccounts); setOpportunities(demoOpportunities); setStakeholders(demoStakeholders); setTasks(demoTasks);
      setProposals(demoProposals); setProfiles(demoUsers); setReferences(demoReferences); setSalesReports(demoSalesReports); setAssignmentHistory([]); setSpeechUsages([]); localStorage.removeItem(storageKey);
    }
  }), [accounts, opportunities, stakeholders, tasks, proposals, references, salesReports, assignmentHistory, speechUsages, profiles, currentUser, loading, syncError, remote, loadRemote, recoverFrom]);

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm() { const value = useContext(CrmContext); if (!value) throw new Error("useCrm requiere CrmProvider"); return value; }
