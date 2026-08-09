"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { accounts as initialAccounts, opportunities as initialOpportunities, proposals as initialProposals, references, stakeholders as initialStakeholders, tasks as initialTasks, users } from "@/lib/mock-data";
import type { Account, Opportunity, Proposal, Stakeholder, Task, UserProfile } from "@/types/domain";

type NewProspect = { account: Account; stakeholder: Stakeholder; opportunity: Opportunity };
type Store = {
  accounts: Account[]; opportunities: Opportunity[]; stakeholders: Stakeholder[]; tasks: Task[]; proposals: Proposal[]; references: typeof references; users: UserProfile[];
  currentUser: UserProfile; setCurrentUser: (user: UserProfile) => void;
  addProspect: (data: NewProspect) => void; updateOpportunity: (id: string, patch: Partial<Opportunity>) => void;
  addTask: (task: Task) => void; completeTask: (id: string, outcome: string, nextTask?: Task) => void;
  addProposal: (proposal: Proposal) => void; toggleUser: (id: string) => void; resetDemo: () => void;
  addUser: (user: UserProfile) => void;
};

const CrmContext = createContext<Store | null>(null);
const storageKey = "index-one-crm-v03";

export function CrmProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [stakeholders, setStakeholders] = useState(initialStakeholders);
  const [tasks, setTasks] = useState(initialTasks);
  const [proposals, setProposals] = useState(initialProposals);
  const [profiles, setProfiles] = useState(users);
  const [currentUser, setCurrentUser] = useState(users[0]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        setAccounts(data.accounts ?? initialAccounts); setOpportunities(data.opportunities ?? initialOpportunities);
        setStakeholders(data.stakeholders ?? initialStakeholders); setTasks(data.tasks ?? initialTasks);
        setProposals(data.proposals ?? initialProposals); setProfiles(data.users ?? users);
      }
    } catch { localStorage.removeItem(storageKey); }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(storageKey, JSON.stringify({ accounts, opportunities, stakeholders, tasks, proposals, users: profiles }));
  }, [accounts, opportunities, stakeholders, tasks, proposals, profiles, hydrated]);

  const value = useMemo<Store>(() => ({
    accounts, opportunities, stakeholders, tasks, proposals, references, users: profiles, currentUser, setCurrentUser,
    addProspect: ({ account, stakeholder, opportunity }) => { setAccounts((v) => [account, ...v]); setStakeholders((v) => [stakeholder, ...v]); setOpportunities((v) => [opportunity, ...v]); },
    updateOpportunity: (id, patch) => setOpportunities((v) => v.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item)),
    addTask: (task) => setTasks((v) => [task, ...v]),
    completeTask: (id, outcome, nextTask) => { setTasks((v) => v.map((task) => task.id === id ? { ...task, status: "completada", outcome } : task)); if (nextTask) setTasks((v) => [nextTask, ...v]); },
    addProposal: (proposal) => setProposals((v) => [proposal, ...v]),
    addUser: (user) => setProfiles((v) => [user, ...v]),
    toggleUser: (id) => setProfiles((v) => v.map((user) => user.id === id ? { ...user, active: !user.active } : user)),
    resetDemo: () => { setAccounts(initialAccounts); setOpportunities(initialOpportunities); setStakeholders(initialStakeholders); setTasks(initialTasks); setProposals(initialProposals); setProfiles(users); localStorage.removeItem(storageKey); }
  }), [accounts, opportunities, stakeholders, tasks, proposals, profiles, currentUser]);

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm() { const value = useContext(CrmContext); if (!value) throw new Error("useCrm requiere CrmProvider"); return value; }
