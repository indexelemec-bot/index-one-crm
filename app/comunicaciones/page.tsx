"use client";

import { CalendarClock, CheckCheck, CircleUserRound, FileText, Mail, MessageCircle, Paperclip, Plus, Search, Send, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui";
import { useCrm } from "@/components/crm-provider";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { mapCommunication, mapCommunicationThread, mapScheduledCommunication } from "@/lib/supabase/mappers";
import type { Communication, CommunicationThread, ScheduledCommunication } from "@/types/domain";
import styles from "./communications.module.css";

const stageLabel: Record<string, string> = {
  prospecto_identificado: "Prospecto identificado", problema_detectado: "Problema detectado", contacto_decisor: "Contacto con decisores",
  diagnostico: "Diagnóstico", solucion_recomendada: "Solución recomendada", presentacion: "Reunión / presentación",
  propuesta: "Propuesta económica", negociacion: "Evaluación / negociación", aprobacion: "Aprobación solución",
  contrato_transicion: "Contrato / transición", cliente_activo: "Cliente activo", perdida: "Prospecto descartado"
};

export default function CommunicationsPage() {
  const { accounts, opportunities, stakeholders, users } = useCrm();
  const [tab, setTab] = useState<"whatsapp" | "email" | "scheduled">("whatsapp");
  const [messages, setMessages] = useState<Communication[]>([]);
  const [threads, setThreads] = useState<CommunicationThread[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledCommunication[]>([]);
  const [query, setQuery] = useState("");
  const [activeThreadId, setActiveThreadId] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }
    const [messageResult, threadResult, scheduleResult] = await Promise.all([
      supabase.from("communications").select("*").order("created_at", { ascending: true }),
      supabase.from("communication_threads").select("*").order("last_message_at", { ascending: false, nullsFirst: false }),
      supabase.from("scheduled_communications").select("*").order("scheduled_for", { ascending: true })
    ]);
    if (messageResult.error) setError(messageResult.error.message);
    else setMessages((messageResult.data ?? []).map((row) => mapCommunication(row)));
    if (!threadResult.error) setThreads((threadResult.data ?? []).map((row) => mapCommunicationThread(row)));
    if (!scheduleResult.error) setScheduled((scheduleResult.data ?? []).map((row) => mapScheduledCommunication(row)));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const derivedThreads = useMemo(() => {
    if (threads.length) return threads;
    const seen = new Map<string, CommunicationThread>();
    messages.filter((item) => item.channel === "whatsapp" && item.stakeholderId).forEach((item) => {
      const key = `${item.opportunityId}:${item.stakeholderId}`;
      const prior = seen.get(key);
      if (!prior || new Date(item.createdAt) > new Date(prior.lastMessageAt ?? prior.createdAt)) {
        seen.set(key, {
          id: key, opportunityId: item.opportunityId, stakeholderId: item.stakeholderId!, channel: "whatsapp", status: "open",
          unreadCount: 0, lastMessageAt: item.createdAt, lastInboundAt: item.direction === "inbound" ? item.createdAt : prior?.lastInboundAt,
          lastOutboundAt: item.direction === "outbound" ? item.createdAt : prior?.lastOutboundAt, createdAt: prior?.createdAt ?? item.createdAt, updatedAt: item.createdAt
        });
      }
    });
    return [...seen.values()].sort((a, b) => new Date(b.lastMessageAt ?? b.updatedAt).getTime() - new Date(a.lastMessageAt ?? a.updatedAt).getTime());
  }, [threads, messages]);

  const visibleThreads = useMemo(() => derivedThreads.filter((thread) => {
    const stakeholder = stakeholders.find((item) => item.id === thread.stakeholderId);
    const opportunity = opportunities.find((item) => item.id === thread.opportunityId);
    const account = accounts.find((item) => item.id === opportunity?.accountId);
    return `${stakeholder?.fullName ?? ""} ${account?.name ?? ""} ${stakeholder?.phone ?? ""}`.toLowerCase().includes(query.toLowerCase());
  }), [derivedThreads, stakeholders, opportunities, accounts, query]);

  useEffect(() => {
    if (!activeThreadId && visibleThreads[0]) setActiveThreadId(visibleThreads[0].id);
  }, [activeThreadId, visibleThreads]);

  const activeThread = visibleThreads.find((item) => item.id === activeThreadId) ?? derivedThreads.find((item) => item.id === activeThreadId);
  const activeStakeholder = stakeholders.find((item) => item.id === activeThread?.stakeholderId);
  const activeOpportunity = opportunities.find((item) => item.id === activeThread?.opportunityId);
  const activeAccount = accounts.find((item) => item.id === activeOpportunity?.accountId);
  const assignedAgent = users.find((item) => item.id === activeThread?.assignedTo) ?? users.find((item) => item.id === activeOpportunity?.ownerId);
  const activeMessages = messages.filter((item) => item.channel === "whatsapp" && item.opportunityId === activeThread?.opportunityId && item.stakeholderId === activeThread?.stakeholderId);

  async function sendSimulation() {
    if (!draft.trim() || !activeThread) return;
    const localMessage: Communication = {
      id: `simulation-${Date.now()}`, opportunityId: activeThread.opportunityId, stakeholderId: activeThread.stakeholderId,
      threadId: activeThread.id, channel: "whatsapp", direction: "outbound", fromAddress: "INDEX CONDO",
      toAddress: activeStakeholder?.phone ?? "", bodyText: `${draft.trim()}${assignedAgent ? `\n\n— ${assignedAgent.fullName.split(" ")[0]} | INDEX CONDO` : ""}`,
      status: "simulated", agentId: assignedAgent?.id, agentNameSnapshot: assignedAgent?.fullName, messageType: "text", createdAt: new Date().toISOString()
    };
    setMessages((items) => [...items, localMessage]);
    setDraft("");
  }

  return <>
    <PageHeader eyebrow="Centro de comunicaciones" title="Conversaciones comerciales" description="Correo, WhatsApp y seguimientos programados en un solo expediente comercial." />
    {error && <div className="sync-banner sync-error">{error}</div>}
    <div className={styles.tabs}>
      <button className={tab === "whatsapp" ? styles.activeTab : ""} onClick={() => setTab("whatsapp")}><MessageCircle size={17}/> WhatsApp</button>
      <button className={tab === "email" ? styles.activeTab : ""} onClick={() => setTab("email")}><Mail size={17}/> Correo</button>
      <button className={tab === "scheduled" ? styles.activeTab : ""} onClick={() => setTab("scheduled")}><CalendarClock size={17}/> Programados <span>{scheduled.filter((item) => item.status === "scheduled").length}</span></button>
    </div>

    {tab === "whatsapp" && <div className={styles.workspace}>
      <aside className={styles.inbox}>
        <div className={styles.inboxHeader}><div><b>WhatsApp</b><small>Número corporativo INDEX CONDO</small></div><button title="Nueva conversación"><Plus size={18}/></button></div>
        <label className={styles.search}><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversación…"/></label>
        <div className={styles.threadList}>
          {loading ? <div className={styles.empty}>Cargando conversaciones…</div> : visibleThreads.length === 0 ? <div className={styles.empty}><MessageCircle size={28}/><b>Sin conversaciones todavía</b><span>Al registrar mensajes de prueba o recibir un webhook aparecerán aquí.</span></div> : visibleThreads.map((thread) => {
            const stakeholder = stakeholders.find((item) => item.id === thread.stakeholderId);
            const opportunity = opportunities.find((item) => item.id === thread.opportunityId);
            const account = accounts.find((item) => item.id === opportunity?.accountId);
            const last = messages.filter((item) => item.opportunityId === thread.opportunityId && item.stakeholderId === thread.stakeholderId && item.channel === "whatsapp").at(-1);
            return <button key={thread.id} className={`${styles.thread} ${activeThreadId === thread.id ? styles.activeThread : ""}`} onClick={() => setActiveThreadId(thread.id)}>
              <span className={styles.avatar}>{(stakeholder?.fullName ?? "C").split(" ").slice(0, 2).map((part) => part[0]).join("")}</span>
              <span className={styles.threadText}><span><b>{stakeholder?.fullName ?? "Contacto"}</b><time>{thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" }) : ""}</time></span><small>{account?.name ?? "Cuenta"}</small><p>{last?.bodyText || stakeholder?.phone || "Conversación preparada"}</p></span>
              {thread.unreadCount > 0 && <em>{thread.unreadCount}</em>}
            </button>;
          })}
        </div>
      </aside>

      <section className={styles.chat}>
        {!activeThread ? <div className={styles.chatPlaceholder}><MessageCircle size={48}/><h2>Centro WhatsApp</h2><p>Selecciona una conversación para abrir el expediente y responder desde INDEX ONE.</p><span>Modo de pruebas · No se enviarán mensajes reales todavía.</span></div> : <>
          <header className={styles.chatHeader}>
            <span className={styles.avatar}>{(activeStakeholder?.fullName ?? "C").split(" ").slice(0, 2).map((part) => part[0]).join("")}</span>
            <div><b>{activeStakeholder?.fullName}</b><small>{activeAccount?.name} · {activeStakeholder?.phone}</small></div>
            <div className={styles.agentBadge}><Users size={15}/><span><small>Atiende</small><b>{assignedAgent?.fullName ?? "Sin asignar"}</b></span></div>
          </header>
          <div className={styles.notice}>Modo simulación activo. La integración con el número corporativo se habilitará después de validar webhook, permisos y plantillas.</div>
          <div className={styles.messages}>
            {activeMessages.length === 0 && <div className={styles.firstMessage}><CircleUserRound size={22}/><div><b>Inicio de conversación</b><p>El primer mensaje del agente incluirá su presentación visible para que el cliente sepa quién le está atendiendo.</p></div></div>}
            {activeMessages.map((message) => <div key={message.id} className={`${styles.bubbleRow} ${message.direction === "outbound" ? styles.outbound : styles.inbound}`}>
              <div className={styles.bubble}>{message.agentNameSnapshot && message.direction === "outbound" && <small className={styles.agentName}>{message.agentNameSnapshot}</small>}<p>{message.bodyText}</p><span>{new Date(message.sentAt ?? message.createdAt).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}{message.direction === "outbound" && <CheckCheck size={14}/>}</span></div>
            </div>)}
          </div>
          <footer className={styles.composer}><button title="Adjuntar documento"><Paperclip size={20}/></button><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escribe un mensaje…" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendSimulation(); } }}/><button className={styles.sendButton} onClick={() => void sendSimulation()} disabled={!draft.trim()}><Send size={19}/></button></footer>
        </>}
      </section>

      <aside className={styles.context}>
        {activeThread ? <>
          <div className={styles.contextTitle}><span className={styles.largeAvatar}>{(activeStakeholder?.fullName ?? "C").split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><h3>{activeStakeholder?.fullName}</h3><p>{activeStakeholder?.role.replaceAll("_", " ")}</p></div>
          <div className={styles.contextBlock}><small>CUENTA</small><b>{activeAccount?.name}</b><span>{activeAccount?.units ? `${activeAccount.units} unidades` : "Sin unidades registradas"}</span></div>
          <div className={styles.contextBlock}><small>ETAPA COMERCIAL</small><b>{stageLabel[activeOpportunity?.stage ?? ""] ?? activeOpportunity?.stage}</b><span>{activeOpportunity?.probability ?? 0}% avance de cierre</span></div>
          <div className={styles.contextBlock}><small>PRÓXIMA ACCIÓN</small><b>{activeOpportunity?.nextAction || "Sin acción definida"}</b><span>{activeOpportunity?.nextActionAt ? new Date(activeOpportunity.nextActionAt).toLocaleString("es-DO") : "Sin fecha"}</span></div>
          <div className={styles.contextBlock}><small>HONORARIOS PROSPECTADOS</small><b>{new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(activeOpportunity?.monthlyFee ?? 0)}</b><span>Mensuales</span></div>
          <button className={styles.contextAction}><FileText size={17}/> Abrir expediente comercial</button>
        </> : <div className={styles.contextEmpty}>Selecciona una conversación para ver los datos comerciales.</div>}
      </aside>
    </div>}

    {tab === "email" && <div className={styles.secondaryPanel}><Mail size={38}/><h2>Correo formal</h2><p>El envío formal existente se mantiene disponible mientras terminamos de unificarlo con la nueva bandeja.</p></div>}

    {tab === "scheduled" && <div className={styles.scheduleGrid}>
      {scheduled.length === 0 ? <div className={styles.secondaryPanel}><CalendarClock size={38}/><h2>No hay mensajes programados</h2><p>Desde una conversación podrás programar seguimientos únicos o recurrentes.</p></div> : scheduled.map((item) => {
        const contact = stakeholders.find((entry) => entry.id === item.stakeholderId);
        const opportunity = opportunities.find((entry) => entry.id === item.opportunityId);
        const account = accounts.find((entry) => entry.id === opportunity?.accountId);
        return <article className={styles.scheduleCard} key={item.id}><span><CalendarClock size={19}/></span><div><b>{contact?.fullName ?? "Contacto"} · {account?.name ?? "Cuenta"}</b><p>{item.bodyText}</p><small>{new Date(item.scheduledFor).toLocaleString("es-DO")} · {item.recurrenceMonths ? `Cada ${item.recurrenceMonths} meses` : "Una vez"}</small></div><em>{item.status}</em></article>;
      })}
    </div>}
  </>;
}
