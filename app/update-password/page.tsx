"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false); const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient(); if (!supabase) return;
    let resolved = false; const markReady = () => { resolved = true; setReady(true); setError(""); };
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (session) markReady(); });
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token"); const refreshToken = params.get("refresh_token");
    if (accessToken && refreshToken) {
      void supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error: sessionError }) => {
        if (sessionError) { setError("El enlace no es válido o venció. Solicita uno nuevo desde el acceso."); return; }
        window.history.replaceState({}, "", "/update-password"); markReady();
      });
    } else void supabase.auth.getSession().then(({ data }) => { if (data.session) markReady(); });
    const timeout = window.setTimeout(() => { if (!resolved) setError((current) => current || "El enlace no es válido o venció. Solicita uno nuevo desde el acceso."); }, 4000);
    return () => { listener.subscription.unsubscribe(); window.clearTimeout(timeout); };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); const form = new FormData(event.currentTarget);
    const password = String(form.get("password")); const confirmation = String(form.get("confirmation"));
    if (password.length < 10) { setError("Usa una contraseña de al menos 10 caracteres."); return; }
    if (password !== confirmation) { setError("Las contraseñas no coinciden."); return; }
    setLoading(true); const supabase = createClient(); const { error: updateError } = await supabase!.auth.updateUser({ password });
    if (updateError) { setError("No fue posible guardar la contraseña. Solicita un enlace nuevo."); setLoading(false); return; }
    router.replace("/dashboard"); router.refresh();
  }

  return <main className="login-page"><section className="login-brand"><div className="login-brand-inner"><div className="login-logo"><span>⌂</span> INDEX <b>ONE</b></div><p className="login-kicker">ACCESO SEGURO</p><h1>Activa tu acceso al <em>CRM comercial</em>.</h1><p>Define una contraseña personal para proteger prospectos, decisores, oportunidades y propuestas.</p><div className="login-proof"><ShieldCheck/><div><b>Sesión protegida por Supabase</b><small>Tu contraseña no se almacena en INDEX ONE CRM.</small></div></div></div></section><section className="login-form-wrap"><form className="login-form" onSubmit={submit}><div className="login-mobile-logo">INDEX <b>ONE</b></div><span className="eyebrow">Activación de cuenta</span><h2>Establece tu contraseña</h2><p>Usa al menos 10 caracteres y evita reutilizar contraseñas personales.</p><label className="login-field"><span>Nueva contraseña</span><div><LockKeyhole size={18}/><input name="password" type={visible?"text":"password"} autoComplete="new-password" required disabled={!ready}/><button type="button" onClick={()=>setVisible(!visible)} aria-label="Mostrar contraseña">{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label><label className="login-field"><span>Confirmar contraseña</span><div><LockKeyhole size={18}/><input name="confirmation" type={visible?"text":"password"} autoComplete="new-password" required disabled={!ready}/></div></label>{error&&<div className="field-error">{error}</div>}<button className="button button-primary login-button" disabled={!ready||loading}>{loading?"Guardando…":<>Guardar y entrar <ArrowRight size={18}/></>}</button><small className="demo-note">{ready?"Enlace validado. Ya puedes definir tu contraseña.":"Validando enlace seguro…"}</small></form></section></main>;
}
