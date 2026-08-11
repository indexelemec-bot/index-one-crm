"use client";
import { Bot, Check, CirclePlus, Clock3, Mail, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useCrm } from "@/components/crm-provider";
import { Modal, PageHeader } from "@/components/ui";
import { AiSalesCoach } from "@/components/ai-sales-coach";

export default function TareasPage() {
  const { tasks, opportunities, accounts, users, currentUser, addTask, completeTask } = useCrm();
  const [open, setOpen] = useState(false); const [completeId, setCompleteId] = useState<string | null>(null);
  const [seedOpportunity, setSeedOpportunity] = useState(""); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState("");
  const [coachOpportunity, setCoachOpportunity] = useState<string | null>(null);
  const manager = ["superadmin", "gerencia_comercial"].includes(currentUser.role);
  const mine = tasks.filter((task) => task.ownerId === currentUser.id || manager);
  const accountFor = (opportunityId: string) => { const opportunity = opportunities.find((item) => item.id === opportunityId); return accounts.find((account) => account.id === opportunity?.accountId); };

  useEffect(() => {
    const incoming = new URLSearchParams(window.location.search).get("nueva");
    if (incoming) { setSeedOpportunity(incoming); setOpen(true); }
  }, []);

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setNotice(""); const form = new FormData(event.currentTarget);
    const ownerId = String(form.get("ownerId") || currentUser.id);
    const ok = await addTask({ id: `t${Date.now()}`, opportunityId: String(form.get("opportunityId")), title: String(form.get("title")), dueAt: new Date(String(form.get("dueAt"))).toISOString(), priority: String(form.get("priority")) as "alta" | "media" | "baja", status: "pendiente", ownerId });
    setSaving(false); if (!ok) return;
    const assignee = users.find((user) => user.id === ownerId); setOpen(false); setNotice(`Tarea asignada a ${assignee?.fullName ?? "el usuario"}. Se envió el aviso a ${assignee?.email ?? "su correo"}.`);
  }

  function finish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const outcome = String(form.get("outcome")); const next = String(form.get("nextAction")); const due = String(form.get("nextDue")); const old = tasks.find((task) => task.id === completeId);
    completeTask(completeId!, outcome, next && due && old ? { id: `t${Date.now()}`, opportunityId: old.opportunityId, title: next, dueAt: new Date(due).toISOString(), priority: "media", status: "pendiente", ownerId: old.ownerId } : undefined); setCompleteId(null);
  }

  return <><PageHeader eyebrow="Disciplina comercial" title="Tareas y próximas acciones" description="Asigna responsables, notifica por correo y conserva el resultado y el siguiente movimiento comercial."><button className="button button-primary" onClick={() => { setSeedOpportunity(""); setOpen(true); }}><CirclePlus size={18}/> Nueva tarea</button></PageHeader>
    {notice && <div className="sync-banner"><Mail size={15}/>{notice}</div>}
    <div className="card"><div className="section-head"><div><h2>Agenda comercial</h2><p>{mine.filter((task) => task.status !== "completada").length} acciones abiertas</p></div><Clock3 size={19} color="#f47721"/></div>{mine.sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map((task) => { const assignee = users.find((user) => user.id === task.ownerId); return <div className={`task-row ${task.status === "completada" ? "done" : ""}`} key={task.id}><button className="task-check" onClick={() => task.status !== "completada" && setCompleteId(task.id)} aria-label="Completar tarea">{task.status === "completada" && <Check size={15} color="white"/>}</button><div className="task-copy"><b><span className={`priority priority-${task.priority}`}/>{task.title}</b><small>{accountFor(task.opportunityId)?.name} · {new Date(task.dueAt).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" })}</small><small><UserRound size={11}/> {assignee?.fullName ?? "Sin asignar"}</small>{task.outcome && <small>Resultado: {task.outcome}</small>}</div>{task.status !== "completada" && <button className="button compact" onClick={() => setCoachOpportunity(task.opportunityId)}><Bot size={14}/> Consultar IA</button>}<span className={`status-pill status-${task.status === "vencida" ? "inactive" : "active"}`}>{task.status}</span></div>; })}</div>
    {open && <Modal title="Crear y asignar tarea comercial" description="Al guardar, el responsable recibirá un correo con cliente, acción, vencimiento y prioridad." onClose={() => setOpen(false)}><form onSubmit={add}><div className="form-grid"><label className="field field-wide"><span>Oportunidad</span><select name="opportunityId" defaultValue={seedOpportunity}>{opportunities.filter((opportunity) => !["cliente_activo", "perdida"].includes(opportunity.stage)).map((opportunity) => <option value={opportunity.id} key={opportunity.id}>{accountFor(opportunity.id)?.name}</option>)}</select></label><label className="field field-wide"><span>Acción</span><input name="title" required placeholder="Ej. Llamar al presidente de la junta"/></label><label className="field"><span>Responsable</span><select name="ownerId" defaultValue={currentUser.id}>{users.filter((user) => user.active && (manager || user.id === currentUser.id)).map((user) => <option value={user.id} key={user.id}>{user.fullName}</option>)}</select></label><label className="field"><span>Prioridad</span><select name="priority"><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></label><label className="field field-wide"><span>Fecha y hora</span><input name="dueAt" type="datetime-local" required/></label></div><div className="form-actions"><button type="button" className="button" onClick={() => setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? "Guardando y notificando…" : "Asignar y enviar correo"}</button></div></form></Modal>}
    {completeId && <Modal title="Completar seguimiento" description="Registra el resultado y deja programada la próxima acción." onClose={() => setCompleteId(null)}><form onSubmit={finish}><div className="form-grid"><label className="field field-wide"><span>Resultado obtenido</span><textarea name="outcome" required/></label><label className="field"><span>Próxima acción</span><input name="nextAction" placeholder="Obligatoria si la oportunidad sigue activa" required/></label><label className="field"><span>Fecha de la próxima acción</span><input name="nextDue" type="datetime-local" required/></label></div><div className="form-actions"><button type="button" className="button" onClick={() => setCompleteId(null)}>Cancelar</button><button className="button button-primary">Completar y programar</button></div></form></Modal>}
    {coachOpportunity && <AiSalesCoach opportunityId={coachOpportunity} clientName={accountFor(coachOpportunity)?.name ?? "Oportunidad"} onClose={() => setCoachOpportunity(null)}/>}
  </>;
}
