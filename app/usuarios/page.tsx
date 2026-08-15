"use client";

import { AlertTriangle, CheckCircle2, Mail, Pencil, Shield, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useCrm } from "@/components/crm-provider";
import { Modal, PageHeader } from "@/components/ui";
import { roleLabels } from "@/lib/constants";
import { canManageUsers } from "@/lib/permissions";
import type { UserRole } from "@/types/domain";

const roleScopes: Record<UserRole, string> = {
  superadmin: "Configuración, usuarios y todo el CRM",
  gerencia_comercial: "Toda la cartera, asignaciones y reportes",
  ejecutivo: "Prospectos, tareas y oportunidades asignadas",
  administracion: "Ventas, comisiones y consulta comercial",
  consulta: "Lectura sin modificaciones"
};

export default function UsuariosPage() {
  const { users, accounts, opportunities, tasks, currentUser, inviteUser, updateUserProfile, refreshData } = useCrm();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [editingAccessId, setEditingAccessId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<UserRole>("ejecutivo");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reassignToId, setReassignToId] = useState("");
  const canManage = canManageUsers(currentUser);
  const visibleUsers = users.filter((user) => !user.deletedAt);
  const deletingUser = users.find((user) => user.id === deletingId);
  const deletionImpact = useMemo(() => deletingId ? {
    accounts: accounts.filter((item) => item.ownerId === deletingId).length,
    opportunities: opportunities.filter((item) => item.ownerId === deletingId).length,
    tasks: tasks.filter((item) => item.ownerId === deletingId && item.status !== "completada").length
  } : { accounts: 0, opportunities: 0, tasks: 0 }, [accounts, opportunities, tasks, deletingId]);

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSending(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const result = await inviteUser({ fullName: String(form.get("fullName")), email: String(form.get("email")), role: String(form.get("role")) as UserRole });
    setSending(false);
    if (!result.ok) { setError(result.error ?? "No fue posible enviar la invitación."); return; }
    setOpen(false); setMessage("Invitación enviada. El usuario podrá definir su contraseña desde el enlace recibido.");
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editingId) return; setSending(true); setError("");
    const result = await updateUserProfile(editingId, profileName); setSending(false);
    if (!result.ok) { setError(result.error ?? "No fue posible actualizar el perfil."); return; }
    setEditingId(null); setMessage("Nombre del perfil actualizado correctamente.");
  }

  async function saveAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editingAccessId || editingAccessId === currentUser.id) return;
    setSending(true); setError(""); setMessage("");
    const response = await fetch("/api/admin/users/role", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: editingAccessId, role: editingRole }) });
    const result = await response.json().catch(() => ({})); setSending(false);
    if (!response.ok) { setError(result.error ?? "No fue posible cambiar el rol."); return; }
    setEditingAccessId(null); await refreshData(); setMessage("Rol y alcance actualizados correctamente.");
  }

  async function changeStatus(userId: string, active: boolean) {
    if (userId === currentUser.id) return; setSending(true); setError(""); setMessage("");
    const response = await fetch("/api/admin/users/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, active }) });
    const result = await response.json().catch(() => ({})); setSending(false);
    if (!response.ok) { setError(result.error ?? "No fue posible actualizar el acceso."); return; }
    await refreshData(); setMessage(active ? "Usuario reactivado correctamente." : "Usuario desactivado. Su acceso quedó bloqueado.");
  }

  async function deleteUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deletingId || !reassignToId) { setError("Debes seleccionar quién recibirá la cartera antes de eliminar el usuario."); return; }
    setSending(true); setError(""); setMessage("");
    const response = await fetch("/api/admin/users/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: deletingId, reassignToUserId: reassignToId }) });
    const result = await response.json().catch(() => ({})); setSending(false);
    if (!response.ok) { setError(result.error ?? "No fue posible eliminar el usuario."); return; }
    setDeletingId(null); setReassignToId(""); await refreshData();
    setMessage(`${result.targetName ?? "Usuario"} fue eliminado del acceso activo. Se reasignaron ${result.reassigned?.accounts ?? 0} cuentas, ${result.reassigned?.opportunities ?? 0} oportunidades y ${result.reassigned?.tasks ?? 0} tareas. El historial anterior permanece intacto.`);
  }

  return <>
    <PageHeader eyebrow="Seguridad y acceso" title="Usuarios, roles y permisos" description="Invita al equipo, cambia roles, bloquea accesos y elimina usuarios con reasignación obligatoria de cartera."><button className="button button-primary" disabled={!canManage} onClick={() => { setOpen(true); setError(""); }}><UserPlus size={18}/> Invitar usuario</button></PageHeader>
    {message && <div className="sync-banner"><CheckCircle2 size={15}/> {message}</div>}
    {error && !open && !editingId && !editingAccessId && !deletingId && <div className="sync-banner sync-error">{error}</div>}

    <section className="card role-guide"><div><Shield size={22}/><span><b>Acceso por rol</b><small>Solo el superadministrador gestiona usuarios y permisos.</small></span></div><div><Mail size={22}/><span><b>Activación por correo</b><small>Cada invitado establece su propia contraseña desde un enlace seguro.</small></span></div></section>

    <div className="card table-wrap"><table className="table"><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Alcance</th><th>Acción</th></tr></thead><tbody>{visibleUsers.map((user) => <tr key={user.id}>
      <td><div className="role-card"><span className="avatar">{user.fullName.split(" ").map((name) => name[0]).slice(0, 2).join("")}</span><span><strong>{user.fullName}</strong><small>{user.email}</small></span></div></td>
      <td><Shield size={14} color="#145da0"/> {roleLabels[user.role]}</td><td><span className={`status-pill ${user.active ? "status-active" : "status-inactive"}`}>{user.active ? "Activo" : "Desactivado"}</span></td><td>{roleScopes[user.role]}</td>
      <td><div className="table-actions"><button className="button compact" disabled={!canManage} onClick={() => { setEditingId(user.id); setProfileName(user.fullName); setError(""); }}><Pencil size={14}/> Nombre</button><button className="button compact" disabled={!canManage || user.id === currentUser.id} onClick={() => { setEditingAccessId(user.id); setEditingRole(user.role); setError(""); }}><Shield size={14}/> Rol</button><button className={`button compact ${user.active ? "button-danger" : ""}`} disabled={!canManage || user.id === currentUser.id || sending} onClick={() => void changeStatus(user.id, !user.active)}>{user.active ? "Desactivar" : "Activar"}</button><button className="button compact button-danger" disabled={!canManage || user.id === currentUser.id || sending} onClick={() => { setDeletingId(user.id); setReassignToId(""); setError(""); }}><Trash2 size={14}/> Eliminar</button></div></td>
    </tr>)}</tbody></table></div>

    {!canManage && <p className="muted-copy">Solo el superadministrador puede administrar usuarios.</p>}

    {open && <Modal title="Invitar usuario" description="Se enviará un enlace de activación y el rol quedará asignado automáticamente." onClose={() => setOpen(false)}><form onSubmit={invite}>{error && <div className="sync-banner sync-error">{error}</div>}<div className="form-grid"><label className="field field-wide"><span>Nombre completo</span><input name="fullName" required/></label><label className="field field-wide"><span>Correo corporativo</span><input name="email" type="email" placeholder="nombre@indexelemecsrl.com" required/></label><label className="field field-wide"><span>Rol y permisos</span><select name="role" defaultValue="ejecutivo">{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label} — {roleScopes[value as UserRole]}</option>)}</select></label></div><div className="form-actions"><button type="button" className="button" onClick={() => setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={sending}>{sending ? "Enviando invitación…" : "Enviar invitación"}</button></div></form></Modal>}

    {editingId && <Modal title="Editar nombre del perfil" description="Este nombre aparecerá en asignaciones, tareas, ventas y comunicaciones del CRM." onClose={() => setEditingId(null)}><form onSubmit={saveProfile}>{error && <div className="sync-banner sync-error">{error}</div>}<label className="field"><span>Nombre completo</span><input value={profileName} onChange={(event) => setProfileName(event.target.value)} autoFocus required/></label><div className="form-actions"><button type="button" className="button" onClick={() => setEditingId(null)}>Cancelar</button><button className="button button-primary" disabled={sending}>{sending ? "Guardando…" : "Guardar nombre"}</button></div></form></Modal>}

    {editingAccessId && <Modal title="Cambiar rol y alcance" description="El nuevo rol se aplicará inmediatamente." onClose={() => setEditingAccessId(null)}><form onSubmit={saveAccess}>{error && <div className="sync-banner sync-error">{error}</div>}<label className="field"><span>Rol</span><select value={editingRole} onChange={(event) => setEditingRole(event.target.value as UserRole)}>{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label} — {roleScopes[value as UserRole]}</option>)}</select></label><div className="form-actions"><button type="button" className="button" onClick={() => setEditingAccessId(null)}>Cancelar</button><button className="button button-primary" disabled={sending}>{sending ? "Actualizando…" : "Actualizar rol"}</button></div></form></Modal>}

    {deletingId && deletingUser && <Modal title={`Eliminar a ${deletingUser.fullName}`} description="La eliminación retira su acceso, pero conserva su nombre y todo el historial comercial para auditoría." onClose={() => { setDeletingId(null); setError(""); }}><form onSubmit={deleteUser}>{error && <div className="sync-banner sync-error">{error}</div>}<div className="formal-note"><AlertTriangle size={18}/><span><b>Reasignación obligatoria antes de eliminar.</b><br/>Este usuario tiene {deletionImpact.accounts} cuentas, {deletionImpact.opportunities} oportunidades y {deletionImpact.tasks} tareas pendientes bajo su responsabilidad. El CRM transferirá la responsabilidad actual, pero conservará quién realizó cada gestión histórica.</span></div><label className="field"><span>Transferir cartera y responsabilidades a</span><select value={reassignToId} onChange={(event) => setReassignToId(event.target.value)} required><option value="">Selecciona un usuario activo…</option>{visibleUsers.filter((user) => user.id !== deletingId && user.active && ["superadmin","gerencia_comercial","ejecutivo"].includes(user.role)).map((user) => <option value={user.id} key={user.id}>{user.fullName} — {roleLabels[user.role]}</option>)}</select></label><div className="form-actions"><button type="button" className="button" onClick={() => setDeletingId(null)}>Cancelar</button><button className="button button-danger" disabled={sending || !reassignToId}>{sending ? "Reasignando y eliminando…" : "Confirmar eliminación"}</button></div></form></Modal>}
  </>;
}
