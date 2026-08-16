"use client";

import { Clock3, Download, FileCheck2, FileText, History, Mail, MessageCircle, Plus, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCrm } from "@/components/crm-provider";
import { Modal, PageHeader } from "@/components/ui";
import { formatCurrency } from "@/lib/constants";
import { selectComparableReferences } from "@/lib/reference-matching";
import { createClient } from "@/lib/supabase/client";
import { mapCommunication } from "@/lib/supabase/mappers";
import type { Communication, Proposal, ProposalFileFormat, Stakeholder } from "@/types/domain";

function proposalHistory(proposals: Proposal[], opportunityId: string) {
  return proposals.filter((proposal) => proposal.opportunityId === opportunityId).sort((a, b) => a.version - b.version);
}

function variationLabel(proposal: Proposal, history: Proposal[]) {
  const initial = history[0]?.monthlyFee ?? proposal.monthlyFee;
  const difference = proposal.monthlyFee - initial;
  if (!difference) return proposal.version === 1 ? "Monto inicial" : "Sin variación";
  const percentage = initial ? (difference / initial) * 100 : 0;
  return `${difference > 0 ? "+" : "-"}${formatCurrency(Math.abs(difference))} (${difference > 0 ? "+" : ""}${percentage.toFixed(1)}%)`;
}

function proposalEmailSubject(clientName: string) {
  return `Propuesta de Administración Integral — ${clientName}`;
}

function proposalEmailBody(clientName: string) {
  return `Estimados señores,\n\nReciban un cordial saludo.\n\nEn representación de Index EleMec SRL, a través de nuestra unidad especializada Index Condo, nos complace presentar formalmente nuestra Propuesta de Administración Integral para ${clientName}.\n\nNuestra propuesta ha sido estructurada para contribuir a una gestión organizada, transparente y orientada a resultados, procurando proteger el patrimonio de los propietarios, garantizar la continuidad de los servicios y fortalecer el control financiero y operativo del condominio.\n\nNuestro modelo contempla, entre otros aspectos:\n\n• Gestión financiera y administrativa, con controles, seguimiento presupuestario y rendición de cuentas.\n• Gestión de cobros y seguimiento de cuentas por cobrar.\n• Supervisión operativa y mantenimiento preventivo.\n• Coordinación de proveedores, contratistas y personal relacionado con la operación.\n• Atención y comunicación con propietarios y residentes.\n• Control documental y apoyo a la Junta Directiva.\n• Seguimiento de indicadores, incidencias y compromisos operativos.\n\nAdjunto a este correo encontrarán nuestra propuesta económica y de servicios para su evaluación. Nos gustaría tener la oportunidad de presentarla, conocer con mayor profundidad las necesidades actuales de ${clientName} y conversar sobre los próximos pasos.\n\nQuedamos a su disposición para coordinar una reunión en la fecha y horario que les resulte más conveniente.\n\nAgradecemos sinceramente la oportunidad de participar en este proceso.\n\nCordialmente,\n\nEquipo de Ventas\nIndex Condo\nUna división de Index EleMec SRL\nAdministración Integral de Condominios`;
}

function proposalWhatsAppBody(contactName: string, clientName: string) {
  const name = contactName.trim() || "cliente";
  return `Estimado/a ${name},\n\nEs un placer saludarle.\n\nEn nombre de Index Condo, compartimos con usted nuestra Propuesta de Administración Integral para ${clientName}, preparada para su evaluación.\n\nEn ella podrá conocer nuestro modelo de gestión y la propuesta diseñada para contribuir a una administración más organizada, eficiente, transparente y orientada a resultados.\n\n📄 Puede acceder a la propuesta a través del enlace adjunto.\n\nNos gustaría tener la oportunidad de revisarla junto a usted, aclarar cualquier inquietud y conversar sobre los próximos pasos.\n\nQuedamos atentos para coordinar una reunión en el momento que le resulte más conveniente.\n\nEquipo de Ventas\nIndex Condo\nUna división de Index EleMec SRL\nAdministración Integral de Condominios`;
}

export default function PropuestasPage() {
  const { proposals, opportunities, accounts, stakeholders, references, addProposal, updateOpportunity, refreshData, currentUser } = useCrm();
  const [open, setOpen] = useState(false);
  const [opportunityId, setOpportunityId] = useState("");
  const [fee, setFee] = useState(36000);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<string[]>([]);
  const [format, setFormat] = useState<ProposalFileFormat>("pdf");
  const [changeReason, setChangeReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [deliveries, setDeliveries] = useState<Communication[]>([]);
  const [deliveryProposal, setDeliveryProposal] = useState<Proposal>();
  const [deliveryChannel, setDeliveryChannel] = useState<"email" | "whatsapp">("email");
  const [deliveryStakeholder, setDeliveryStakeholder] = useState("");
  const [deliverySubject, setDeliverySubject] = useState("");
  const [deliveryBody, setDeliveryBody] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [delivering, setDelivering] = useState(false);

  const opportunity = opportunities.find((item) => item.id === opportunityId);
  const account = accounts.find((item) => item.id === opportunity?.accountId);
  const history = useMemo(() => proposalHistory(proposals, opportunityId), [proposals, opportunityId]);
  const previous = history.at(-1);
  const initial = history[0];
  const priceChanged = Boolean(previous && previous.monthlyFee !== fee);
  const suggestions = useMemo(() => account ? selectComparableReferences(account, references, 6) : [], [account, references]);
  const orderedProposals = useMemo(() => [...proposals].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)), [proposals]);
  const deliveryOpportunity = opportunities.find((item) => item.id === deliveryProposal?.opportunityId);
  const deliveryContacts = stakeholders.filter((item) => item.accountId === deliveryOpportunity?.accountId);
  const selectedDeliveryContact = deliveryContacts.find((item) => item.id === deliveryStakeholder);

  const loadDeliveries = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    const { data } = await supabase.from("communications").select("*").not("proposal_id", "is", null).order("created_at", { ascending: false });
    setDeliveries((data ?? []).map((row) => mapCommunication(row)));
  }, []);

  useEffect(() => {
    void loadDeliveries();
    const refresh = () => { if (document.visibilityState === "visible") void loadDeliveries(); };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [loadDeliveries]);

  function selectOpportunity(id: string) {
    setOpportunityId(id);
    const selectedOpportunity = opportunities.find((item) => item.id === id);
    const selectedHistory = proposalHistory(proposals, id);
    setFee(selectedHistory.at(-1)?.monthlyFee || selectedOpportunity?.monthlyFee || 36000);
    setChangeReason("");
  }

  useEffect(() => {
    const incoming = new URLSearchParams(window.location.search).get("nueva");
    if (incoming) { selectOpportunity(incoming); setOpen(true); }
    // The query string is only used to seed the modal when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunities]);

  useEffect(() => {
    if (account) setSelected(selectComparableReferences(account, references, 3).map((reference) => reference.id));
  }, [account, references]);

  function start() {
    const next = opportunities.find((item) => !["cliente_activo", "perdida"].includes(item.stage));
    selectOpportunity(next?.id ?? "");
    setFormat("pdf");
    setOpen(true);
  }

  async function generate() {
    if (!account || !opportunity || selected.length !== 3 || (priceChanged && !changeReason.trim())) return;
    setLoading(true);
    try {
      const chosen = selected.map((id) => references.find((reference) => reference.id === id)!);
      const response = await fetch("/api/proposals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, clientName: account.name, monthlyFee: fee, issueDate: date, referenceIds: selected, references: chosen, format })
      });
      if (!response.ok) throw new Error("No fue posible generar el archivo de la propuesta.");
      const blob = await response.blob();
      const proposalId = crypto.randomUUID();
      const savedProposal: Proposal = {
        id: proposalId,
        opportunityId,
        version: history.length + 1,
        clientName: account.name,
        issueDate: date,
        monthlyFee: fee,
        referenceIds: selected,
        status: "generada",
        generatedAt: new Date().toISOString(),
        fileFormat: format,
        changeReason: changeReason.trim() || undefined
      };

      const supabase = createClient();
      if (supabase) {
        const { error: persistenceError } = await supabase.from("proposals").insert({
          id: savedProposal.id,
          opportunity_id: savedProposal.opportunityId,
          version: savedProposal.version,
          client_name: savedProposal.clientName,
          issue_date: savedProposal.issueDate,
          monthly_fee: savedProposal.monthlyFee,
          reference_ids: savedProposal.referenceIds,
          status: savedProposal.status,
          file_format: savedProposal.fileFormat,
          change_reason: savedProposal.changeReason || null,
          generated_by: currentUser.id
        });
        if (persistenceError) throw new Error(`La propuesta se generó, pero no pudo guardarse en el CRM: ${persistenceError.message}`);
        await refreshData();
      } else {
        addProposal(savedProposal);
      }

      updateOpportunity(opportunityId, { monthlyFee: fee, stage: opportunity.stage === "propuesta" ? "negociacion" : opportunity.stage });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `propuesta-index-${account.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);

      setToast(`Versión ${savedProposal.version} generada, guardada y lista para enviar en ${format === "pdf" ? "PDF" : "Word"}`);
      setOpen(false);
      setTimeout(() => setToast(""), 4000);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "No fue posible generar y guardar la propuesta.");
      setTimeout(() => setToast(""), 6000);
    } finally { setLoading(false); }
  }

  function toggle(id: string) {
    setSelected((values) => values.includes(id) ? values.filter((value) => value !== id) : values.length < 3 ? [...values, id] : values);
  }

  function applyDeliveryTemplate(channel: "email" | "whatsapp", proposal: Proposal, contact?: Stakeholder) {
    if (channel === "email") {
      setDeliverySubject(proposalEmailSubject(proposal.clientName));
      setDeliveryBody(proposalEmailBody(proposal.clientName));
    } else {
      setDeliveryBody(proposalWhatsAppBody(contact?.fullName ?? "cliente", proposal.clientName));
    }
  }

  function openDelivery(proposal: Proposal) {
    const opportunity = opportunities.find((item) => item.id === proposal.opportunityId);
    const contacts = stakeholders.filter((item) => item.accountId === opportunity?.accountId);
    const preferred = contacts.find((item) => item.email) ?? contacts[0];
    setDeliveryProposal(proposal);
    setDeliveryChannel("email");
    setDeliveryStakeholder(preferred?.id ?? "");
    applyDeliveryTemplate("email", proposal, preferred);
    setDeliveryError("");
  }

  function changeDeliveryChannel(channel: "email" | "whatsapp") {
    if (!deliveryProposal) return;
    setDeliveryChannel(channel);
    const available = deliveryContacts.find((item) => channel === "email" ? item.email : item.phone);
    if (available) setDeliveryStakeholder(available.id);
    applyDeliveryTemplate(channel, deliveryProposal, available ?? selectedDeliveryContact);
  }

  function changeDeliveryStakeholder(id: string) {
    setDeliveryStakeholder(id);
    if (!deliveryProposal) return;
    const contact = deliveryContacts.find((item) => item.id === id);
    applyDeliveryTemplate(deliveryChannel, deliveryProposal, contact);
  }

  async function deliverProposal(event: React.FormEvent) {
    event.preventDefault();
    if (!deliveryProposal || !selectedDeliveryContact) return;
    const popup = deliveryChannel === "whatsapp" ? window.open("about:blank", "_blank") : null;
    setDelivering(true); setDeliveryError("");
    try {
      const endpoint = deliveryChannel === "email" ? "/api/communications/email" : "/api/communications/whatsapp";
      const payload = deliveryChannel === "email"
        ? { opportunityId: deliveryProposal.opportunityId, proposalId: deliveryProposal.id, stakeholderId: selectedDeliveryContact.id, templateKey: "propuesta", subject: deliverySubject, body: deliveryBody }
        : { proposalId: deliveryProposal.id, stakeholderId: selectedDeliveryContact.id, body: deliveryBody };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "No fue posible preparar el envío.");
      setDeliveries((items) => [mapCommunication({ ...result.communication, proposal_id: deliveryProposal.id }), ...items.filter((item) => item.id !== result.communication.id)]);
      await Promise.all([loadDeliveries(), refreshData()]);
      if (deliveryChannel === "whatsapp") {
        if (result.mode === "official") { if (popup) popup.close(); setToast("Propuesta enviada desde el WhatsApp Business oficial y registrada."); }
        else { if (popup) popup.location.href = result.whatsappUrl; else window.open(result.whatsappUrl, "_blank", "noopener,noreferrer"); setToast("Propuesta preparada y abierta en WhatsApp. El intento quedó registrado."); }
      } else setToast("Propuesta enviada por correo con el archivo adjunto y registrada en el historial.");
      setDeliveryProposal(undefined); setTimeout(() => setToast(""), 5000);
    } catch (error) {
      if (popup) popup.close();
      setDeliveryError(error instanceof Error ? error.message : "No fue posible realizar el envío.");
    } finally { setDelivering(false); }
  }

  return <>
    <PageHeader eyebrow="Plantilla corporativa bloqueada" title="Propuestas comerciales" description="Genera Word o PDF y conserva cada versión para seguir la negociación y sus variaciones de precio.">
      <button className="button button-primary" onClick={start}><Plus size={18}/> Generar propuesta</button>
    </PageHeader>

    <div className="card table-wrap">
      <table className="table proposal-history-table">
        <thead><tr><th>Cliente</th><th>Versión</th><th>Fecha</th><th>Honorarios</th><th>Variación vs. inicial</th><th>Motivo</th><th>Archivo</th><th>Envíos y reenvíos</th><th>Acción</th></tr></thead>
        <tbody>{orderedProposals.map((proposal) => {
          const versions = proposalHistory(proposals, proposal.opportunityId);
          const variation = proposal.monthlyFee - (versions[0]?.monthlyFee ?? proposal.monthlyFee);
          const attempts = deliveries.filter((item) => item.proposalId === proposal.id);
          return <tr key={proposal.id}>
            <td><strong>{proposal.clientName}</strong><small><History size={11}/> {versions.length} {versions.length === 1 ? "versión" : "versiones"}</small></td>
            <td><span className="version-badge">v{proposal.version}</span></td>
            <td>{new Date(`${proposal.issueDate}T12:00:00`).toLocaleDateString("es-DO")}</td>
            <td className="amount">{formatCurrency(proposal.monthlyFee)}</td>
            <td><span className={`price-variation ${variation < 0 ? "discount" : variation > 0 ? "increase" : "initial"}`}>{variationLabel(proposal, versions)}</span></td>
            <td>{proposal.changeReason || <span className="muted-copy">Primera propuesta</span>}</td>
            <td><span className="file-format"><FileText size={13}/>{proposal.fileFormat === "pdf" ? "PDF" : "Word"}</span><small>{proposal.status}</small></td>
            <td>{attempts.length === 0 ? <span className="muted-copy">Sin enviar</span> : <div className="proposal-deliveries">{attempts.map((attempt, index) => { const attemptNumber = attempts.length - index; return <span className={`proposal-delivery ${attempt.status === "failed" ? "failed" : ""}`} key={attempt.id}>{attempt.channel === "email" ? <Mail size={12}/> : <MessageCircle size={12}/>}<span><b>{attempt.channel === "email" ? "Correo" : "WhatsApp"}{attemptNumber > 1 ? ` · reenvío #${attemptNumber - 1}` : " · envío inicial"}</b><small><Clock3 size={10}/>{new Date(attempt.sentAt ?? attempt.createdAt).toLocaleString("es-DO")}</small></span></span>; })}</div>}</td>
            <td><button className="button compact" onClick={() => openDelivery(proposal)}><Send size={14}/>{attempts.length ? "Reenviar" : "Enviar"}</button></td>
          </tr>;
        })}</tbody>
      </table>
    </div>

    {open && <Modal title="Generar propuesta oficial" description="Elige el formato. Cada generación crea una nueva versión inalterable en el historial." onClose={() => setOpen(false)} wide>
      <div className="proposal-layout">
        <section className="proposal-form">
          <div className="form-grid">
            <label className="field field-wide"><span>Oportunidad</span><select value={opportunityId} onChange={(event) => selectOpportunity(event.target.value)}><option value="">Selecciona una cuenta</option>{opportunities.filter((item) => !["cliente_activo", "perdida"].includes(item.stage)).map((item) => <option value={item.id} key={item.id}>{accounts.find((candidate) => candidate.id === item.accountId)?.name}</option>)}</select></label>
            <label className="field"><span>Fecha</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label>
            <label className="field"><span>Honorarios mensuales</span><input type="number" min="1" value={fee} onChange={(event) => setFee(Number(event.target.value))}/></label>
          </div>

          <div className="format-section">
            <b>Formato de salida</b>
            <div className="format-picker">
              <label className={`format-option ${format === "pdf" ? "selected" : ""}`}><input type="radio" name="format" value="pdf" checked={format === "pdf"} onChange={() => setFormat("pdf")}/><FileText size={18}/><span><b>PDF</b><small>Listo para enviar</small></span></label>
              <label className={`format-option ${format === "docx" ? "selected" : ""}`}><input type="radio" name="format" value="docx" checked={format === "docx"} onChange={() => setFormat("docx")}/><FileText size={18}/><span><b>Word</b><small>Documento editable</small></span></label>
            </div>
          </div>

          {previous && <div className="negotiation-summary">
            <div><small>Monto inicial</small><b>{formatCurrency(initial.monthlyFee)}</b></div>
            <div><small>Última versión</small><b>{formatCurrency(previous.monthlyFee)}</b></div>
            <div><small>Nueva versión</small><b className={fee < initial.monthlyFee ? "discount-text" : ""}>{formatCurrency(fee)}</b></div>
          </div>}

          {priceChanged && <label className="field" style={{marginTop: 14}}><span>Motivo de la variación</span><textarea value={changeReason} onChange={(event) => setChangeReason(event.target.value)} required placeholder="Ej. Rebaja solicitada por la junta durante la negociación"/><small className="field-error">Este motivo quedará guardado en el historial comercial.</small></label>}

          {account && <>
            <div style={{display:"flex",alignItems:"center",gap:7,marginTop:18}}><Sparkles size={15} color="#f47721"/><b style={{fontSize:12}}>Referencias comparables sugeridas</b></div>
            <div className="reference-list">{suggestions.map((reference) => <label className="reference-option" key={reference.id}><input type="checkbox" checked={selected.includes(reference.id)} onChange={() => toggle(reference.id)}/><span><b>{reference.clientName}</b><small>{reference.units} unidades · {reference.location}</small></span><span className="match">{reference.score}%</span></label>)}</div>
            <small style={{color:selected.length === 3 ? "#1b8a5a" : "#c9364f"}}>{selected.length}/3 referencias seleccionadas</small>
          </>}

          <div className="form-actions"><button className="button" onClick={() => setOpen(false)}>Cancelar</button><button className="button button-primary" onClick={generate} disabled={!account || selected.length !== 3 || loading || (priceChanged && !changeReason.trim())}><Download size={17}/>{loading ? "Generando y guardando…" : `Generar ${format === "pdf" ? "PDF" : "Word"}`}</button></div>
        </section>

        <section className="proposal-preview"><div className="paper"><div className="paper-logo">⌂<br/>INDEX CONDO</div><h2>PROPUESTA DE ADMINISTRACIÓN<br/>DE EDIFICIOS Y CONDOMINIOS</h2><div className="orange">PLAN DE ADMINISTRACIÓN INTEGRAL</div><div className="paper-client">{account?.name || "Nombre del cliente"}</div><div className="paper-meta">Santo Domingo, República Dominicana<br/>{new Date(`${date}T12:00:00`).toLocaleDateString("es-DO", {day:"numeric",month:"long",year:"numeric"})}</div><div className="paper-sections"><div className="paper-line"/><div className="paper-line"/><div className="paper-line short"/><div className="paper-line"/><div className="paper-line short"/></div><div className="paper-price">{formatCurrency(fee)} / mes</div></div></section>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:7,marginTop:14,color:"#667085",fontSize:11}}><FileCheck2 size={15}/> El archivo maestro permanece sin cambios; cada propuesta se genera como una copia versionada.</div>
    </Modal>}
    {deliveryProposal && <Modal title={`${deliveries.some((item) => item.proposalId === deliveryProposal.id) ? "Reenviar" : "Enviar"} propuesta v${deliveryProposal.version}`} description={`El envío quedará vinculado a esta versión de ${deliveryProposal.clientName}.`} onClose={() => setDeliveryProposal(undefined)} wide>
      <form onSubmit={deliverProposal}>
        {deliveryError && <div className="sync-banner sync-error">{deliveryError}</div>}
        <div className="delivery-channel-picker">
          <button type="button" className={deliveryChannel === "email" ? "active" : ""} onClick={() => changeDeliveryChannel("email")}><Mail size={20}/><span><b>Correo</b><small>Archivo adjunto y estado de entrega</small></span></button>
          <button type="button" className={deliveryChannel === "whatsapp" ? "active" : ""} onClick={() => changeDeliveryChannel("whatsapp")}><MessageCircle size={20}/><span><b>WhatsApp</b><small>Mensaje y enlace privado por 7 días</small></span></button>
        </div>
        <div className="form-grid">
          <label className="field field-wide"><span>Contacto</span><select value={deliveryStakeholder} onChange={(event) => changeDeliveryStakeholder(event.target.value)} required><option value="">Selecciona un destinatario</option>{deliveryContacts.map((contact) => <option value={contact.id} key={contact.id} disabled={deliveryChannel === "email" ? !contact.email : !contact.phone}>{contact.fullName} · {deliveryChannel === "email" ? contact.email || "sin correo" : contact.phone || "sin teléfono"}</option>)}</select></label>
          {deliveryChannel === "email" && <label className="field field-wide"><span>Asunto</span><input value={deliverySubject} onChange={(event) => setDeliverySubject(event.target.value)} required/></label>}
          <label className="field field-wide"><span>Mensaje</span><textarea className="email-body" value={deliveryBody} onChange={(event) => setDeliveryBody(event.target.value)} required/></label>
          <div className="formal-note field-wide"><FileCheck2 size={16}/> Se enviará exactamente la versión {deliveryProposal.version} en {deliveryProposal.fileFormat === "pdf" ? "PDF" : "Word"}. Cada nuevo intento aparecerá por separado en el historial.</div>
          {deliveryChannel === "whatsapp" && <div className="whatsapp-disclosure field-wide"><MessageCircle size={16}/> El CRM abrirá WhatsApp con el mensaje listo. Se registrará la apertura del canal; la confirmación final depende de pulsar “Enviar” en WhatsApp.</div>}
        </div>
        <div className="form-actions"><button type="button" className="button" onClick={() => setDeliveryProposal(undefined)}>Cancelar</button><button className="button button-primary" disabled={delivering || !selectedDeliveryContact || (deliveryChannel === "email" ? !selectedDeliveryContact.email : !selectedDeliveryContact.phone)}><Send size={16}/>{delivering ? "Preparando…" : deliveryChannel === "email" ? "Enviar correo" : "Abrir WhatsApp"}</button></div>
      </form>
    </Modal>}
    {toast && <div className="toast">{toast}</div>}
  </>;
}