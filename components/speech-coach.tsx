"use client";
import { Check, Clipboard, MessageSquareText, RotateCcw, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui";
import { useCrm } from "@/components/crm-provider";
import { availableSpeeches, personalizeSpeech, speechesForStage, type SalesSpeech } from "@/lib/sales-speeches";
import { stageLabels } from "@/lib/constants";
import type { Account, Opportunity, SpeechChannel, SpeechOutcome } from "@/types/domain";

const outcomes: Record<SpeechOutcome, string> = { sin_respuesta: "Sin respuesta", interes: "Mostró interés", reunion: "Reunión agendada", propuesta: "Solicitó propuesta", objecion: "Presentó objeción", cierre: "Avanzó al cierre", no_interes: "No tiene interés ahora" };
const channels: Record<SpeechChannel, string> = { llamada: "Llamada", reunion: "Reunión", email: "Correo", whatsapp: "WhatsApp" };

export function SpeechCoach({ opportunity, account, onClose }: { opportunity: Opportunity; account: Account; onClose: () => void }) {
  const { stakeholders, speechUsages, markSpeechUsed, currentUser } = useCrm();
  const contacts = stakeholders.filter((item) => item.accountId === account.id);
  const [stakeholderId, setStakeholderId] = useState(contacts.find((item) => item.isDecisionMaker)?.id ?? contacts[0]?.id ?? "");
  const available = useMemo(() => availableSpeeches(opportunity.stage, speechUsages, opportunity.id, stakeholderId || undefined), [opportunity, speechUsages, stakeholderId]);
  const used = useMemo(() => speechUsages.filter((item) => item.opportunityId === opportunity.id && item.stage === opportunity.stage && (!stakeholderId || item.stakeholderId === stakeholderId)), [opportunity, speechUsages, stakeholderId]);
  const [selectedId, setSelectedId] = useState(available[0]?.id ?? "");
  const selected = speechesForStage(opportunity.stage).find((item) => item.id === selectedId) ?? available[0];
  const contact = contacts.find((item) => item.id === stakeholderId);
  const personalized = selected ? personalizeSpeech(selected, account, opportunity, contact) : "";
  const [adapted, setAdapted] = useState(personalized);
  const [channel, setChannel] = useState<SpeechChannel>(selected?.channel ?? "llamada");
  const [outcome, setOutcome] = useState<SpeechOutcome>("interes");
  const [nextAction, setNextAction] = useState(opportunity.nextAction || "Dar seguimiento al contacto");
  const [nextActionAt, setNextActionAt] = useState(new Date(Date.now() + 86_400_000).toISOString().slice(0, 16));
  const [notes, setNotes] = useState(""); const [copied, setCopied] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState("");

  useEffect(() => { if (!selectedId || !available.some((item) => item.id === selectedId)) setSelectedId(available[0]?.id ?? ""); }, [available, selectedId]);
  useEffect(() => { setAdapted(personalized); setChannel(selected?.channel ?? "llamada"); }, [personalized, selected?.channel]);

  async function copy() { await navigator.clipboard.writeText(`${adapted}\n\nPróximo paso: ${selected?.cta ?? ""}`); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  async function saveUsage(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return; setSaving(true); setError("");
    const ok = await markSpeechUsed({ id: `speech-${Date.now()}`, speechId: selected.id, opportunityId: opportunity.id, stakeholderId: stakeholderId || undefined, stage: opportunity.stage, userId: currentUser.id, channel, outcome, notes: [notes.trim(), adapted !== personalized ? `Adaptación aplicada: ${adapted}` : ""].filter(Boolean).join("\n\n") || undefined, nextAction: nextAction.trim(), nextActionAt: new Date(nextActionAt).toISOString(), usedAt: new Date().toISOString() });
    setSaving(false); if (!ok) { setError("No fue posible registrar el uso."); return; }
    setNotes("");
  }

  return <Modal title={`Speeches · ${account.name}`} description={`${stageLabels[opportunity.stage]} · el sistema prioriza opciones todavía no utilizadas con este contacto.`} onClose={onClose} wide>
    <div className="speech-layout"><aside className="speech-sidebar"><label className="field"><span>Contacto</span><select value={stakeholderId} onChange={(event) => setStakeholderId(event.target.value)}><option value="">Sin contacto específico</option>{contacts.map((item) => <option value={item.id} key={item.id}>{item.fullName} · {item.role}</option>)}</select></label>
      <div className="speech-group"><b><Sparkles size={14}/> Recomendado</b>{available[0] ? <SpeechChoice item={available[0]} active={selected?.id === available[0].id} onClick={() => setSelectedId(available[0].id)}/> : <small>Ya utilizaste todas las opciones con este contacto. Cambia de decisor o etapa.</small>}</div>
      {available.length > 1 && <div className="speech-group"><b>Otros disponibles</b>{available.slice(1).map((item) => <SpeechChoice item={item} active={selected?.id === item.id} onClick={() => setSelectedId(item.id)} key={item.id}/>)}</div>}
      {used.length > 0 && <div className="speech-group used"><b><Check size={14}/> Ya utilizados ({used.length})</b>{used.map((usage) => { const item = speechesForStage(opportunity.stage).find((speech) => speech.id === usage.speechId); return <small key={usage.id}>{item?.title ?? usage.speechId} · {outcomes[usage.outcome]}</small>; })}</div>}
    </aside>
    <section className="speech-detail">{selected ? <><div className="speech-detail-head"><div><span className="technique-tag">{channels[channel]}</span><h2>{selected.title}</h2><p>Resultado buscado: {selected.cta}</p></div><button className="button" onClick={copy}>{copied ? <Check size={16}/> : <Clipboard size={16}/>} {copied ? "Copiado" : "Copiar"}</button></div>
      <label className="field"><span>Guion adaptable</span><textarea className="speech-text" value={adapted} onChange={(event) => setAdapted(event.target.value)}/></label><div className="speech-ethics">Úsalo como guía: escucha la respuesta, adapta el lenguaje y evita presión, urgencia falsa o promesas no verificables.</div>
      <form onSubmit={saveUsage} className="speech-result-form"><h3><MessageSquareText size={17}/> Registrar aplicación</h3>{error && <div className="sync-banner sync-error">{error}</div>}<div className="form-grid"><label className="field"><span>Canal utilizado</span><select value={channel} onChange={(event) => setChannel(event.target.value as SpeechChannel)}>{Object.entries(channels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="field"><span>Resultado</span><select value={outcome} onChange={(event) => setOutcome(event.target.value as SpeechOutcome)}>{Object.entries(outcomes).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="field"><span>Próxima acción</span><input value={nextAction} onChange={(event) => setNextAction(event.target.value)} required/></label><label className="field"><span>Fecha próxima acción</span><input type="datetime-local" value={nextActionAt} onChange={(event) => setNextActionAt(event.target.value)} required/></label><label className="field field-wide"><span>Notas de la conversación</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Objeciones, señales de interés y acuerdos…"/></label></div><div className="form-actions"><button className="button button-primary" disabled={saving}>{saving ? "Registrando…" : <><Send size={16}/> Marcar utilizado</>}</button></div></form>
    </> : <div className="empty-state"><RotateCcw size={28}/><b>Opciones agotadas para este contacto</b><p>Selecciona otro decisor o avanza la oportunidad cuando se cumpla el criterio de salida.</p></div>}</section></div>
  </Modal>;
}

function SpeechChoice({ item, active, onClick }: { item: SalesSpeech; active: boolean; onClick: () => void }) { return <button type="button" className={`speech-choice ${active ? "active" : ""}`} onClick={onClick}><span>{item.title}</span><small>{item.cta}</small></button>; }
