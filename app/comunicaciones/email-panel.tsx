"use client";

import { FileText, Mail, Plus, Send } from "lucide-react";
import { useMemo, useState } from "react";
import type { Account, Communication, Opportunity, Proposal, Stakeholder } from "@/types/domain";
import { mapCommunication } from "@/lib/supabase/mappers";

function proposalEmailSubject(clientName: string) {
  return `Propuesta de Administración Integral — ${clientName}`;
}

function proposalEmailBody(clientName: string) {
  return `Estimados señores,\n\nReciban un cordial saludo.\n\nEn representación de Index EleMec SRL, a través de nuestra unidad especializada Index Condo, nos complace presentar formalmente nuestra Propuesta de Administración Integral para ${clientName}.\n\nNuestra propuesta ha sido estructurada para contribuir a una gestión organizada, transparente y orientada a resultados, procurando proteger el patrimonio de los propietarios, garantizar la continuidad de los servicios y fortalecer el control financiero y operativo del condominio.\n\nNuestro modelo contempla, entre otros aspectos:\n\n• Gestión financiera y administrativa, con controles, seguimiento presupuestario y rendición de cuentas.\n• Gestión de cobros y seguimiento de cuentas por cobrar.\n• Supervisión operativa y mantenimiento preventivo.\n• Coordinación de proveedores, contratistas y personal relacionado con la operación.\n• Atención y comunicación con propietarios y residentes.\n• Control documental y apoyo a la Junta Directiva.\n• Seguimiento de indicadores, incidencias y compromisos operativos.\n\nAdjunto a este correo encontrarán nuestra propuesta económica y de servicios para su evaluación. Nos gustaría tener la oportunidad de presentarla, conocer con mayor profundidad las necesidades actuales de ${clientName} y conversar sobre los próximos pasos.\n\nQuedamos a su disposición para coordinar una reunión en la fecha y horario que les resulte más conveniente.\n\nAgradecemos sinceramente la oportunidad de participar en este proceso.\n\nCordialmente,\n\nEquipo de Ventas\nIndex Condo\nUna división de Index EleMec SRL\nAdministración Integral de Condominios`;
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
  const [subject, setSubject] = useState(account ? `Seguimiento comercial — ${account.name}` : "Seguimiento comercial");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function selectOpportunity(id: string) {
    const nextOpportunity = opportunities.find((item) => item.id === id);
    const nextAccount = accounts.find((item) => item.id === nextOpportunity?.accountId);
    const nextContact = stakeholders.find((item) => item.accountId === nextAccount?.id && item.email);
    setOpportunityId(id);
    setStakeholderId(nextContact?.id ?? "");
    setProposalId("");
    setSubject(nextAccount ? `Seguimiento comercial — ${nextAccount.name}` : "Seguimiento comercial");
    setBody("");
    setError("");
    setSuccess("");
  }

  function loadProposalTemplate(id: string) {
    setProposalId(id);
    if (!account || !id) return;
    setSubject(proposalEmailSubject(account.name));
    setBody(proposalEmailBody(account.name));
  }

  async function sendEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!opportunity || !selectedContact) return;
    setSending(true); setError(""); setSuccess("");
    const response = await fetch("/api/communications/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId: opportunity.id, stakeholderId: selectedContact.id, proposalId: proposalId || undefined, templateKey: proposalId ? "propuesta" : undefined, subject, body })
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
        <div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Mail size={20}/><h2 style={{ margin: 0 }}>Correo comercial</h2></div><p style={{ margin: "6px 0 0", color: "var(--muted, #6b7280)" }}>Redacta correos, envía propuestas y conserva el historial dentro del CRM.</p></div>
        <button className="button" type="button" disabled={!opportunity?.id} onClick={() => { if (opportunity?.id) window.location.href = `/propuestas?nueva=${opportunity.id}`; }}><Plus size={16}/> Generar nueva propuesta</button>
      </div>
      {error && <div className="sync-banner sync-error">{error}</div>}
      {success && <div className="sync-banner">{success}</div>}
      <form onSubmit={sendEmail}>
        <div className="form-grid">
          <label className="field field-wide"><span>Prospecto / oportunidad</span><select value={opportunity?.id ?? ""} onChange={(event) => selectOpportunity(event.target.value)} required>{commercialOpportunities.map((item) => <option key={item.id} value={item.id}>{accounts.find((accountItem) => accountItem.id === item.accountId)?.name ?? "Cuenta"}</option>)}</select></label>
          <label className="field field-wide"><span>Destinatario</span><select value={selectedContact?.id ?? ""} onChange={(event) => setStakeholderId(event.target.value)} required>{contacts.length === 0 ? <option value="">Sin contactos con correo</option> : contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.fullName} · {contact.email}</option>)}</select></label>
          <label className="field field-wide"><span>Propuesta adjunta (opcional)</span><select value={proposalId} onChange={(event) => loadProposalTemplate(event.target.value)}><option value="">Correo sin propuesta</option>{versions.map((proposal) => <option key={proposal.id} value={proposal.id}>Versión {proposal.version} · {proposal.fileFormat.toUpperCase()} · {proposal.issueDate}</option>)}</select></label>
          <label className="field field-wide"><span>Asunto</span><input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={4} maxLength={180} required/></label>
          <label className="field field-wide"><span>Mensaje</span><textarea value={body} onChange={(event) => setBody(event.target.value)} rows={14} minLength={10} required/></label>
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
