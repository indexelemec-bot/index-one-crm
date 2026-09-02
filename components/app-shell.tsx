"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeDollarSign, Bot, BookOpenCheck, Building2, CheckSquare2, ChevronDown, FileSignature, Gauge, KanbanSquare, LogOut, Menu, MessageSquareText, Plus, ScrollText, Settings, UserRoundCog, X } from "lucide-react";
import { useEffect, useState } from "react";
import { roleLabels } from "@/lib/constants";
import { useCrm } from "@/components/crm-provider";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { mapProfile } from "@/lib/supabase/mappers";

const nav = [
  { href: "/dashboard", label: "Centro comercial", icon: Gauge },
  { href: "/prospectos", label: "Prospectos", icon: Building2 },
  { href: "/embudo", label: "Embudo B2B", icon: KanbanSquare },
  { href: "/tareas", label: "Tareas", icon: CheckSquare2 },
  { href: "/propuestas", label: "Propuestas", icon: ScrollText },
  { href: "/contratos", label: "Contratos", icon: FileSignature },
  { href: "/comunicaciones", label: "Comunicaciones", icon: MessageSquareText },
  { href: "/ventas", label: "Ventas y comisiones", icon: BadgeDollarSign },
  { href: "/academia", label: "Academia B2B", icon: BookOpenCheck },
  { href: "/agentes", label: "ARM · Agentes", icon: Bot },
  { href: "/usuarios", label: "Usuarios", icon: UserRoundCog }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [profileReady, setProfileReady] = useState(!isSupabaseConfigured);
  const { currentUser, users, setCurrentUser, resetDemo, loading, syncError } = useCrm();
  const isAuthPage = pathname === "/login" || pathname === "/update-password" || pathname === "/access-disabled" || pathname.startsWith("/auth/");

  useEffect(() => {
    if (!isSupabaseConfigured || isAuthPage) {
      setProfileReady(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        if (!supabase) return;
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user || cancelled) return;
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", authData.user.id).maybeSingle();
        if (profile && !cancelled) setCurrentUser(mapProfile(profile));
      } catch (error) {
        console.error("app-shell:profile", error);
      } finally {
        if (!cancelled) setProfileReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthPage, setCurrentUser]);

  useEffect(() => {
    if (!isSupabaseConfigured || isAuthPage || !profileReady || !currentUser?.active || !["ejecutivo", "gerencia_comercial", "superadmin"].includes(currentUser.role)) return;

    let cancelled = false;
    const processScheduled = async () => {
      try {
        const response = await fetch("/api/cron/scheduled-communications", { method: "POST", cache: "no-store" });
        if (!response.ok || cancelled) return;
        const result = await response.json().catch(() => null);
        if (!cancelled && result?.processed > 0) window.dispatchEvent(new CustomEvent("index:scheduled-processed"));
      } catch (error) {
        console.error("app-shell:scheduled-communications", error);
      }
    };

    void processScheduled();
    const timer = window.setInterval(() => { void processScheduled(); }, 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [isAuthPage, profileReady, currentUser?.id, currentUser?.role, currentUser?.active]);

  async function signOut() {
    try {
      const supabase = createClient();
      if (supabase) await supabase.auth.signOut();
    } finally {
      window.location.replace("/login");
    }
  }

  if (isAuthPage) return <>{children}</>;
  if (isSupabaseConfigured && !profileReady) return <main className="login-page"><section className="login-form-wrap"><div className="login-form"><span className="eyebrow">INDEX ONE</span><h2>Cargando tu perfil…</h2><p>Estamos preparando tu sesión y permisos.</p></div></section></main>;

  const fullName = currentUser?.fullName?.trim() || "Usuario INDEX ONE";
  const initials = fullName.split(/\s+/).filter(Boolean).map((name) => name[0] ?? "").slice(0, 2).join("").toUpperCase() || "IO";
  const roleLabel = currentUser?.role ? roleLabels[currentUser.role] ?? "Usuario" : "Usuario";

  return <div className="shell">
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="brand"><span className="brand-mark">⌂</span><span>INDEX <b>ONE</b><small>CRM CONDOMINIAL</small></span><button className="icon-button mobile-only" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X size={20}/></button></div>
      <nav className="nav" aria-label="Navegación principal">{nav.map(({ href, label, icon: Icon }) => <Link href={href} onClick={() => setOpen(false)} className={pathname.startsWith(href) ? "active" : ""} key={href}><Icon size={19}/><span>{label}</span></Link>)}</nav>
      <div className="sidebar-footer">
        {!isSupabaseConfigured&&<button className="nav-plain" onClick={resetDemo}><Settings size={18}/> Restablecer demo</button>}
        {isSupabaseConfigured&&<button className="nav-plain" onClick={signOut}><LogOut size={18}/> Cerrar sesión</button>}
        <div className="support-card"><b>{isSupabaseConfigured?"Supabase conectado":"Venta consultiva B2B"}</b><small>{isSupabaseConfigured?"Datos protegidos con RLS":"Diagnóstico → solución → aprobación"}</small></div>
      </div>
    </aside>
    {open && <button className="backdrop" onClick={() => setOpen(false)} aria-label="Cerrar menú"/>}
    <div className="workspace">
      <header className="app-header"><button className="icon-button mobile-only" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu size={22}/></button><div className="header-title">INDEX CONDO <span>•</span> Comercial</div><div className="header-actions"><Link href="/prospectos?nuevo=1" className="button button-primary compact"><Plus size={17}/> Nuevo prospecto</Link><label className="user-switcher"><span className="avatar">{initials}</span><span className="user-copy"><b>{fullName}</b><small>{roleLabel}</small></span>{!isSupabaseConfigured&&<ChevronDown size={15}/>}<select value={currentUser?.id ?? ""} disabled={isSupabaseConfigured} onChange={(e) => { const nextUser = users.find((u) => u.id === e.target.value); if (nextUser) setCurrentUser(nextUser); }} aria-label={isSupabaseConfigured?"Usuario autenticado":"Cambiar usuario de demostración"}>{users.filter((u) => u.active).map((u) => <option value={u.id} key={u.id}>{u.fullName}</option>)}</select></label></div></header>
      <main className="main">{loading&&<div className="sync-banner">Sincronizando con Supabase…</div>}{syncError&&<div className="sync-banner sync-error">{syncError}</div>}{children}</main>
    </div>
  </div>;
}
