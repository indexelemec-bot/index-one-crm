"use client";

import { FileText, Mail, Plus, Send } from "lucide-react";
import { useMemo, useState } from "react";
import type { Account, Communication, Opportunity, Proposal, Stakeholder } from "@/types/domain";
import { mapCommunication } from "@/lib/supabase/mappers";

type EmailSpeechKey = "initial_contact" | "meeting" | "diagnostic_followup" | "proposal" | "proposal_followup" | "negotiation" | "reactivation";

const speechLabels: Record<EmailSpeechKey, string> = {
  initial_contact: "Primer acercamiento comercial",
  meeting: "Solicitud de reunión / presentación",
  diagnostic_followup: "Seguimiento después del diagnóstico",
  proposal: "Entrega formal de propuesta",
  proposal_followup: "Seguimiento de propuesta enviada",
  negotiation: "Negociación / próximos pasos",
  reactivation: "Reactivación de prospecto"
};

function contactGreeting(contact?: Stakeholder) {
  const firstName = contact?.fullName?.trim().split(/\s+/)[0];
  return firstName ? `Buen día, ${firstName}:` : "Buen día:";
}

function accountContext(account?: Account) {
  if (!account) return "la organización";
  if (account.accountType === "proyecto_nuevo" || account.accountType === "constructora" || account.accountType === "desarrollador") {
    return `el proyecto ${account.name}`;
  }
  return account.name;
}

function commercialSpeech(key: EmailSpeechKey, account?: Account, opportunity?: Opportunity, contact?: Stakeholder) {
  const client = account?.name ?? "su organización";
  const context = accountContext(account);
  const greeting = contactGreeting(contact);
  const units = account?.units ? `, con ${account.units} unidades` : "";
  const problem = opportunity?.primaryProblem?.trim();

  const signature = `\n\nEquipo de Ventas\nIndex Condo\nUna división de Index EleMec SRL\nAdministración Integral de Condominios`;

  const templates: Record<EmailSpeechKey, { subject: string; body: string }> = {
    initial_contact: {
      subject: `Conversemos sobre la administración de ${client}`,
      body: `${greeting}\n\nEs un placer contactarles en nombre de Index Condo. Hemos identificado una oportunidad para conversar sobre la gestión administrativa y operativa de ${context}${units}.\n\nNuestro enfoque integra control financiero, gestión de cobros, supervisión operativa, mantenimiento preventivo, atención a propietarios y seguimiento de compromisos, con información clara para la Junta Directiva.\n\nNos gustaría conocer las prioridades actuales de ${client} y validar si nuestro modelo puede aportar valor en los puntos que hoy requieren mayor atención.\n\n¿Podemos coordinar una conversación breve durante los próximos días?${signature}`
    },
    meeting: {
      subject: `Reunión de presentación — Index Condo + ${client}`,
      body: `${greeting}\n\nGracias por la apertura para conocer nuestro modelo de Administración Integral. Nos gustaría coordinar una reunión con el equipo responsable de ${client} para presentar nuestra metodología y entender con mayor precisión sus prioridades.\n\nDurante la reunión podemos revisar gestión financiera, cuentas por cobrar, mantenimiento, supervisión de servicios, atención a residentes y mecanismos de reporte a la Junta Directiva.\n\nQuedamos disponibles para ajustar la reunión al día y horario que resulte más conveniente para ustedes.${signature}`
    },
    diagnostic_followup: {
      subject: `Seguimiento al diagnóstico de ${client}`,
      body: `${greeting}\n\nGracias por compartir con nosotros información sobre la situación actual de ${client}. ${problem ? `Tomamos como punto prioritario: ${problem}.` : "Hemos organizado los principales puntos conversados para orientar la solución."}\n\nA partir de este diagnóstico estamos estructurando una recomendación enfocada en fortalecer el control administrativo, la continuidad operativa y la trazabilidad de las gestiones.\n\nEl próximo paso que proponemos es revisar juntos las prioridades y validar el alcance antes de presentar la solución económica.${signature}`
    },
    proposal: {
      subject: `Propuesta de Administración Integral — ${client}`,
      body: `${greeting}\n\nEn nombre de Index Condo, compartimos nuestra Propuesta de Administración Integral para ${client}, preparada a partir de las necesidades y oportunidades identificadas durante el proceso comercial.\n\nLa propuesta contempla un modelo de gestión orientado a organización, transparencia, control financiero, seguimiento de cobros, supervisión operativa, mantenimiento preventivo y comunicación efectiva con propietarios y Junta Directiva.\n\nAdjunto a este correo encontrarán la propuesta económica y de servicios para su evaluación. Nos gustaría revisarla junto a ustedes, aclarar cualquier inquietud y conversar sobre los próximos pasos.\n\nQuedamos disponibles para coordinar la presentación en el momento que resulte más conveniente.${signature}`
    },
    proposal_followup: {
      subject: `Seguimiento a propuesta presentada — ${client}`,
      body: `${greeting}\n\nNos ponemos en contacto para dar seguimiento a la propuesta de Administración Integral compartida para ${client}.\n\nQueremos confirmar que pudieron revisarla y conocer si existen preguntas, observaciones o ajustes que debamos considerar para avanzar en su evaluación.\n\nPodemos coordinar una llamada o reunión breve para revisar los puntos principales y definir el próximo paso del proceso.${signature}`
    },
    negotiation: {
      subject: `Próximos pasos comerciales — ${client}`,
      body: `${greeting}\n\nAgradecemos el avance que hemos logrado en las conversaciones sobre la administración de ${client}.\n\nNuestro interés es cerrar los puntos pendientes de manera clara y asegurar que el alcance, responsabilidades y condiciones de la propuesta respondan a las necesidades de la Junta Directiva y del condominio.\n\nQuedamos disponibles para revisar los ajustes finales y definir conjuntamente la ruta hacia aprobación, contratación y transición.${signature}`
    },
    reactivation: {
      subject: `Retomemos la conversación sobre ${client}`,
      body: `${greeting}\n\nHace un tiempo conversamos sobre las necesidades de administración de ${client} y nos gustaría retomar el contacto para conocer cómo ha evolucionado la situación.\n\nEn Index Condo continuamos fortaleciendo nuestro modelo de gestión integral para ayudar a Juntas Directivas y proyectos residenciales a mejorar control financiero, cobros, mantenimiento, supervisión y comunicación.\n\nSi actualmente están evaluando mejoras o alternativas de administración, será un placer retomar la conversación y revisar cómo podemos apoyarles.${signature}`
    }
  };

  return templates[key];
}

type Props = {
  accounts: Account[];
  opportunities: Opportunity[];
  stakeholders: Stakeholder[];
  proposals: Proposal[];
  messages: Communication[];
  onMessageSent: (message: Communication) => void;
  onReload: () => Promise<void>;
};

export function EmailPanel({ accounts, opportunities, stakeholders, proposals, messages, onMessageSent, onReload }: Props) {
  const commercialOpportunities = useMemo(() => opportunities.filter((item) => item.stage !== "cliente_activo" && item.stage !== "perdida"), [opportunities]);
  const [opportunityId, setOpportunityId] = useState(commercialOpportunities[0]?.id ?? "");
  const opportunity = opportunities.find((item) => item.id === opportunityId) ?? commercialOpportunities[0];
  const account = accounts.find((item) => item.id === opportunity?.accountId);
  const contacts = stakeholders.filter((item) => item.accountId === account?.id && Boolean(item.email));
  const [stakeholderId, setStakeholderId] = useState(contacts[0]?.id ?? "");
  const selectedContact = contacts.find((item) => item.id === stakeholderId) ?? contacts[0];
  const versions = proposals.filter((item) => item.opportunityId === opportunity?.id).sort((a, b) => b.version - a.version);
  const [proposalId, setProposalId] = useState("");
  const [speechKey, setSpeechKey] = useState<EmailSpeechKey>("initial_contact");
  const initialSpeech = commercialSpeech("initial_contact", account, opportunity, selectedContact);
  const [subject, setSubject] = useState(initialSpeech.subject);
  const [body, setBody] = useState(initialSpeech.body);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function applySpeech(key: EmailSpeechKey, nextAccount = account, nextOpportunity = opportunity, nextContact = selectedContact) {
    const speech = commercialSpeech(key, nextAccount, nextOpportunity, nextContact);
    setSpeechKey(key);
    setSubject(speech.subject);
    setBody(speech.body);
  }

  function selectOpportunity(id: string) {
    const nextOpportunity = opportunities.find((item) => item.id === id);
    const nextAccount = accounts.find((item) => item.id === nextOpportunity?.accountId);
    const nextContact = stakeholders.find((item) => item.accountId === nextAccount?.id && item.email);
    setOpportunityId(id);
    setStakeholderId(nextContact?.id ?? "");
    setProposalId("");
    applySpeech("initial_contact", nextAccount, nextOpportunity, nextContact);
    setError("");
    setSuccess("");
  }

  function changeContact(id: string) {
    const nextContact = contacts.find((item) => item.id === id);
    setStakeholderId(id);
    applySpeech(speechKey, account, opportunity, nextContact);
  }

  function loadProposalTemplate(id: string) {
    setProposalId(id);
    if (id) applySpeech("proposal");
  }

  async function sendEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!opportunity || !selectedContact) return;
    setSending(true); setError(""); setSuccess("");
    const response = await fetch("/api/communications/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId: opportunity.id, stakeholderId: selectedContact.id, proposalId: proposalId || undefined, templateKey: speechKey, subject, body })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "No fue posible enviar el correo.");
      setSending(false);
      return;
    }
    onMessageSent(mapCommunication(result.communication));
    await onReload();
    setSuccess(proposalId ? "Propuesta enviada por correo y registrada en el expediente." : "Correo enviado y registrado en el expediente.");
    setSending(false);
  }

  const emailHistory = messages.filter((item) => item.channel === "email").slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return <div style={{ display: "grid", gap: 18 }}>
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Mail size={20}/><h2 style={{ margin: 0 }}>Correo comercial</h2></div><p style={{ margin: "6px 0 0", color: "var(--muted, #6b7280)" }}>Selecciona un speech comercial y el CRM carga automáticamente asunto y mensaje con los datos del prospecto.</p></div>
        <button className="button" type="button" disabled={!opportunity?.id} onClick={() => { if (opportunity?.id) window.location.href = `/propuestas?nueva=${opportunity.id}`; }}><Plus size={16}/> Generar nueva propuesta</button>
      </div>
      {error && <div className="sync-banner sync-error">{error}</div>}
      {success && <div className="sync-banner">{success}</div>}
      <form onSubmit={sendEmail}>
        <div className="form-grid">
          <label className="field field-wide"><span>Prospecto / oportunidad</span><select value={opportunity?.id ?? ""} onChange={(event) => selectOpportunity(event.target.value)} required>{commercialOpportunities.map((item) => <option key={item.id} value={item.id}>{accounts.find((accountItem) => accountItem.id === item.accountId)?.name ?? "Cuenta"}</option>)}</select></label>
          <label className="field field-wide"><span>Destinatario</span><select value={selectedContact?.id ?? ""} onChange={(event) => changeContact(event.target.value)} required>{contacts.length === 0 ? <option value="">Sin contactos con correo</option> : contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.fullName} · {contact.email}</option>)}</select></label>
          <label className="field field-wide"><span>Speech comercial</span><select value={speechKey} onChange={(event) => applySpeech(event.target.value as EmailSpeechKey)}>{(Object.keys(speechLabels) as EmailSpeechKey[]).map((key) => <option key={key} value={key}>{speechLabels[key]}</option>)}</select><small>Se adapta automáticamente al cliente, contacto, tipo de cuenta y etapa comercial.</small></label>
          <label className="field field-wide"><span>Propuesta adjunta (opcional)</span><select value={proposalId} onChange={(event) => loadProposalTemplate(event.target.value)}><option value="">Correo sin propuesta</option>{versions.map((proposal) => <option key={proposal.id} value={proposal.id}>Versión {proposal.version} · {proposal.fileFormat.toUpperCase()} · {proposal.issueDate}</option>)}</select></label>
          <label className="field field-wide"><span>Asunto</span><input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={4} maxLength={180} required/></label>
          <label className="field field-wide"><span>Mensaje preelaborado</span><textarea value={body} onChange={(event) => setBody(event.target.value)} rows={14} minLength={10} required/><small>Puedes editar libremente el texto antes de enviarlo.</small></label>
        </div>
        <div className="form-actions"><button className="button button-primary" disabled={sending || !selectedContact?.email || subject.trim().length < 4 || body.trim().length < 10}><Send size={16}/>{sending ? " Enviando…" : proposalId ? " Enviar propuesta" : " Enviar correo"}</button></div>
      </form>
    </div>

    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><FileText size={19}/><h3 style={{ margin: 0 }}>Historial de correos</h3></div>
      {emailHistory.length === 0 ? <p style={{ color: "var(--muted, #6b7280)" }}>Todavía no hay correos registrados.</p> : <div style={{ display: "grid", gap: 10 }}>{emailHistory.slice(0, 30).map((message) => {
        const contact = stakeholders.find((item) => item.id === message.stakeholderId);
        const opp = opportunities.find((item) => item.id === message.opportunityId);
        const acc = accounts.find((item) => item.id === opp?.accountId);
        return <div key={message.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><b>{message.subject || "Correo comercial"}</b><small>{new Date(message.sentAt ?? message.createdAt).toLocaleString("es-DO")}</small></div><small>{contact?.fullName ?? "Contacto"} · {acc?.name ?? "Cuenta"} · {message.status}</small><p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{message.bodyText}</p></div>;
      })}</div>}
    </div>
  </div>;
}
