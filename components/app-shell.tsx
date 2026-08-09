"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CheckSquare2, ChevronDown, Gauge, KanbanSquare, Menu, Plus, ScrollText, Settings, UserRoundCog, X } from "lucide-react";
import { useState } from "react";
import { roleLabels } from "@/lib/constants";
import { useCrm } from "@/components/crm-provider";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const nav = [
  { href: "/dashboard", label: "Centro comercial", icon: Gauge },
  { href: "/prospectos", label: "Prospectos", icon: Building2 },
  { href: "/embudo", label: "Embudo B2B", icon: KanbanSquare },
  { href: "/tareas", label: "Tareas", icon: CheckSquare2 },
  { href: "/propuestas", label: "Propuestas", icon: ScrollText },
  { href: "/usuarios", label: "Usuarios", icon: UserRoundCog }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const [open, setOpen] = useState(false); const { currentUser, users, setCurrentUser, resetDemo, loading, syncError } = useCrm();
  if (pathname === "/login") return <>{children}</>;
  return <div className="shell">
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="brand"><span className="brand-mark">⌂</span><span>INDEX <b>ONE</b><small>CRM CONDOMINIAL</small></span><button className="icon-button mobile-only" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X size={20}/></button></div>
      <nav className="nav" aria-label="Navegación principal">{nav.map(({ href, label, icon: Icon }) => <Link href={href} onClick={() => setOpen(false)} className={pathname.startsWith(href) ? "active" : ""} key={href}><Icon size={19}/><span>{label}</span></Link>)}</nav>
      <div className="sidebar-footer">{!isSupabaseConfigured&&<button className="nav-plain" onClick={resetDemo}><Settings size={18}/> Restablecer demo</button>}<div className="support-card"><b>{isSupabaseConfigured?"Supabase conectado":"Venta consultiva B2B"}</b><small>{isSupabaseConfigured?"Datos protegidos con RLS":"Diagnóstico → solución → aprobación"}</small></div></div>
    </aside>
    {open && <button className="backdrop" onClick={() => setOpen(false)} aria-label="Cerrar menú"/>}
    <div className="workspace">
      <header className="app-header"><button className="icon-button mobile-only" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu size={22}/></button><div className="header-title">INDEX CONDO <span>•</span> Comercial</div><div className="header-actions"><Link href="/prospectos?nuevo=1" className="button button-primary compact"><Plus size={17}/> Nuevo prospecto</Link><label className="user-switcher"><span className="avatar">{currentUser.fullName.split(" ").map((n) => n[0]).slice(0,2).join("")}</span><span className="user-copy"><b>{currentUser.fullName}</b><small>{roleLabels[currentUser.role]}</small></span>{!isSupabaseConfigured&&<ChevronDown size={15}/>}<select value={currentUser.id} disabled={isSupabaseConfigured} onChange={(e) => setCurrentUser(users.find((u) => u.id === e.target.value) ?? users[0])} aria-label={isSupabaseConfigured?"Usuario autenticado":"Cambiar usuario de demostración"}>{users.filter((u) => u.active).map((u) => <option value={u.id} key={u.id}>{u.fullName}</option>)}</select></label></div></header>
      <main className="main">{loading&&<div className="sync-banner">Sincronizando con Supabase…</div>}{syncError&&<div className="sync-banner sync-error">{syncError}</div>}{children}</main>
    </div>
  </div>;
}
