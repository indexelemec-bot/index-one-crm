"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  accounts as demoAccounts, opportunities as demoOpportunities, proposals as demoProposals,
  references as demoReferences, stakeholders as demoStakeholders, tasks as demoTasks, users as demoUsers
} from "@/lib/mock-data";
import { mapAccount, mapOpportunity, mapProfile, mapProposal, mapReference, mapStakeholder, mapTask } from "@/lib/supabase/mappers";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Account, CommercialReference, Opportunity, Proposal, Stakeholder, Task, UserProfile } from "@/types/domain";

type NewProspect = { account: Account; stakeholder: Stakeholder; opportunity: Opportunity };
type Store = {
  accounts: Account[]; opportunities: Opportunity[]; stakeholders: Stakeholder[]; tasks: Task[]; proposals: Proposal[];
  references: CommercialReference[]; users: UserProfile[]; currentUser: UserProfile; loading: boolean; syncError: string;
  setCurrentUser: (user: UserProfile) => void; addProspect: (data: NewProspect) => void;
  updateOpportunity: (id: string, patch: Partial<Opportunity>) => void; addTask: (task: Task) => void;
  completeTask: (id: string, outcome: string, nextTask?: Task) => void; addProposal: (proposal: Proposal) => void;
  toggleUser: (id: string) => void; resetDemo: () => void; addUser: (user: UserProfile) => void;
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
      const [profileResult, accountResult, stakeholderResult, opportunityResult, taskResult, proposalResult, referenceResult] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("accounts").select("*").order("created_at", { ascending: false }),
        supabase.from("stakeholders").select("*").order("created_at", { ascending: false }),
        supabase.from("opportunities").select("*").order("updated_at", { ascending: false }),
        supabase.from("tasks").select("*").order("due_at"),
        supabase.from("proposals").select("*").order("generated_at", { ascending: false }),
        supabase.from("references_catalog").select("*").eq("approved", true).order("client_name")
      ]);
      const failure = [profileResult, accountResult, stakeholderResult, opportunityResult, taskResult, proposalResult, referenceResult].find((result) => result.error)?.error;
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
        setProposals(data.proposals ?? demoProposals); setProfiles(data.users ?? demoUsers);
      }
    } catch { localStorage.removeItem(storageKey); }
    setHydrated(true);
  }, [loadRemote, remote]);

  useEffect(() => {
    if (!remote && hydrated) localStorage.setItem(storageKey, JSON.stringify({ accounts, opportunities, stakeholders, tasks, proposals, users: profiles }));
  }, [accounts, opportunities, stakeholders, tasks, proposals, profiles, hydrated, remote]);

  const recoverFrom = useCallback((error: unknown) => {
    setSyncError(error instanceof Error ? error.message : "No fue posible guardar el cambio");
    void loadRemote();
  }, [loadRemote]);

  const value = useMemo<Store>(() => ({
    accounts, opportunities, stakeholders, tasks, proposals, references, users: profiles, currentUser, loading, syncError, setCurrentUser,
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
      if (remote) void createClient()!.from("proposals").insert({ id: savedProposal.id, opportunity_id: savedProposal.opportunityId, version: savedProposal.version, client_name: savedProposal.clientName, issue_date: savedProposal.issueDate, monthly_fee: savedProposal.monthlyFee, reference_ids: savedProposal.referenceIds, status: savedProposal.status, generated_by: currentUser.id }).then(({ error }) => { if (error) recoverFrom(error); });
    },
    addUser: (user) => {
      if (!remote) setProfiles((items) => [user, ...items]);
      else setSyncError("La invitación debe completarse desde Supabase Auth antes de asignar el rol.");
    },
    toggleUser: (id) => {
      const target = profiles.find((profile) => profile.id === id); if (!target) return;
      setProfiles((items) => items.map((profile) => profile.id === id ? { ...profile, active: !profile.active } : profile));
      if (remote) void createClient()!.from("profiles").update({ active: !target.active, updated_at: new Date().toISOString() }).eq("id", id).then(({ error }) => { if (error) recoverFrom(error); });
    },
    resetDemo: () => {
      if (remote) { void loadRemote(); return; }
      setAccounts(demoAccounts); setOpportunities(demoOpportunities); setStakeholders(demoStakeholders); setTasks(demoTasks);
      setProposals(demoProposals); setProfiles(demoUsers); setReferences(demoReferences); localStorage.removeItem(storageKey);
    }
  }), [accounts, opportunities, stakeholders, tasks, proposals, references, profiles, currentUser, loading, syncError, remote, loadRemote, recoverFrom]);

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm() { const value = useContext(CrmContext); if (!value) throw new Error("useCrm requiere CrmProvider"); return value; }
