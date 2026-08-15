"use client";

import { ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AccessDisabledPage() {
  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand"><ShieldX size={34} /></div>
        <h1>Acceso desactivado</h1>
        <p>Tu cuenta de INDEX ONE CRM está desactivada. Comunícate con un administrador para solicitar la reactivación.</p>
        <button className="button button-primary" onClick={signOut}>Cerrar sesión</button>
      </section>
    </main>
  );
}
