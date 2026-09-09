"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  references: CommercialReference[]; users: UserProfile[]; salesReports: SalesReport[]; assignmentHistory: AssignmentHistory[]; speechUsages: SpeechUsage[]; currentUser: UserProfile; loading: boolean; syncError: string; dataVersion: number;
  setCurrentUser: (user: UserProfile) => void; addProspect: (data: NewProspect) => void;
  updateAccount: (id: string, patch: Partial<Account>) => Promise<{ ok: boolean; error?: string }>;
  updateOpportunity: (id: string, patch: Partial<Opportunity>) => Promise<{ ok: boolean; error?: string }>; addTask: (task: Task) => Promise<boolean>;
  completeTask: (id: string, outcome: string, nextTask?: Task) => void; addProposal: (proposal: Proposal) => void;
  toggleUser: (id: string) => void; resetDemo: () => void; inviteUser: (input: InviteUserInput) => Promise<{ ok: boolean; error?: string }>;
  assignOpportunity: (id: string, newOwnerId: string, reason: string, note?: string) => Promise<{ ok: boolean; error?: string }>; closeSale: (input: CloseSaleInput) => void;
  confirmFirstPayment: (reportId: string) => void; markCommissionPaid: (reportId: string) => void;
  markSpeechUsed: (usage: SpeechUsage) => Promise<boolean>;
  updateUserProfile: (id: string, fullName: string) => Promise<{ ok: boolean; error?: string }>;
  refreshData: () => Promise<boolean>;
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
  const [dataVersion, setDataVersion] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const loadSequence = useRef(0);
  const hasLoadedRemote = useRef(false);

  const loadRemote = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return false;
    const sequence = ++loadSequence.current;
    if (!hasLoadedRemote.current) setLoading(true);
    setSyncError("");
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
        supabase.from("references_catalog").select("*").order("priority", { ascending: false }).order("incorporated_at", { ascending: false }),
        supabase.from("sales_reports").select("*").order("closed_at", { ascending: false }),
        supabase.from("opportunity_assignment_history").select("*").order("changed_at", { ascending: false }),
        supabase.from("opportunity_speech_usage").select("*").order("used_at", { ascending: false })
      ]);
      if (profileResult.error) throw profileResult.error;
      const mappedProfiles = (profileResult.data ?? []).map((row) => mapProfile(row));
      const authenticatedProfile = mappedProfiles.find((profile) => profile.id === authData.user.id);
      if (!authenticatedProfile) throw new Error("El usuario autenticado no tiene perfil CRM");
      if (sequence !== loadSequence.current) return false;
      setProfiles(mappedProfiles); setCurrentUser(authenticatedProfile);
      if (!accountResult.error) setAccounts((accountResult.data ?? []).map((row) => mapAccount(row)));
      if (!stakeholderResult.error) setStakeholders((stakeholderResult.data ?? []).map((row) => mapStakeholder(row)));
      if (!opportunityResult.error) setOpportunities((opportunityResult.data ?? []).map((row) => mapOpportunity(row)));
      if (!taskResult.error) setTasks((taskResult.data ?? []).map((row) => mapTask(row)));
      if (!proposalResult.error) setProposals((proposalResult.data ?? []).map((row) => mapProposal(row)));
      if (!referenceResult.error) setReferences((referenceResult.data ?? []).map((row) => mapReference(row)));
      if (!reportResult.error) setSalesReports((reportResult.data ?? []).map((row) => mapSalesReport(row)));
      if (!assignmentResult.error) setAssignmentHistory((assignmentResult.data ?? []).map((row) => mapAssignmentHistory(row)));
      if (!speechUsageResult.error) setSpeechUsages((speechUsageResult.data ?? []).map((row) => mapSpeechUsage(row)));
      const failures = [accountResult, stakeholderResult, opportunityResult, taskResult, proposalResult, referenceResult, reportResult, assignmentResult, speechUsageResult]
        .flatMap((result) => result.error ? [result.error.message] : []);
      if (failures.length) setSyncError(`Sincronización parcial: ${failures.join(" · ")}`);
      hasLoadedRemote.current = true;
      setDataVersion((version) => version + 1);
      return failures.length === 0;
    } catch (error) {
      if (sequence === loadSequence.current) setSyncError(error instanceof Error ? error.message : "No fue posible sincronizar con Supabase");
      return false;
    } finally { if (sequence === loadSequence.current) setLoading(false); }
  }, []);

  useEffect(() => {
    if (remote) { void loadRemote(); return; }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        setAccounts(data.accounts ?? demoAccounts); setOpportunities(data.opportunities ?? demoOpportunities);
        setStakeholders(data.stakeholders ?? demoStakeholders); setTasks(data.tasks ?? demoTasks);
        setProposals(data.proposals ?? demoProposals); setReferences(data.references ?? demoReferences); setProfiles(data.users ?? demoUsers); setSalesReports(data.salesReports ?? demoSalesReports); setSpeechUsages(data.speechUsages ?? []);
      }
    } catch { localStorage.removeItem(storageKey); }
    setHydrated(true);
  }, [loadRemote, remote]);

  useEffect(() => {
    if (!remote && hydrated) localStorage.setItem(storageKey, JSON.stringify({ accounts, opportunities, stakeholders, tasks, proposals, references, salesReports, assignmentHistory, speechUsages, users: profiles }));
  }, [accounts, opportunities, stakeholders, tasks, proposals, references, salesReports, assignmentHistory, speechUsages, profiles, hydrated, remote]);

  useEffect(() => {
    if (!remote) return;
    const supabase = createClient();
    if (!supabase) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void loadRemote(); }, 300);
    };
    const liveTables = [
      "accounts", "stakeholders", "opportunities", "activities", "tasks", "proposals",
      "opportunity_assignment_history", "sales_reports", "communications",
      "scheduled_communications", "contracts", "client_documents", "opportunity_speech_usage",
      "internal_conversations", "internal_messages"
    ];
    let channel = supabase.channel("crm-live-expediente");
    liveTables.forEach((table) => {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleReload);
    });
    channel.subscribe();
    return () => { if (timer) clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [loadRemote, remote]);

  const recoverFrom = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : "No fue posible guardar el cambio";
    setSyncError(message);
    void loadRemote();
  }, [loadRemote]);

  const refreshData = useCallback(async () => {
    if (remote) {
      const ok = await loadRemote();
      if (!ok) setDataVersion((version) => version + 1);
      return ok;
    }
    setDataVersion((version) => version + 1);
    return true;
  }, [loadRemote, remote]);

  const value = useMemo<Store>(() => ({
    accounts, opportunities, stakeholders, tasks, proposals, references, salesReports, assignmentHistory, speechUsages, users: profiles, currentUser, loading, syncError, dataVersion, setCurrentUser, refreshData,
    addProspect: (data) => {
      if (!remote) { setAccounts((items) => [data.account, ...items]); setStakeholders((items) => [data.stakeholder, ...items]); setOpportunities((items) => [data.opportunity, ...items]); return; }
      const accountId = crypto.randomUUID(); const stakeholderId = crypto.randomUUID(); const opportunityId = crypto.randomUUID();
      const account = { ...data.account, id: accountId, ownerId: currentUser.id };
      const stakeholder = { ...data.stakeholder, id: stakeholderId, accountId };
      const opportunity = { ...data.opportunity, id: opportunityId, accountId, ownerId: currentUser.id };
      setAccounts((items) => [account, ...items]); setStakeholders((items) => [stakeholder, ...items]); setOpportunities((items) => [opportunity, ...items]);
      void (async () => {
        const supabase = createClient()!;
        const { error: accountError } = await supabase.from("accounts").insert({ id: accountId, name: account.name, account_type: account.accountType, project_type: account.projectType, residential_subtype: account.residentialSubtype ?? null, custom_unit_type: account.customUnitType ?? null, address: account.address, sector: account.sector, city: account.city, units: account.units, towers: account.towers, profile: account.profile, source: account.source, created_by: currentUser.id, owner_id: currentUser.id });
        if (accountError) throw accountError;
        const [{ error: stakeholderError }, { error: opportunityError }] = await Promise.all([
          supabase.from("stakeholders").insert({ id: stakeholderId, account_id: accountId, full_name: stakeholder.fullName, role: stakeholder.role, phone: stakeholder.phone, email: stakeholder.email, influence: stakeholder.influence, position: stakeholder.position, is_decision_maker: stakeholder.isDecisionMaker }),
          supabase.from("opportunities").insert({ id: opportunityId, account_id: accountId, stage: opportunity.stage, primary_problem: opportunity.primaryProblem, impact: opportunity.impact, proposed_solution: opportunity.proposedSolution, monthly_fee: opportunity.monthlyFee, probability: opportunity.probability, next_action: opportunity.nextAction, next_action_at: opportunity.nextActionAt, owner_id: currentUser.id })
        ]);
        if (stakeholderError || opportunityError) throw stakeholderError ?? opportunityError;
      })().catch(recoverFrom);
    },
    updateAccount: async (id, patch) => {
      setAccounts((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
      if (!remote) { setDataVersion((version) => version + 1); return { ok: true }; }
      const { data: updated, error } = await createClient()!.from("accounts").update({
        ...(patch.projectType !== undefined && { project_type: patch.projectType }),
        ...("residentialSubtype" in patch && { residential_subtype: patch.residentialSubtype ?? null }),
        ...("customUnitType" in patch && { custom_unit_type: patch.customUnitType ?? null }),
        ...(patch.units !== undefined && { units: patch.units }),
        ...(patch.accountType !== undefined && { account_type: patch.accountType }),
        updated_at: new Date().toISOString()
      }).eq("id", id).select("id").maybeSingle();
      if (error || !updated) { const failure = error ?? new Error("La cuenta no está disponible para actualizarse."); recoverFrom(failure); return { ok: false, error: failure.message }; }
      await loadRemote(); return { ok: true };
    },
    updateOpportunity: async (id, patch) => {
      setOpportunities((items) => items.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
      if (!remote) { setDataVersion((version) => version + 1); return { ok: true }; }
      const { data: updated, error } = await createClient()!.from("opportunities").update(opportunityPatchToDb(patch)).eq("id", id).select("id").maybeSingle();
      if (error || !updated) { const failure = error ?? new Error("La oportunidad no está disponible para actualizarse."); recoverFrom(failure); return { ok: false, error: failure.message }; }
      await loadRemote();
      return { ok: true };
    },
    addTask: async (task) => {
      const savedTask = remote ? { ...task, id: crypto.randomUUID() } : task;
      setTasks((items) => [savedTask, ...items]);
      if (!remote) return true;
      const { error } = await createClient()!.from("tasks").insert({ id: savedTask.id, opportunity_id: savedTask.opportunityId, title: savedTask.title, due_at: savedTask.dueAt, priority: savedTask.priority, status: savedTask.status, owner_id: savedTask.ownerId });
      if (error) { recoverFrom(error); return false; }
      const response = await fetch("/api/tasks/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: savedTask.id }) });
      if (!response.ok) setSyncError("La tarea se guardó, pero no se pudo enviar el aviso por correo.");
      return true;
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
      if (remote) void createClient()!.from("proposals").insert({ id: savedProposal.id, opportunity_id: savedProposal.opportunityId, version: savedProposal.version, client_name: savedProposal.clientName, issue_date: savedProposal.issueDate, monthly_fee: savedProposal.monthlyFee, reference_ids: savedProposal.referenceIds, references_snapshot: savedProposal.referencesSnapshot ?? [], project_type: savedProposal.projectType ?? null, residential_subtype: savedProposal.residentialSubtype ?? null, custom_unit_type: savedProposal.customUnitType ?? null, status: savedProposal.status, file_format: savedProposal.fileFormat, change_reason: savedProposal.changeReason || null, generated_by: currentUser.id }).then(({ error }) => { if (error) recoverFrom(error); });
    },
    inviteUser: async (input) => {
      if (!remote) { setProfiles((items) => [{ id: `u${Date.now()}`, ...input, active: true }, ...items]); return { ok: true }; }
      const response = await fetch("/api/admin/users/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { const message = result.error ?? "No fue posible enviar la invitación."; setSyncError(message); return { ok: false, error: message }; }
      await loadRemote(); return { ok: true };
    },
    updateUserProfile: async (id, fullName) => {
      const normalized = fullName.trim().replace(/\s+/g, " ");
      if (normalized.length < 3) return { ok: false, error: "Escribe el nombre completo del usuario." };
      if (!remote) {
        setProfiles((items) => items.map((profile) => profile.id === id ? { ...profile, fullName: normalized } : profile));
        setCurrentUser((profile) => profile.id === id ? { ...profile, fullName: normalized } : profile);
        return { ok: true };
      }
      const { error } = await createClient()!.from("profiles").update({ full_name: normalized, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) { recoverFrom(error); return { ok: false, error: error.message }; }
      setProfiles((items) => items.map((profile) => profile.id === id ? { ...profile, fullName: normalized } : profile));
      setCurrentUser((profile) => profile.id === id ? { ...profile, fullName: normalized } : profile);
      return { ok: true };
    },
    toggleUser: (id) => {
      const target = profiles.find((profile) => profile.id === id); if (!target) return;
      setProfiles((items) => items.map((profile) => profile.id === id ? { ...profile, active: !profile.active } : profile));
      if (remote) void createClient()!.from("profiles").update({ active: !target.active, updated_at: new Date().toISOString() }).eq("id", id).then(({ error }) => { if (error) recoverFrom(error); });
    },
    assignOpportunity: async (id, newOwnerId, reason, note) => {
      const target = opportunities.find((item) => item.id === id);
      if (!target) return { ok: false, error: "Oportunidad no encontrada." };
      if (target.ownerId === newOwnerId) return { ok: false, error: "Selecciona un vendedor diferente al actual." };
      const normalizedReason = reason.trim(); const normalizedNote = note?.trim();
      if (normalizedReason.length < 3) return { ok: false, error: "Indica un motivo de al menos 3 caracteres." };
      if (!remote) {
        const history: AssignmentHistory = { id: `ah${Date.now()}`, opportunityId: id, previousOwnerId: target.ownerId, newOwnerId, changedBy: currentUser.id, changeReason: normalizedReason, note: normalizedNote || undefined, changedAt: new Date().toISOString() };
        setOpportunities((items) => items.map((item) => item.id === id ? { ...item, ownerId: newOwnerId, updatedAt: history.changedAt } : item));
        setAccounts((items) => items.map((item) => item.id === target.accountId ? { ...item, ownerId: newOwnerId } : item));
        setAssignmentHistory((items) => [history, ...items]); setDataVersion((version) => version + 1);
        return { ok: true };
      }
      try {
        const response = await fetch("/api/opportunities/assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId: id, newOwnerId, reason: normalizedReason, note: normalizedNote }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) { const message = result.error ?? "No fue posible reasignar la oportunidad."; setSyncError(message); return { ok: false, error: message }; }
        if (!result.assignment) { const message = "La asignación se confirmó sin datos de auditoría."; setSyncError(message); return { ok: false, error: message }; }
        const history = mapAssignmentHistory(result.assignment as Record<string, unknown>);
        setOpportunities((items) => items.map((item) => item.id === id ? { ...item, ownerId: newOwnerId, updatedAt: history.changedAt } : item));
        setAccounts((items) => items.map((item) => item.id === target.accountId ? { ...item, ownerId: newOwnerId } : item));
        setTasks((items) => items.map((item) => item.opportunityId === id && item.ownerId === target.ownerId && item.status === "pendiente" ? { ...item, ownerId: newOwnerId } : item));
        setAssignmentHistory((items) => [history, ...items.filter((item) => item.id !== history.id)]);
        setDataVersion((version) => version + 1);
        void loadRemote();
        return { ok: true };
      } catch {
        const message = "No fue posible conectar con el servicio de asignaciones.";
        setSyncError(message); return { ok: false, error: message };
      }
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
  }), [accounts, opportunities, stakeholders, tasks, proposals, references, salesReports, assignmentHistory, speechUsages, profiles, currentUser, loading, syncError, dataVersion, remote, loadRemote, recoverFrom, refreshData]);

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm() { const value = useContext(CrmContext); if (!value) throw new Error("useCrm requiere CrmProvider"); return value; }
