"use client";

import { Download, FileCheck2, FileText, Mail, MessageCircle, Plus, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCrm } from "@/components/crm-provider";
import { Modal } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { mapClientDocument } from "@/lib/supabase/mappers";
import type { ClientDocument, ClientDocumentTemplateKey, Stakeholder } from "@/types/domain";

const templateLabels: Record<ClientDocumentTemplateKey, { title: string; description: string }> = {
  onboarding_30_60_90: { title: "Plan de Onboarding 30-60-90", description: "Plan personalizado para la transición e implementación de la administración." },
  document_request: { title: "Solicitud de documentos", description: "Carta formal con destinatario, referencia, ubicación y plazo de entrega." }
};

function defaultMessage(document: ClientDocument, contact?: Stakeholder) {
  const clientName = String(document.dataSnapshot.clientName ?? "su condominio");
  const greeting = contact?.fullName ? `Estimado/a ${contact.fullName}` : "Estimados señores";
  return `${greeting},\n\nReciban un cordial saludo. Hemos preparado para ${clientName} el documento “${document.title}”, personalizado con la información de su gestión.\n\nLo compartimos para su revisión y para facilitar los próximos pasos de manera clara y organizada. Quedamos atentos a cualquier consulta o apoyo que necesiten.\n\nCordialmente,\nEquipo INDEX CONDO`;
}

export function ClientDocumentsPanel() {
  const { opportunities, accounts, stakeholders, currentUser } = useCrm();
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [open, setOpen] = useState(false);
  const [templateKey, setTemplateKey] = useState<ClientDocumentTemplateKey>("onboarding_30_60_90");
  const [opportunityId, setOpportunityId] = useState("");
  const [stakeholderId, setStakeholderId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [onboardingDate, setOnboardingDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("Santo Domingo, Distrito Nacional");
  const [accountManager, setAccountManager] = useState(currentUser.fullName);
  const [reference, setReference] = useState("");
  const [deadlineDays, setDeadlineDays] = useState(10);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [deliveryDocument, setDeliveryDocument] = useState<ClientDocument>();
  const [deliveryChannel, setDeliveryChannel] = useState<"email" | "whatsapp">("email");
  const [deliveryStakeholder, setDeliveryStakeholder] = useState("");
  const [deliverySubject, setDeliverySubject] = useState("");
  const [deliveryBody, setDeliveryBody] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [delivering, setDelivering] = useState(false);

  const loadDocuments = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    const { data } = await supabase.from("client_documents").select("*").order("generated_at", { ascending: false });
    setDocuments((data ?? []).map((row) => mapClientDocument(row)));
  }, []);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  const opportunity = opportunities.find((item) => item.id === opportunityId);
  const account = accounts.find((item) => item.id === opportunity?.accountId);
  const contacts = stakeholders.filter((item) => item.accountId === account?.id);
  const deliveryOpportunity = opportunities.find((item) => item.id === deliveryDocument?.opportunityId);
  const deliveryContacts = stakeholders.filter((item) => item.accountId === deliveryOpportunity?.accountId);
  const selectedDeliveryContact = deliveryContacts.find((item) => item.id === deliveryStakeholder);
  const orderedOpportunities = useMemo(() => opportunities.filter((item) => item.stage !== "perdida"), [opportunities]);

  function openGenerator(key: ClientDocumentTemplateKey) {
    const candidate = orderedOpportunities.find((item) => item.stage === "cliente_activo") ?? orderedOpportunities[0];
    setTemplateKey(key);
    selectOpportunity(candidate?.id ?? "");
    setAccountManager(currentUser.fullName);
    setReference("");
    setOpen(true);
  }

  function selectOpportunity(id: string) {
    setOpportunityId(id);
    const selectedOpportunity = opportunities.find((item) => item.id === id);
    const selectedAccount = accounts.find((item) => item.id === selectedOpportunity?.accountId);
    const selectedContacts = stakeholders.filter((item) => item.accountId === selectedAccount?.id);
    const preferred = selectedContacts.find((item) => item.isDecisionMaker) ?? selectedContacts[0];
    setStakeholderId(preferred?.id ?? "");
    const parts = [selectedAccount?.sector, selectedAccount?.city].filter(Boolean);
    setLocation(parts.join(", ") || selectedAccount?.address || "Santo Domingo, Distrito Nacional");
  }

  async function generate() {
    if (!opportunityId || !account || !location.trim() || !accountManager.trim()) return;
    setLoading(true);
    try {
      const response = await fetch("/api/client-documents/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, stakeholderId: stakeholderId || undefined, templateKey, issueDate, onboardingDate, location, accountManager, reference: reference || undefined, deadlineDays })
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? "No fue posible generar el documento.");
      }
      const blob = await response.blob();
      const fileName = decodeURIComponent(response.headers.get("X-Client-Document-Name") || `${templateKey}-${account.name}.pdf`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url);
      await loadDocuments();
      setOpen(false);
      setToast("Documento personalizado generado, guardado y descargado correctamente.");
      setTimeout(() => setToast(""), 5000);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "No fue posible generar el documento.");
      setTimeout(() => setToast(""), 6000);
    } finally { setLoading(false); }
  }

  function openDelivery(document: ClientDocument) {
    const opp = opportunities.find((item) => item.id === document.opportunityId);
    const available = stakeholders.filter((item) => item.accountId === opp?.accountId);
    const preferred = available.find((item) => item.email) ?? available[0];
    setDeliveryDocument(document); setDeliveryChannel("email"); setDeliveryStakeholder(preferred?.id ?? "");
    setDeliverySubject(`${document.title} — ${String(document.dataSnapshot.clientName ?? "INDEX CONDO")}`);
    setDeliveryBody(defaultMessage(document, preferred)); setDeliveryError("");
  }

  function changeDeliveryChannel(channel: "email" | "whatsapp") {
    if (!deliveryDocument) return;
    const contact = deliveryContacts.find((item) => channel === "email" ? item.email : item.phone) ?? deliveryContacts[0];
    setDeliveryChannel(channel); setDeliveryStakeholder(contact?.id ?? ""); setDeliveryBody(defaultMessage(deliveryDocument, contact));
  }

  async function deliver(event: React.FormEvent) {
    event.preventDefault();
    if (!deliveryDocument || !selectedDeliveryContact) return;
    const popup = deliveryChannel === "whatsapp" ? window.open("about:blank", "_blank") : null;
    setDelivering(true); setDeliveryError("");
    try {
      const response = await fetch(`/api/client-documents/${deliveryChannel}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: deliveryDocument.id, stakeholderId: selectedDeliveryContact.id, subject: deliverySubject, body: deliveryBody })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "No fue posible enviar el documento.");
      if (deliveryChannel === "whatsapp") {
        if (result.whatsappUrl) { if (popup) popup.location.href = result.whatsappUrl; else window.open(result.whatsappUrl, "_blank", "noopener,noreferrer"); }
        else if (popup) popup.close();
      }
      await loadDocuments(); setDeliveryDocument(undefined);
      setToast(deliveryChannel === "email" ? "Documento enviado por correo y registrado en Comunicaciones." : "Documento preparado en WhatsApp y registrado en Comunicaciones.");
      setTimeout(() => setToast(""), 5000);
    } catch (error) {
      if (popup) popup.close();
      setDeliveryError(error instanceof Error ? error.message : "No fue posible realizar el envío.");
    } finally { setDelivering(false); }
  }

  return <section style={{ display: "grid", gap: 18, marginBottom: 24 }}>
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
        <div><div className="eyebrow">Documentos personalizados</div><h2 style={{ margin: "5px 0 4px" }}>Acompañamiento al cliente</h2><p style={{ margin: 0, color: "var(--muted, #667085)" }}>Genera, descarga e imprime PDFs con los datos reales del cliente, o envíalos desde el CRM.</p></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 18 }}>
        {(Object.keys(templateLabels) as ClientDocumentTemplateKey[]).map((key) => <article key={key} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18, display: "grid", gap: 10 }}>
          <FileText size={24} color="#f47721"/><div><b>{templateLabels[key].title}</b><p style={{ margin: "6px 0 0", color: "#667085", fontSize: 13 }}>{templateLabels[key].description}</p></div>
          <button className="button button-primary" onClick={() => openGenerator(key)}><Plus size={16}/> Generar personalizado</button>
        </article>)}
      </div>
    </div>

    {documents.length > 0 && <div className="card table-wrap"><table className="table"><thead><tr><th>Documento</th><th>Cliente</th><th>Generado</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{documents.map((document) => {
      const opp = opportunities.find((item) => item.id === document.opportunityId);
      const acc = accounts.find((item) => item.id === opp?.accountId);
      return <tr key={document.id}><td><strong>{document.title}</strong><small>{document.fileName}</small></td><td>{acc?.name ?? String(document.dataSnapshot.clientName ?? "Cliente")}</td><td>{new Date(document.generatedAt).toLocaleString("es-DO")}</td><td><span className="file-format"><FileCheck2 size={13}/>{document.status === "sent" ? "Enviado" : "Generado"}</span></td><td><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><a className="button compact" href={`/api/client-documents/download?id=${document.id}`}><Download size={14}/> Descargar</a><button className="button compact" onClick={() => openDelivery(document)}><Send size={14}/> Enviar</button></div></td></tr>;
    })}</tbody></table></div>}

    {open && <Modal title={`Generar ${templateLabels[templateKey].title}`} description="Los datos quedan aplicados al PDF y guardados en el expediente del cliente." onClose={() => setOpen(false)} wide>
      <div className="form-grid">
        <label className="field field-wide"><span>Cliente / oportunidad</span><select aria-label="Cliente u oportunidad" value={opportunityId} onChange={(event) => selectOpportunity(event.target.value)} required><option value="">Selecciona un cliente</option>{orderedOpportunities.map((item) => <option key={item.id} value={item.id}>{accounts.find((candidate) => candidate.id === item.accountId)?.name ?? "Cuenta"}</option>)}</select></label>
        <label className="field field-wide"><span>Destinatario o enlace del cliente</span><select aria-label="Destinatario o enlace del cliente" value={stakeholderId} onChange={(event) => setStakeholderId(event.target.value)}><option value="">Consejo de Administración / Condóminos</option>{contacts.map((contact) => <option value={contact.id} key={contact.id}>{contact.fullName} · {contact.role}</option>)}</select></label>
        <label className="field"><span>Fecha del documento</span><input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} required/></label>
        {templateKey === "onboarding_30_60_90" && <label className="field"><span>Fecha de ingreso</span><input type="date" value={onboardingDate} onChange={(event) => setOnboardingDate(event.target.value)} required/></label>}
        <label className="field field-wide"><span>Ubicación</span><input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={180} required/></label>
        <label className="field field-wide"><span>Gerente de cuenta</span><input value={accountManager} onChange={(event) => setAccountManager(event.target.value)} maxLength={120} required/></label>
        {templateKey === "document_request" && <><label className="field"><span>Referencia (opcional)</span><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Se genera automáticamente" maxLength={40}/></label><label className="field"><span>Plazo de entrega (días)</span><input type="number" min="1" max="60" value={deadlineDays} onChange={(event) => setDeadlineDays(Number(event.target.value))}/></label></>}
      </div>
      <div className="formal-note" style={{ marginTop: 16 }}><FileCheck2 size={16}/> El PDF se genera del lado servidor y la plantilla original permanece bloqueada.</div>
      <div className="form-actions"><button className="button" onClick={() => setOpen(false)}>Cancelar</button><button className="button button-primary" onClick={generate} disabled={loading || !opportunityId || !location.trim() || !accountManager.trim()}><Download size={16}/>{loading ? " Generando…" : " Generar y descargar PDF"}</button></div>
    </Modal>}

    {deliveryDocument && <Modal title={`Enviar ${deliveryDocument.title}`} description="El envío quedará registrado en el módulo de Comunicaciones." onClose={() => setDeliveryDocument(undefined)} wide>
      <form onSubmit={deliver}>
        {deliveryError && <div className="sync-banner sync-error">{deliveryError}</div>}
        <div className="delivery-channel-picker"><button type="button" className={deliveryChannel === "email" ? "active" : ""} onClick={() => changeDeliveryChannel("email")}><Mail size={20}/><span><b>Correo</b><small>PDF adjunto</small></span></button><button type="button" className={deliveryChannel === "whatsapp" ? "active" : ""} onClick={() => changeDeliveryChannel("whatsapp")}><MessageCircle size={20}/><span><b>WhatsApp</b><small>PDF o enlace privado por 7 días</small></span></button></div>
        <div className="form-grid"><label className="field field-wide"><span>Contacto</span><select value={deliveryStakeholder} onChange={(event) => { setDeliveryStakeholder(event.target.value); const contact = deliveryContacts.find((item) => item.id === event.target.value); setDeliveryBody(defaultMessage(deliveryDocument, contact)); }} required><option value="">Selecciona un destinatario</option>{deliveryContacts.map((contact) => <option value={contact.id} key={contact.id} disabled={deliveryChannel === "email" ? !contact.email : !contact.phone}>{contact.fullName} · {deliveryChannel === "email" ? contact.email || "sin correo" : contact.phone || "sin teléfono"}</option>)}</select></label>{deliveryChannel === "email" && <label className="field field-wide"><span>Asunto</span><input value={deliverySubject} onChange={(event) => setDeliverySubject(event.target.value)} required/></label>}<label className="field field-wide"><span>Mensaje</span><textarea className="email-body" value={deliveryBody} onChange={(event) => setDeliveryBody(event.target.value)} required/></label></div>
        <div className="form-actions"><button type="button" className="button" onClick={() => setDeliveryDocument(undefined)}>Cancelar</button><button className="button button-primary" disabled={delivering || !selectedDeliveryContact || (deliveryChannel === "email" ? !selectedDeliveryContact.email : !selectedDeliveryContact.phone)}><Send size={16}/>{delivering ? "Preparando…" : deliveryChannel === "email" ? "Enviar correo" : "Abrir WhatsApp"}</button></div>
      </form>
    </Modal>}
    {toast && <div className="toast">{toast}</div>}
  </section>;
}
