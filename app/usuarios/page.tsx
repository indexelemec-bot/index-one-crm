"use client";
import { CheckCircle2, Mail, Shield, UserPlus } from "lucide-react";
import { useState } from "react";
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
  const { users, currentUser, toggleUser, inviteUser } = useCrm();
  const [open, setOpen] = useState(false); const [sending, setSending] = useState(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const canManage = canManageUsers(currentUser);

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSending(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const result = await inviteUser({ fullName: String(form.get("fullName")), email: String(form.get("email")), role: String(form.get("role")) as UserRole });
    setSending(false);
    if (!result.ok) { setError(result.error ?? "No fue posible enviar la invitación."); return; }
    setOpen(false); setMessage("Invitación enviada. El usuario podrá definir su contraseña desde el enlace recibido.");
  }

  return <><PageHeader eyebrow="Seguridad y acceso" title="Usuarios, roles y permisos" description="Invita al equipo desde el CRM y define desde el inicio qué información y acciones tendrá disponibles."><button className="button button-primary" disabled={!canManage} onClick={() => { setOpen(true); setError(""); }}><UserPlus size={18}/> Invitar usuario</button></PageHeader>
    {message && <div className="sync-banner"><CheckCircle2 size={15}/> {message}</div>}
    <section className="card role-guide"><div><Shield size={22}/><span><b>Acceso por rol</b><small>Los ejecutivos ven únicamente su cartera; gerencia y superadministración supervisan el equipo.</small></span></div><div><Mail size={22}/><span><b>Activación por correo</b><small>Cada invitado recibe un enlace seguro para establecer su propia contraseña.</small></span></div></section>
    <div className="card table-wrap"><table className="table"><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Alcance</th><th>Acción</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><div className="role-card"><span className="avatar">{user.fullName.split(" ").map((name) => name[0]).slice(0, 2).join("")}</span><span><strong>{user.fullName}</strong><small>{user.email}</small></span></div></td><td><Shield size={14} color="#145da0"/> {roleLabels[user.role]}</td><td><span className={`status-pill ${user.active ? "status-active" : "status-inactive"}`}>{user.active ? "Activo" : "Desactivado"}</span></td><td>{roleScopes[user.role]}</td><td><button className={`button compact ${user.active ? "button-danger" : ""}`} disabled={!canManage || user.id === currentUser.id} onClick={() => toggleUser(user.id)}>{user.active ? "Desactivar" : "Activar"}</button></td></tr>)}</tbody></table></div>
    {!canManage && <p className="muted-copy">Solo el superadministrador puede cambiar accesos o enviar invitaciones.</p>}
    {open && <Modal title="Invitar usuario" description="Se enviará un enlace de activación y el rol quedará asignado automáticamente." onClose={() => setOpen(false)}><form onSubmit={invite}>{error && <div className="sync-banner sync-error">{error}</div>}<div className="form-grid"><label className="field field-wide"><span>Nombre completo</span><input name="fullName" required/></label><label className="field field-wide"><span>Correo corporativo</span><input name="email" type="email" placeholder="nombre@indexelemecsrl.com" required/></label><label className="field field-wide"><span>Rol y permisos</span><select name="role" defaultValue="ejecutivo">{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label} — {roleScopes[value as UserRole]}</option>)}</select></label></div><div className="form-actions"><button type="button" className="button" onClick={() => setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={sending}>{sending ? "Enviando invitación…" : "Enviar invitación"}</button></div></form></Modal>}
  </>;
}
