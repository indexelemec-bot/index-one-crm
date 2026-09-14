"use client";

import { Download, FileSignature, History, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCrm } from "@/components/crm-provider";
import { Modal, PageHeader } from "@/components/ui";
import { formatCurrency } from "@/lib/constants";
import { dominicanPesosInWords } from "@/lib/spanish-number";
import { createClient } from "@/lib/supabase/client";

type ContractRow = {
  id: string; opportunity_id: string; account_id: string; status: string; client_legal_name: string;
  client_rnc?: string; client_address?: string; representative_name: string; representative_id?: string;
  effective_date?: string; signature_date?: string; expiration_date?: string; current_version: number; updated_at: string;
};
type VersionRow = { id: string; contract_id: string; version: number; monthly_fee: number; change_reason: string; negotiated_terms?: string; generated_at: string };
const statusLabels: Record<string, string> = { borrador: "Borrador", revision_cliente: "En revisión", aprobado: "Aprobado", enviado: "Enviado", firmado: "Firmado", activo: "Activo", vencido: "Vencido", cancelado: "Cancelado" };

export default function ContratosPage() {
  const { accounts, opportunities, stakeholders } = useCrm();
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [open, setOpen] = useState(false);
  const [opportunityId, setOpportunityId] = useState("");
  const [feePreview, setFeePreview] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient(); if (!supabase) return;
    const [{ data: contractData }, { data: versionData }] = await Promise.all([
      supabase.from("contracts").select("*").order("updated_at", { ascending: false }),
      supabase.from("contract_versions").select("*").order("version", { ascending: false }),
    ]);
    setContracts((contractData ?? []) as ContractRow[]); setVersions((versionData ?? []) as VersionRow[]);
  }, []);

  useEffect(() => {
    void load();
    const incoming = new URLSearchParams(window.location.search).get("nueva");
    if (incoming) { setOpportunityId(incoming); setOpen(true); }
  }, [load]);

  const opportunity = opportunities.find((item) => item.id === opportunityId);
  const account = accounts.find((item) => item.id === opportunity?.accountId);
  const representative = stakeholders.find((item) => item.accountId === account?.id && item.isDecisionMaker) ?? stakeholders.find((item) => item.accountId === account?.id);
  const currentContract = contracts.find((item) => item.opportunity_id === opportunityId);
  const currentVersions = useMemo(() => versions.filter((item) => item.contract_id === currentContract?.id), [versions, currentContract]);
  const defaultFee = Number(currentVersions[0]?.monthly_fee ?? opportunity?.monthlyFee ?? 0);

  useEffect(() => { setFeePreview(defaultFee); }, [defaultFee, opportunityId]);

  function start() {
    const next = opportunities.find((item) => ["aprobacion", "contrato_transicion"].includes(item.stage)) ?? opportunities.find((item) => !["cliente_activo", "perdida"].includes(item.stage));
    setOpportunityId(next?.id ?? ""); setOpen(true); setError("");
  }

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const body = {
      opportunityId, clientLegalName: String(form.get("clientLegalName")), clientRnc: String(form.get("clientRnc")),
      clientAddress: String(form.get("clientAddress")), city: String(form.get("city")), sector: String(form.get("sector")),
      representativeName: String(form.get("representativeName")), representativeId: String(form.get("representativeId")),
      representativeGenderEnding: String(form.get("representativeGenderEnding")), assemblyDate: String(form.get("assemblyDate")),
      monthlyFee: Number(form.get("monthlyFee")), signatureDate: String(form.get("signatureDate")),
      changeReason: String(form.get("changeReason")), negotiatedTerms: String(form.get("negotiatedTerms") || ""),
    };
    const response = await fetch("/api/contracts/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({})); setSaving(false);
    if (!response.ok) { setError(result.error ?? "No fue posible generar el contrato."); return; }
    await load(); setOpen(false); setToast(`Contrato v${result.version} generado. Firma y notarización usan la misma fecha.`);
    if (result.signedUrl) window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => setToast(""), 5000);
  }

  async function download(versionId: string) {
    const response = await fetch("/api/contracts/download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ versionId }) });
    const result = await response.json(); if (response.ok) window.open(result.signedUrl, "_blank", "noopener,noreferrer"); else setToast(result.error);
  }

  return <>
    <PageHeader eyebrow="Cierre y formalización" title="Contratos" description="Genera copias del modelo corporativo, conserva cada negociación y consulta firma, vigencia, estado y versiones."><button className="button button-primary" onClick={start}><Plus size={18}/> Generar contrato</button></PageHeader>
    {toast && <div className="toast">{toast}</div>}
    <div className="card table-wrap"><table className="table"><thead><tr><th>Cliente</th><th>Estado</th><th>Versión</th><th>Representante</th><th>Firma / notarización</th><th>Vencimiento</th><th>Historial y archivos</th></tr></thead><tbody>{contracts.map((contract) => { const history = versions.filter((item) => item.contract_id === contract.id); return <tr key={contract.id}><td><strong>{contract.client_legal_name}</strong><small>{accounts.find((item) => item.id === contract.account_id)?.name}</small></td><td><span className="status-pill">{statusLabels[contract.status] ?? contract.status}</span></td><td><span className="version-badge">v{contract.current_version}</span></td><td>{contract.representative_name}</td><td>{contract.signature_date ? new Date(`${contract.signature_date}T12:00:00`).toLocaleDateString("es-DO") : "Pendiente"}</td><td>{contract.expiration_date ? new Date(`${contract.expiration_date}T12:00:00`).toLocaleDateString("es-DO") : "Pendiente"}</td><td><div className="contract-version-list">{history.map((version) => <button className="button compact" onClick={() => download(version.id)} key={version.id}><Download size={13}/>v{version.version} · {formatCurrency(Number(version.monthly_fee))}<small>{version.change_reason}</small></button>)}</div></td></tr>; })}</tbody></table>{contracts.length === 0 && <div className="empty-state"><FileSignature size={30}/><b>Aún no hay contratos</b><p>Genera el primero desde una oportunidad aprobada. El documento maestro nunca se sobrescribe.</p></div>}</div>
    {open && <Modal title={currentContract ? `Nueva versión del contrato · v${currentContract.current_version + 1}` : "Generar contrato desde el modelo oficial"} description="Selecciona el cliente: completamos la información disponible y solo quedan pendientes los datos que faltan." onClose={() => setOpen(false)} wide>
      <form key={`${opportunityId}-${currentContract?.id ?? "new"}`} onSubmit={generate}>{error && <div className="sync-banner sync-error">{error}</div>}<div className="form-grid">
        <label className="field field-wide"><span>Oportunidad</span><select value={opportunityId} onChange={(event) => { setOpportunityId(event.target.value); setError(""); }} required><option value="">Selecciona</option>{opportunities.filter((item) => item.stage !== "perdida").map((item) => <option value={item.id} key={item.id}>{accounts.find((candidate) => candidate.id === item.accountId)?.name}</option>)}</select></label>
        <label className="field field-wide"><span>Razón social del consorcio</span><input name="clientLegalName" defaultValue={currentContract?.client_legal_name ?? account?.name ?? ""} required/></label>
        <label className="field"><span>RNC</span><input name="clientRnc" defaultValue={currentContract?.client_rnc ?? ""} placeholder="Completar si no está registrado" required/></label>
        <label className="field"><span>Cédula del representante</span><input name="representativeId" defaultValue={currentContract?.representative_id ?? ""} placeholder="Completar si no está registrada" required/></label>
        <label className="field field-wide"><span>Dirección legal</span><input name="clientAddress" defaultValue={currentContract?.client_address ?? account?.address ?? ""} required/></label>
        <label className="field"><span>Provincia / municipio</span><input name="city" defaultValue={account?.city || "DISTRITO NACIONAL"} required/></label>
        <label className="field"><span>Sector</span><input name="sector" defaultValue={account?.sector ?? ""} required/></label>
        <label className="field"><span>Representante / presidente</span><input name="representativeName" defaultValue={currentContract?.representative_name ?? representative?.fullName ?? ""} required/></label>
        <label className="field"><span>Nacionalidad</span><select name="representativeGenderEnding"><option value="o">Dominicano</option><option value="a">Dominicana</option></select></label>
        <label className="field"><span>Fecha de asamblea</span><input name="assemblyDate" type="date" required/></label>
        <label className="field"><span>Fecha de firma y notarización</span><input name="signatureDate" type="date" defaultValue={currentContract?.signature_date ?? new Date().toISOString().slice(0, 10)} required/></label>
        <label className="field"><span>Honorarios mensuales</span><input name="monthlyFee" type="number" min="1" step="0.01" defaultValue={defaultFee || undefined} onChange={(event) => setFeePreview(Number(event.target.value))} required/></label>
        <label className="field"><span>Honorarios en letras (automático)</span><input value={feePreview > 0 ? dominicanPesosInWords(feePreview) : ""} readOnly aria-readonly="true"/></label>
        <label className="field field-wide"><span>Motivo de esta versión</span><input name="changeReason" defaultValue={currentContract ? "Cambios solicitados durante la negociación" : "Versión inicial para revisión"} required/></label>
        <label className="field field-wide"><span>Condiciones negociadas / observaciones</span><textarea name="negotiatedTerms" placeholder="Registra aquí toda cláusula solicitada. Se conserva en el historial para revisión legal antes de incorporarla al texto."/></label>
      </div><div className="formal-note"><History size={16}/>Los honorarios en letras y la fecha legal se generan desde los valores numéricos seleccionados; no se duplican manualmente.</div><div className="form-actions"><button type="button" className="button" onClick={() => setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? "Generando y almacenando…" : "Generar Word versionado"}</button></div></form>
    </Modal>}
  </>;
}
