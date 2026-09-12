"use client";

import { AtSign, Bell, CheckCircle2, ClipboardPlus, FileText, MessageSquareReply, Paperclip, Plus, Send, ShieldCheck, UserMinus, UserPlus, UsersRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui";
import { useCrm } from "@/components/crm-provider";
import { createClient } from "@/lib/supabase/client";
import type { InternalConversation, InternalMessage } from "@/types/domain";
import styles from "./team.module.css";

type Filter = "all" | "mentions" | "assigned" | "groups" | "unread";
type Attachment = { path: string; name: string; mime: string; size: number };
type AssignmentRow = { id: string; previous_responsible_id?: string; new_responsible_id?: string; changed_by: string; reason: string; note?: string; changed_at: string };

const statusLabel = { open: "Abierta", pending: "Pendiente", waiting_client: "Esperando cliente", waiting_internal: "Esperando equipo", closed: "Cerrada" };
const priorityLabel = { normal: "Normal", important: "Importante", urgent: "Urgente" };

export function TeamPanel() {
  const { accounts, opportunities, users, currentUser, refreshData } = useCrm();
  const activeUsers = users.filter((user) => user.active && !user.deletedAt);
  const [conversations, setConversations] = useState<InternalConversation[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<AssignmentRow[]>([]);
  const [activeId, setActiveId] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<InternalMessage | null>(null);
  const [mentions, setMentions] = useState<string[]>([]);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [sending, setSending] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [taskMessage, setTaskMessage] = useState<InternalMessage | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/internal/conversations", { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error ?? "No fue posible cargar las conversaciones internas."); setLoading(false); return; }
    setConversations(result.conversations ?? []);
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (conversationId: string, cursor?: string | null) => {
    const older = Boolean(cursor);
    const response = await fetch(`/api/internal/messages?conversationId=${encodeURIComponent(conversationId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error ?? "No fue posible cargar los mensajes."); return; }
    setMessages((items) => older ? [...(result.messages ?? []), ...items] : (result.messages ?? []));
    setMessageCursor(result.nextCursor ?? null);
    setHistory(result.assignmentHistory ?? []);
    const readResponse = await fetch("/api/internal/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId }) });
    if (!readResponse.ok) {
      const readResult = await readResponse.json().catch(() => ({}));
      setError(readResult.error ?? "Los mensajes se cargaron, pero no pudieron marcarse como leídos.");
      return;
    }
    setConversations((items) => items.map((item) => item.id === conversationId ? { ...item, unreadCount: 0, mentioned: false } : item));
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);
  useEffect(() => { if (activeId) void loadMessages(activeId); else setMessages([]); }, [activeId, loadMessages]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    const channel = supabase.channel(`internal-team-${currentUser.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_conversations" }, () => void loadConversations())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "internal_messages" }, (payload) => {
        const row = payload.new as { conversation_id?: string };
        if (row.conversation_id === activeId) void loadMessages(activeId);
        void loadConversations();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "internal_notifications", filter: `recipient_id=eq.${currentUser.id}` }, () => void loadConversations())
      .subscribe();
    const fallback = window.setInterval(() => void loadConversations(), 20_000);
    return () => { window.clearInterval(fallback); void supabase.removeChannel(channel); };
  }, [activeId, currentUser.id, loadConversations, loadMessages]);

  const visible = useMemo(() => conversations.filter((conversation) => {
    const account = accounts.find((item) => opportunities.find((opportunity) => opportunity.id === conversation.opportunityId)?.accountId === item.id);
    const textMatch = `${conversation.title} ${account?.name ?? ""}`.toLowerCase().includes(query.toLowerCase());
    if (!textMatch) return false;
    if (filter === "mentions") return conversation.mentioned;
    if (filter === "assigned") return conversation.responsibleId === currentUser.id;
    if (filter === "groups") return conversation.conversationType === "group";
    if (filter === "unread") return conversation.unreadCount > 0;
    return true;
  }), [accounts, conversations, currentUser.id, filter, opportunities, query]);

  useEffect(() => { if (!activeId && visible[0]) setActiveId(visible[0].id); }, [activeId, visible]);
  const active = conversations.find((item) => item.id === activeId);
  const activeOpportunity = opportunities.find((item) => item.id === active?.opportunityId);
  const activeAccount = accounts.find((item) => item.id === activeOpportunity?.accountId);
  const activeMembers = active?.members.filter((member) => !member.removedAt) ?? [];
  const canCoordinate = Boolean(active && (active.createdBy === currentUser.id || active.responsibleId === currentUser.id || currentUser.role === "superadmin" || currentUser.role === "gerencia_comercial"));

  async function sendMessage() {
    if (!active || (!draft.trim() && !attachment)) return;
    setSending(true); setError("");
    const response = await fetch("/api/internal/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: active.id, bodyText: draft.trim(), replyToId: replyTo?.id, mentionedUserIds: mentions, attachment }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error ?? "No fue posible guardar la nota interna.");
    else { setMessages((items) => [...items, result.message]); setDraft(""); setReplyTo(null); setMentions([]); setAttachment(null); if (fileRef.current) fileRef.current.value = ""; await loadConversations(); }
    setSending(false);
  }

  async function upload(file: File) {
    if (!active) return;
    const form = new FormData(); form.append("conversationId", active.id); form.append("file", file);
    const response = await fetch("/api/internal/attachments", { method: "POST", body: form });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error ?? "No fue posible adjuntar el archivo."); else setAttachment(result.attachment);
  }

  async function updateConversation(patch: Record<string, unknown>) {
    if (!active) return false;
    setError("");
    const response = await fetch("/api/internal/conversations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: active.id, ...patch }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error ?? "No fue posible actualizar la conversación."); return false; }
    await loadConversations(); await loadMessages(active.id); return true;
  }

  async function reassign(responsibleId: string) {
    if (!active || responsibleId === active.responsibleId) return;
    const reason = window.prompt("Motivo obligatorio de la reasignación:")?.trim();
    if (!reason) { setError("La reasignación fue cancelada: el motivo es obligatorio."); return; }
    const note = window.prompt("Nota adicional (opcional):")?.trim();
    await updateConversation({ responsibleId, reason, note: note || undefined });
  }

  function insertMention(userId: string) {
    const user = users.find((item) => item.id === userId); if (!user) return;
    setDraft((value) => `${value}${value && !value.endsWith(" ") ? " " : ""}@${user.fullName} `);
    setMentions((items) => [...new Set([...items, userId])]);
  }

  const contextContent = active ? <><h3>Participantes</h3><label><span>Responsable principal</span><select value={active.responsibleId ?? ""} disabled={!canCoordinate} onChange={(event) => void reassign(event.target.value)}>{activeMembers.map((member) => <option key={member.userId} value={member.userId}>{users.find((user) => user.id === member.userId)?.fullName}</option>)}</select></label><div className={styles.members}>{activeMembers.map((member) => <div key={member.userId}><span><b>{users.find((user) => user.id === member.userId)?.fullName}</b><small>{member.role === "observer" ? "Observador" : member.userId === active.responsibleId ? "Responsable" : "Participante"}</small></span>{canCoordinate && member.userId !== active.responsibleId && member.userId !== currentUser.id && <button title="Quitar participante" onClick={() => void updateConversation({ removeMemberIds: [member.userId] })}><UserMinus size={15}/></button>}</div>)}</div>{canCoordinate && <AddMember users={activeUsers.filter((user) => !activeMembers.some((member) => member.userId === user.id))} onAdd={(userId, role) => updateConversation({ addMembers: [{ userId, role }] })}/>} {activeAccount && <button className={styles.fileLink} onClick={() => { window.location.href = `/prospectos/${activeAccount.id}`; }}><FileText size={16}/> Abrir expediente</button>}<h3>Historial de responsable</h3><div className={styles.history}>{history.length === 0 ? <small>Sin reasignaciones.</small> : history.map((item) => <div key={item.id}><CheckCircle2 size={14}/><span><b>{users.find((user) => user.id === item.new_responsible_id)?.fullName ?? "Sin responsable"}</b><small>{item.reason} · {new Date(item.changed_at).toLocaleString("es-DO")}</small></span></div>)}</div></> : null;

  return <>
    <div className={styles.safety}><ShieldCheck size={18}/><div><b>Canal exclusivamente interno</b><span>Estas notas nunca se envían por WhatsApp ni correo al cliente.</span></div></div>
    {error && <div className="sync-banner sync-error">{error}</div>}
    <div className={styles.filters}>{([['all','Todas'],['mentions','Menciones'],['assigned','Asignadas a mí'],['groups','Grupos'],['unread','No leídas']] as Array<[Filter,string]>).map(([key, label]) => <button key={key} className={filter === key ? styles.selected : ""} onClick={() => setFilter(key)}>{label}{key === "mentions" && conversations.filter((item) => item.mentioned).length > 0 ? <em>{conversations.filter((item) => item.mentioned).length}</em> : null}</button>)}</div>
    <div className={styles.workspace}>
      <aside className={styles.inbox}>
        <header><div><b>Equipo</b><small>Colaboración comercial</small></div><button title="Nueva conversación interna" onClick={() => setNewOpen(true)}><Plus size={18}/></button></header>
        <label className={styles.search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversación…"/></label>
        <div className={styles.list}>{loading ? <p>Cargando…</p> : visible.length === 0 ? <p>No hay conversaciones en este filtro.</p> : visible.map((conversation) => <button key={conversation.id} className={activeId === conversation.id ? styles.active : ""} onClick={() => setActiveId(conversation.id)}><span className={styles.icon}>{conversation.conversationType === "group" ? <UsersRound size={17}/> : <UserPlus size={17}/>}</span><span><b>{conversation.title}</b><small>{priorityLabel[conversation.priority]} · {statusLabel[conversation.status]}</small></span>{conversation.unreadCount > 0 && <em>{conversation.unreadCount}</em>}</button>)}</div>
      </aside>

      <section className={styles.chat}>
        {!active ? <div className={styles.placeholder}><UsersRound size={46}/><h2>Conversaciones del equipo</h2><p>Crea un chat 1:1 o grupal para colaborar sin exponer notas al cliente.</p></div> : <>
          <header className={styles.chatHeader}><div><b>{active.title}</b><small>{activeAccount ? `Vinculada a ${activeAccount.name}` : "Sin prospecto vinculado"}</small></div><select aria-label="Estado" value={active.status} disabled={!canCoordinate} onChange={(event) => void updateConversation({ status: event.target.value })}>{Object.entries(statusLabel).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Prioridad" value={active.priority} disabled={!canCoordinate} onChange={(event) => void updateConversation({ priority: event.target.value })}>{Object.entries(priorityLabel).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></header>
          <details className={styles.mobileContext}><summary>Participantes, responsable e historial</summary><div className={styles.context}>{contextContent}</div></details>
          <div className={styles.messages}>{messageCursor && <button className={styles.loadEarlier} onClick={() => void loadMessages(active.id, messageCursor)}>Cargar mensajes anteriores</button>}{messages.length === 0 && <div className={styles.emptyMessage}><Bell size={22}/><b>Aún no hay notas internas.</b><span>El primer mensaje quedará visible solo para los participantes.</span></div>}{messages.map((message) => { const sender = users.find((user) => user.id === message.senderId); const replied = messages.find((item) => item.id === message.replyToId); return <article key={message.id} className={`${styles.message} ${message.senderId === currentUser.id ? styles.mine : ""}`}><div className={styles.messageMeta}><b>{sender?.fullName ?? "Usuario"}</b><time>{new Date(message.createdAt).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" })}</time></div>{replied && <blockquote>{users.find((user) => user.id === replied.senderId)?.fullName}: {replied.bodyText.slice(0,120)}</blockquote>}<p>{message.bodyText}</p>{message.mentionedUserIds.length > 0 && <small className={styles.mention}><AtSign size={12}/> {message.mentionedUserIds.map((id) => users.find((user) => user.id === id)?.fullName).filter(Boolean).join(", ")}</small>}{message.attachmentName && <a href={`/api/internal/attachments?messageId=${message.id}`} target="_blank" rel="noreferrer"><Paperclip size={14}/>{message.attachmentName}</a>}<div className={styles.actions}><button onClick={() => setReplyTo(message)}><MessageSquareReply size={14}/> Responder</button><button onClick={() => setTaskMessage(message)}><ClipboardPlus size={14}/> Crear tarea</button></div></article>; })}</div>
          {replyTo && <div className={styles.reply}><MessageSquareReply size={15}/><span>Respondiendo a <b>{users.find((user) => user.id === replyTo.senderId)?.fullName}</b>: {replyTo.bodyText.slice(0,100)}</span><button onClick={() => setReplyTo(null)}><X size={15}/></button></div>}
          {attachment && <div className={styles.reply}><Paperclip size={15}/><span>{attachment.name} · {Math.ceil(attachment.size / 1024)} KB</span><button onClick={() => setAttachment(null)}><X size={15}/></button></div>}
          <div className={styles.mentionBar}><span>Mencionar:</span>{activeMembers.filter((member) => member.userId !== currentUser.id).map((member) => <button key={member.userId} onClick={() => insertMention(member.userId)}>@{users.find((user) => user.id === member.userId)?.fullName.split(" ")[0]}</button>)}</div>
          <footer className={styles.composer}><input ref={fileRef} type="file" hidden accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }}/><button title="Adjuntar" onClick={() => fileRef.current?.click()}><Paperclip size={19}/></button><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escribe una nota interna…" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }}/><button className={styles.send} disabled={sending || (!draft.trim() && !attachment)} onClick={() => void sendMessage()}><Send size={18}/></button></footer>
        </>}
      </section>

      <aside className={styles.context}>{contextContent}</aside>
    </div>
    {newOpen && <NewConversationModal users={activeUsers} opportunities={opportunities} accounts={accounts} currentUserId={currentUser.id} onClose={() => setNewOpen(false)} onCreated={async (id) => { setNewOpen(false); await loadConversations(); setActiveId(id); }}/>}
    {taskMessage && active && <TaskModal message={taskMessage} opportunityId={active.opportunityId} users={activeUsers} opportunities={opportunities} accounts={accounts} currentUserId={currentUser.id} onClose={() => setTaskMessage(null)} onCreated={async () => { setTaskMessage(null); await refreshData(); }}/>}
  </>;
}

function AddMember({ users, onAdd }: { users: ReturnType<typeof useCrm>["users"]; onAdd: (id: string, role: "member" | "observer") => Promise<boolean> }) {
  const [id, setId] = useState(""); const [role, setRole] = useState<"member" | "observer">("member");
  if (!users.length) return null;
  return <div className={styles.addMember}><select value={id} onChange={(event) => setId(event.target.value)}><option value="">Agregar persona…</option>{users.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}</select><select value={role} onChange={(event) => setRole(event.target.value as "member" | "observer")}><option value="member">Participante</option><option value="observer">Observador</option></select><button disabled={!id} onClick={async () => { if (await onAdd(id, role)) setId(""); }}><UserPlus size={15}/> Agregar</button></div>;
}

function NewConversationModal({ users, opportunities, accounts, currentUserId, onClose, onCreated }: { users: ReturnType<typeof useCrm>["users"]; opportunities: ReturnType<typeof useCrm>["opportunities"]; accounts: ReturnType<typeof useCrm>["accounts"]; currentUserId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const others = users.filter((user) => user.id !== currentUserId); const [type, setType] = useState<"direct"|"group">("direct"); const [title,setTitle]=useState(""); const [selected,setSelected]=useState<string[]>([]); const [observers,setObservers]=useState<string[]>([]); const [opportunityId,setOpportunityId]=useState(""); const [priority,setPriority]=useState("normal"); const [error,setError]=useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); const memberIds = [currentUserId,...selected]; const response=await fetch("/api/internal/conversations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,conversationType:type,opportunityId:opportunityId||undefined,responsibleId:currentUserId,memberIds,observerIds:observers,priority})}); const result=await response.json().catch(()=>({})); if(!response.ok)setError(result.error??"No fue posible crear la conversación.");else onCreated(result.conversationId); }
  return <Modal title="Nueva conversación interna" description="Chat del equipo: nunca se envía al cliente." onClose={onClose}><form onSubmit={submit}>{error&&<div className="sync-banner sync-error">{error}</div>}<div className="form-grid"><label className="field"><span>Tipo</span><select value={type} onChange={(event)=>{setType(event.target.value as "direct"|"group");setSelected([]);setObservers([]);}}><option value="direct">1:1</option><option value="group">Grupo</option></select></label><label className="field"><span>Prioridad</span><select value={priority} onChange={(event)=>setPriority(event.target.value)}><option value="normal">Normal</option><option value="important">Importante</option><option value="urgent">Urgente</option></select></label><label className="field field-wide"><span>Título</span><input value={title} onChange={(event)=>setTitle(event.target.value)} required minLength={2}/></label><label className="field field-wide"><span>Prospecto vinculado (opcional)</span><select value={opportunityId} onChange={(event)=>setOpportunityId(event.target.value)}><option value="">Sin vínculo</option>{opportunities.map((opportunity)=><option key={opportunity.id} value={opportunity.id}>{accounts.find((account)=>account.id===opportunity.accountId)?.name}</option>)}</select></label><fieldset className={`field field-wide ${styles.people}`}><legend>{type==="direct"?"Selecciona una persona":"Participantes"}</legend>{others.map((user)=><label key={user.id}><input type={type==="direct"?"radio":"checkbox"} name="member" checked={selected.includes(user.id)} onChange={(event)=>{setSelected(type==="direct"?(event.target.checked?[user.id]:[]):event.target.checked?[...selected,user.id]:selected.filter((id)=>id!==user.id));if(event.target.checked)setObservers((items)=>items.filter((id)=>id!==user.id));}}/>{user.fullName}</label>)}</fieldset>{type==="group"&&<fieldset className={`field field-wide ${styles.people}`}><legend>Observadores (opcional)</legend>{others.filter((user)=>!selected.includes(user.id)).map((user)=><label key={user.id}><input type="checkbox" checked={observers.includes(user.id)} onChange={(event)=>setObservers(event.target.checked?[...observers,user.id]:observers.filter((id)=>id!==user.id))}/>{user.fullName}</label>)}</fieldset>}</div><div className="form-actions"><button type="button" className="button" onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={!title.trim()||selected.length===0}><UsersRound size={16}/> Crear</button></div></form></Modal>;
}

function TaskModal({ message, opportunityId, users, opportunities, accounts, currentUserId, onClose, onCreated }: { message: InternalMessage; opportunityId?: string; users: ReturnType<typeof useCrm>["users"]; opportunities: ReturnType<typeof useCrm>["opportunities"]; accounts: ReturnType<typeof useCrm>["accounts"]; currentUserId: string; onClose:()=>void; onCreated:()=>void }) {
  const date=new Date(Date.now()+24*60*60*1000); date.setMinutes(date.getMinutes()-date.getTimezoneOffset()); const [title,setTitle]=useState(message.bodyText.slice(0,180)||"Revisar adjunto interno"); const [ownerId,setOwnerId]=useState(currentUserId); const [targetOpportunity,setTargetOpportunity]=useState(opportunityId??""); const [dueAt,setDueAt]=useState(date.toISOString().slice(0,16)); const [priority,setPriority]=useState("media"); const [error,setError]=useState("");
  async function submit(event:React.FormEvent){event.preventDefault();const response=await fetch("/api/internal/tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messageId:message.id,title,opportunityId:targetOpportunity||undefined,ownerId,dueAt:new Date(dueAt).toISOString(),priority})});const result=await response.json().catch(()=>({}));if(!response.ok)setError(result.error??"No fue posible crear la tarea.");else onCreated();}
  return <Modal title="Convertir mensaje en tarea" description="La tarea quedará vinculada al prospecto seleccionado." onClose={onClose}><form onSubmit={submit}>{error&&<div className="sync-banner sync-error">{error}</div>}<div className="form-grid"><label className="field field-wide"><span>Tarea</span><input value={title} onChange={(event)=>setTitle(event.target.value)} required/></label><label className="field field-wide"><span>Prospecto</span><select value={targetOpportunity} onChange={(event)=>setTargetOpportunity(event.target.value)} required><option value="">Seleccionar…</option>{opportunities.map((opportunity)=><option key={opportunity.id} value={opportunity.id}>{accounts.find((account)=>account.id===opportunity.accountId)?.name}</option>)}</select></label><label className="field"><span>Responsable</span><select value={ownerId} onChange={(event)=>setOwnerId(event.target.value)}>{users.map((user)=><option key={user.id} value={user.id}>{user.fullName}</option>)}</select></label><label className="field"><span>Vence</span><input type="datetime-local" value={dueAt} onChange={(event)=>setDueAt(event.target.value)} required/></label><label className="field"><span>Prioridad</span><select value={priority} onChange={(event)=>setPriority(event.target.value)}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></label></div><div className="form-actions"><button type="button" className="button" onClick={onClose}>Cancelar</button><button className="button button-primary"><ClipboardPlus size={16}/> Crear tarea</button></div></form></Modal>;
}
