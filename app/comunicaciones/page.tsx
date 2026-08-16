"use client";

import { CalendarClock, CheckCheck, CircleUserRound, FileText, Mail, MessageCircle, Paperclip, Plus, Search, Send, UserRoundCog, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, PageHeader } from "@/components/ui";
import { useCrm } from "@/components/crm-provider";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { mapCommunication, mapCommunicationThread, mapScheduledCommunication } from "@/lib/supabase/mappers";
import type { Communication, CommunicationThread, ScheduledCommunication } from "@/types/domain";
import { EmailPanel } from "./email-panel";
import styles from "./communications.module.css";

const stageLabel: Record<string, string> = {
  prospecto_identificado: "Prospecto identificado", problema_detectado: "Problema detectado", contacto_decisor: "Contacto con decisores",
  diagnostico: "Diagnóstico", solucion_recomendada: "Solución recomendada", presentacion: "Reunión / presentación",
  propuesta: "Propuesta económica", negociacion: "Evaluación / negociación", aprobacion: "Aprobación solución",
  contrato_transicion: "Contrato / transición", cliente_activo: "Cliente activo", perdida: "Prospecto descartado"
};

type UploadedAttachment = { path: string; name: string; mime: string; size: number };

export default function CommunicationsPage() {
  const { accounts, opportunities, stakeholders, users, proposals } = useCrm();
  const [tab, setTab] = useState<"whatsapp" | "email" | "scheduled">("whatsapp");
  const [messages, setMessages] = useState<Communication[]>([]);
  const [threads, setThreads] = useState<CommunicationThread[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledCommunication[]>([]);
  const [query, setQuery] = useState("");
  const [activeThreadId, setActiveThreadId] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<UploadedAttachment | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [newOpportunityId, setNewOpportunityId] = useState("");
  const [newStakeholderId, setNewStakeholderId] = useState("");
  const [newAgentId, setNewAgentId] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleBody, setScheduleBody] = useState("");
  const [scheduleRecurrence, setScheduleRecurrence] = useState("");

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

  useEffect(() => { if (!activeThreadId && visibleThreads[0]) setActiveThreadId(visibleThreads[0].id); }, [activeThreadId, visibleThreads]);
  useEffect(() => { setSelectedAttachment(null); }, [activeThreadId]);

  const activeThread = visibleThreads.find((item) => item.id === activeThreadId) ?? derivedThreads.find((item) => item.id === activeThreadId);
  const activeStakeholder = stakeholders.find((item) => item.id === activeThread?.stakeholderId);
  const activeOpportunity = opportunities.find((item) => item.id === activeThread?.opportunityId);
  const activeAccount = accounts.find((item) => item.id === activeOpportunity?.accountId);
  const assignedAgent = users.find((item) => item.id === activeThread?.assignedTo) ?? users.find((item) => item.id === activeOpportunity?.ownerId);
  const activeMessages = messages.filter((item) => item.channel === "whatsapp" && item.opportunityId === activeThread?.opportunityId && item.stakeholderId === activeThread?.stakeholderId);
  const newOpportunity = opportunities.find((item) => item.id === newOpportunityId);
  const newAccount = accounts.find((item) => item.id === newOpportunity?.accountId);
  const availableContacts = stakeholders.filter((item) => item.accountId === newAccount?.id && Boolean(item.phone));
  const activeUsers = users.filter((item) => item.active && !item.deletedAt);

  function openNewConversation() {
    const opportunity = opportunities.find((item) => item.stage !== "cliente_activo" && item.stage !== "perdida") ?? opportunities[0];
    setNewOpportunityId(opportunity?.id ?? "");
    const account = accounts.find((item) => item.id === opportunity?.accountId);
    setNewStakeholderId(stakeholders.find((item) => item.accountId === account?.id && item.phone)?.id ?? "");
    setNewAgentId(opportunity?.ownerId ?? "");
    setError("");
    setNewOpen(true);
  }

  function changeNewOpportunity(id: string) {
    setNewOpportunityId(id);
    const opportunity = opportunities.find((item) => item.id === id);
    const account = accounts.find((item) => item.id === opportunity?.accountId);
    setNewStakeholderId(stakeholders.find((item) => item.accountId === account?.id && item.phone)?.id ?? "");
    setNewAgentId(opportunity?.ownerId ?? "");
  }

  async function createConversation(event: React.FormEvent) {
    event.preventDefault(); setError("");
    const response = await fetch("/api/communications/threads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId: newOpportunityId, stakeholderId: newStakeholderId, channel: "whatsapp", assignedTo: newAgentId || undefined }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "No fue posible crear la conversación."); return; }
    const thread = mapCommunicationThread(result.thread);
    setThreads((items) => [thread, ...items.filter((item) => item.id !== thread.id)]);
    setActiveThreadId(thread.id); setNewOpen(false); setTab("whatsapp");
  }

  async function uploadAttachment(file: File) {
    if (!activeThread || activeThread.id.includes(":")) { setError("Selecciona una conversación guardada antes de adjuntar un archivo."); return; }
    if (file.size > 15 * 1024 * 1024) { setError("El archivo debe pesar menos de 15 MB."); return; }
    setUploading(true); setError("");
    const form = new FormData();
    form.append("threadId", activeThread.id);
    form.append("file", file);
    const response = await fetch("/api/communications/attachments", { method: "POST", body: form });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error ?? "No fue posible adjuntar el archivo."); setUploading(false); return; }
    setSelectedAttachment(result.attachment as UploadedAttachment);
    setUploading(false);
  }

  async function sendMessage() {
    if ((!draft.trim() && !selectedAttachment) || !activeThread || activeThread.id.includes(":")) return;
    setSending(true); setError("");
    const body = draft.trim() || `Archivo adjunto: ${selectedAttachment?.name ?? "documento"}`;
    const response = await fetch("/api/communications/whatsapp/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: activeThread.id, body, simulate: true, attachmentPath: selectedAttachment?.path, attachmentName: selectedAttachment?.name, attachmentMime: selectedAttachment?.mime })
    });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "No fue posible registrar el mensaje."); setSending(false); return; }
    setMessages((items) => [...items, mapCommunication(result.communication)]);
    setDraft(""); setSelectedAttachment(null); setSending(false);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    await load();
  }

  async function reassignConversation(agentId: string) {
    if (!activeThread || activeThread.id.includes(":")) return;
    setError("");
    const response = await fetch("/api/communications/threads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: activeThread.id, assignedTo: agentId || null, reason: "Reasignación desde bandeja de WhatsApp" }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "No fue posible reasignar la conversación."); return; }
    const thread = mapCommunicationThread(result.thread);
    setThreads((items) => items.map((item) => item.id === thread.id ? thread : item));
  }

  function openSchedule() {
    if (!activeThread) return;
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    setScheduleAt(date.toISOString().slice(0, 16));
    setScheduleBody(draft.trim());
    setScheduleRecurrence("");
    setError("");
    setScheduleOpen(true);
  }

  async function createSchedule(event: React.FormEvent) {
    event.preventDefault();
    if (!activeThread) return;
    const response = await fetch("/api/communications/scheduled", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: activeThread.id.includes(":") ? undefined : activeThread.id, opportunityId: activeThread.opportunityId, stakeholderId: activeThread.stakeholderId, channel: "whatsapp", body: scheduleBody, scheduledFor: new Date(scheduleAt).toISOString(), recurrenceMonths: scheduleRecurrence ? Number(scheduleRecurrence) : undefined }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "No fue posible programar el seguimiento."); return; }
    setScheduled((items) => [...items, mapScheduledCommunication(result.scheduled)].sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()));
    setScheduleOpen(false); setTab("scheduled");
  }

  async function cancelSchedule(id: string) {
    const response = await fetch("/api/communications/scheduled", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "No fue posible cancelar el seguimiento."); return; }
    const item = mapScheduledCommunication(result.scheduled);
    setScheduled((items) => items.map((entry) => entry.id === id ? item : entry));
  }

  return <>
    <PageHeader eyebrow="Centro de comunicaciones" title="Conversaciones comerciales" description="Correo, WhatsApp y seguimientos programados en un solo expediente comercial." />
    {error && !newOpen && !scheduleOpen && <div className="sync-banner sync-error">{error}</div>}
    <div className={styles.tabs}>
      <button className={tab === "whatsapp" ? styles.activeTab : ""} onClick={() => setTab("whatsapp")}><MessageCircle size={17}/> WhatsApp</button>
      <button className={tab === "email" ? styles.activeTab : ""} onClick={() => setTab("email")}><Mail size={17}/> Correo</button>
      <button className={tab === "scheduled" ? styles.activeTab : ""} onClick={() => setTab("scheduled")}><CalendarClock size={17}/> Programados <span>{scheduled.filter((item) => item.status === "scheduled").length}</span></button>
    </div>

    {tab === "whatsapp" && <div className={styles.workspace}>
      <aside className={styles.inbox}>
        <div className={styles.inboxHeader}><div><b>WhatsApp</b><small>Número corporativo INDEX CONDO</small></div><button title="Nueva conversación" onClick={openNewConversation}><Plus size={18}/></button></div>
        <label className={styles.search}><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversación…"/></label>
        <div className={styles.threadList}>
          {loading ? <div className={styles.empty}>Cargando conversaciones…</div> : visibleThreads.length === 0 ? <div className={styles.empty}><MessageCircle size={28}/><b>Sin conversaciones todavía</b><span>Crea la primera conversación con un contacto que tenga WhatsApp registrado.</span></div> : visibleThreads.map((thread) => {
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
        {!activeThread ? <div className={styles.chatPlaceholder}><MessageCircle size={48}/><h2>Centro WhatsApp</h2><p>Selecciona una conversación o crea una nueva para comenzar.</p><span>Modo de pruebas · No se enviarán mensajes reales todavía.</span></div> : <>
          <header className={styles.chatHeader}>
            <span className={styles.avatar}>{(activeStakeholder?.fullName ?? "C").split(" ").slice(0, 2).map((part) => part[0]).join("")}</span>
            <div><b>{activeStakeholder?.fullName}</b><small>{activeAccount?.name} · {activeStakeholder?.phone}</small></div>
            <label className={styles.agentSelect}><UserRoundCog size={15}/><span><small>Atiende</small><select value={assignedAgent?.id ?? ""} onChange={(event) => void reassignConversation(event.target.value)}>{activeUsers.map((user) => <option value={user.id} key={user.id}>{user.fullName}</option>)}</select></span></label>
          </header>
          <div className={styles.notice}>Modo simulación activo. Los mensajes se guardan en INDEX ONE, pero todavía no salen al WhatsApp real.</div>
          <div className={styles.messages}>
            {activeMessages.length === 0 && <div className={styles.firstMessage}><CircleUserRound size={22}/><div><b>Inicio de conversación</b><p>El primer mensaje del agente incluirá su presentación visible para que el cliente sepa quién le está atendiendo.</p></div></div>}
            {activeMessages.map((message) => <div key={message.id} className={`${styles.bubbleRow} ${message.direction === "outbound" ? styles.outbound : styles.inbound}`}><div className={styles.bubble}>{message.agentNameSnapshot && message.direction === "outbound" && <small className={styles.agentName}>{message.agentNameSnapshot}</small>}<p>{message.bodyText}</p>{message.mediaName && <a href={`/api/communications/attachments/download?communicationId=${message.id}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, fontWeight: 700 }}><Paperclip size={14}/>{message.mediaName}</a>}<span>{new Date(message.sentAt ?? message.createdAt).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}{message.direction === "outbound" && <CheckCheck size={14}/>}</span></div></div>)}
          </div>
          {selectedAttachment && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderTop: "1px solid #e8e8e8", background: "#fff" }}><Paperclip size={17}/><div style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedAttachment.name}</b><small>{Math.max(1, Math.round(selectedAttachment.size / 1024))} KB · listo para enviar</small></div><button type="button" onClick={() => { setSelectedAttachment(null); if (attachmentInputRef.current) attachmentInputRef.current.value = ""; }} title="Quitar archivo"><XCircle size={18}/></button></div>}
          <footer className={styles.composer}>
            <input ref={attachmentInputRef} type="file" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAttachment(file); }} />
            <button title="Adjuntar documento" onClick={() => attachmentInputRef.current?.click()} disabled={uploading || activeThread.id.includes(":")}><Paperclip size={20}/></button>
            <button title="Programar seguimiento" onClick={openSchedule}><CalendarClock size={20}/></button>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={uploading ? "Subiendo archivo…" : selectedAttachment ? "Agrega un mensaje al archivo (opcional)…" : "Escribe un mensaje…"} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }}/>
            <button className={styles.sendButton} onClick={() => void sendMessage()} disabled={(!draft.trim() && !selectedAttachment) || sending || uploading || activeThread.id.includes(":")}><Send size={19}/></button>
          </footer>
        </>}
      </section>

      <aside className={styles.context}>
        {activeThread ? <>
          <div className={styles.contextTitle}><span className={styles.largeAvatar}>{(activeStakeholder?.fullName ?? "C").split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><h3>{activeStakeholder?.fullName}</h3><p>{activeStakeholder?.role.replaceAll("_", " ")}</p></div>
          <div className={styles.contextBlock}><small>CUENTA</small><b>{activeAccount?.name}</b><span>{activeAccount?.units ? `${activeAccount.units} unidades` : "Sin unidades registradas"}</span></div>
          <div className={styles.contextBlock}><small>ETAPA COMERCIAL</small><b>{stageLabel[activeOpportunity?.stage ?? ""] ?? activeOpportunity?.stage}</b><span>{activeOpportunity?.probability ?? 0}% avance de cierre</span></div>
          <div className={styles.contextBlock}><small>PRÓXIMA ACCIÓN</small><b>{activeOpportunity?.nextAction || "Sin acción definida"}</b><span>{activeOpportunity?.nextActionAt ? new Date(activeOpportunity.nextActionAt).toLocaleString("es-DO") : "Sin fecha"}</span></div>
          <div className={styles.contextBlock}><small>HONORARIOS PROSPECTADOS</small><b>{new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(activeOpportunity?.monthlyFee ?? 0)}</b><span>Mensuales</span></div>
          <button className={styles.contextAction} onClick={() => { if (activeAccount?.id) window.location.href = `/prospectos/${activeAccount.id}`; }} disabled={!activeAccount?.id}><FileText size={17}/> Abrir expediente comercial</button>
        </> : <div className={styles.contextEmpty}>Selecciona una conversación para ver los datos comerciales.</div>}
      </aside>
    </div>}

    {tab === "email" && <EmailPanel accounts={accounts} opportunities={opportunities} stakeholders={stakeholders} proposals={proposals} messages={messages} onMessageSent={(message) => setMessages((items) => [...items, message])} onReload={load} />}

    {tab === "scheduled" && <div className={styles.scheduleGrid}>
      {scheduled.length === 0 ? <div className={styles.secondaryPanel}><CalendarClock size={38}/><h2>No hay mensajes programados</h2><p>Desde una conversación podrás programar seguimientos únicos o recurrentes.</p></div> : scheduled.map((item) => {
        const contact = stakeholders.find((entry) => entry.id === item.stakeholderId);
        const opportunity = opportunities.find((entry) => entry.id === item.opportunityId);
        const account = accounts.find((entry) => entry.id === opportunity?.accountId);
        return <article className={styles.scheduleCard} key={item.id}><span><CalendarClock size={19}/></span><div><b>{contact?.fullName ?? "Contacto"} · {account?.name ?? "Cuenta"}</b><p>{item.bodyText}</p><small>{new Date(item.scheduledFor).toLocaleString("es-DO")} · {item.recurrenceMonths ? `Cada ${item.recurrenceMonths} meses` : "Una vez"}</small></div><div className={styles.scheduleActions}><em>{item.status}</em>{item.status === "scheduled" && <button onClick={() => void cancelSchedule(item.id)} title="Cancelar"><XCircle size={17}/></button>}</div></article>;
      })}
    </div>}

    {newOpen && <Modal title="Nueva conversación de WhatsApp" description="Selecciona la oportunidad, el contacto y el agente responsable." onClose={() => setNewOpen(false)}><form onSubmit={createConversation}>{error && <div className="sync-banner sync-error">{error}</div>}<div className="form-grid"><label className="field field-wide"><span>Prospecto / oportunidad</span><select value={newOpportunityId} onChange={(event) => changeNewOpportunity(event.target.value)} required>{opportunities.filter((item) => item.stage !== "cliente_activo").map((opportunity) => <option value={opportunity.id} key={opportunity.id}>{accounts.find((item) => item.id === opportunity.accountId)?.name ?? "Cuenta"} · {stageLabel[opportunity.stage]}</option>)}</select></label><label className="field field-wide"><span>Contacto con WhatsApp</span><select value={newStakeholderId} onChange={(event) => setNewStakeholderId(event.target.value)} required>{availableContacts.map((contact) => <option value={contact.id} key={contact.id}>{contact.fullName} · {contact.phone}</option>)}</select></label><label className="field field-wide"><span>Agente responsable</span><select value={newAgentId} onChange={(event) => setNewAgentId(event.target.value)} required>{activeUsers.map((user) => <option value={user.id} key={user.id}>{user.fullName}</option>)}</select></label></div><div className="form-actions"><button type="button" className="button" onClick={() => setNewOpen(false)}>Cancelar</button><button className="button button-primary" disabled={!newStakeholderId || !newAgentId}><MessageCircle size={16}/> Crear conversación</button></div></form></Modal>}

    {scheduleOpen && activeThread && <Modal title="Programar seguimiento" description={`WhatsApp para ${activeStakeholder?.fullName ?? "el contacto"}.`} onClose={() => setScheduleOpen(false)}><form onSubmit={createSchedule}>{error && <div className="sync-banner sync-error">{error}</div>}<div className="form-grid"><label className="field field-wide"><span>Mensaje</span><textarea value={scheduleBody} onChange={(event) => setScheduleBody(event.target.value)} required/></label><label className="field"><span>Fecha y hora</span><input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} required/></label><label className="field"><span>Recurrencia</span><select value={scheduleRecurrence} onChange={(event) => setScheduleRecurrence(event.target.value)}><option value="">Una sola vez</option><option value="1">Cada mes</option><option value="3">Cada 3 meses</option><option value="6">Cada 6 meses</option><option value="12">Cada 12 meses</option></select></label></div><div className="form-actions"><button type="button" className="button" onClick={() => setScheduleOpen(false)}>Cancelar</button><button className="button button-primary"><CalendarClock size={16}/> Programar</button></div></form></Modal>}
  </>;
}