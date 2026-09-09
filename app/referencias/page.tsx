"use client";
import { Pencil, Plus, Star, ToggleLeft, ToggleRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useCrm } from "@/components/crm-provider";
import { Modal, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { mapReference } from "@/lib/supabase/mappers";
import type {
  CommercialReference,
  ProjectType,
  ResidentialSubtype,
} from "@/types/domain";

const emptyReference = (): CommercialReference => ({
  id: "",
  clientName: "",
  location: "",
  units: 1,
  accountType: "condominio_existente",
  projectType: "residencial",
  residentialSubtype: "apartamento",
  profile: "familiar",
  approved: true,
  active: true,
  preferred: false,
  priority: 50,
  incorporatedAt: new Date().toISOString().slice(0, 10),
  contactShareAuthorized: false,
});

export default function ReferenciasPage() {
  const { references, refreshData, currentUser } = useCrm();
  const [items, setItems] = useState(references);
  const [editing, setEditing] = useState<CommercialReference>();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const allowed = [
    "superadmin",
    "gerencia_comercial",
    "administracion",
  ].includes(currentUser.role);
  useEffect(() => setItems(references), [references]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const projectType = String(form.get("projectType")) as ProjectType;
    const subtype =
      projectType === "residencial"
        ? (String(form.get("residentialSubtype")) as ResidentialSubtype)
        : undefined;
    const custom =
      subtype === "otros"
        ? String(form.get("customUnitType") || "").trim()
        : undefined;
    if (subtype === "otros" && (custom?.length ?? 0) < 2) {
      setNotice("Indica el nombre de las unidades.");
      return;
    }
    const next: CommercialReference = {
      ...editing,
      id: editing.id || crypto.randomUUID(),
      clientName: String(form.get("clientName")).trim(),
      location: String(form.get("location")).trim(),
      units: Number(form.get("units")),
      accountType: String(
        form.get("accountType"),
      ) as CommercialReference["accountType"],
      projectType,
      residentialSubtype: subtype,
      customUnitType: custom,
      profile: String(form.get("profile") || ""),
      active: form.get("active") === "on",
      approved: form.get("active") === "on",
      preferred: form.get("preferred") === "on",
      priority: Number(form.get("priority")),
      incorporatedAt: String(form.get("incorporatedAt")),
      notes: String(form.get("notes") || "").trim() || undefined,
      contactShareAuthorized: form.get("contactShareAuthorized") === "on",
    };
    if (!next.clientName || !next.location || next.units < 1) {
      setNotice("Completa nombre, ubicación y cantidad.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const row = {
        id: next.id,
        client_name: next.clientName,
        location: next.location,
        units: next.units,
        account_type: next.accountType,
        project_type: next.projectType,
        residential_subtype: next.residentialSubtype ?? null,
        custom_unit_type: next.customUnitType ?? null,
        profile: next.profile,
        approved: next.active,
        active: next.active,
        preferred: next.preferred,
        priority: next.priority,
        incorporated_at: next.incorporatedAt,
        notes: next.notes ?? null,
        contact_share_authorized: next.contactShareAuthorized,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from("references_catalog")
        .upsert(row)
        .select("*")
        .single();
      if (error) {
        setNotice(error.message);
        setSaving(false);
        return;
      }
      setItems((current) => [
        mapReference(data),
        ...current.filter((item) => item.id !== next.id),
      ]);
      await refreshData();
    } else
      setItems((current) => [
        next,
        ...current.filter((item) => item.id !== next.id),
      ]);
    setSaving(false);
    setEditing(undefined);
    setNotice("Referencia guardada.");
  }
  async function toggle(item: CommercialReference) {
    const next = { ...item, active: !item.active, approved: !item.active };
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase
        .from("references_catalog")
        .update({
          active: next.active,
          approved: next.approved,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (error) {
        setNotice(error.message);
        return;
      }
    }
    setItems((current) =>
      current.map((value) => (value.id === item.id ? next : value)),
    );
    setNotice(
      next.active
        ? "Referencia activada."
        : "Referencia desactivada; seguirá en propuestas históricas.",
    );
  }
  if (!allowed)
    return (
      <div className="empty-state">
        <b>Acceso restringido</b>
        <p>
          Solo Administración y Gerencia pueden mantener las referencias
          comerciales.
        </p>
      </div>
    );
  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Referencias comerciales"
        description="Mantén un catálogo fresco. Las propuestas solo sugieren referencias activas y preservan una copia histórica."
      >
        <button
          className="button button-primary"
          onClick={() => setEditing(emptyReference())}
        >
          <Plus size={17} /> Nueva referencia
        </button>
      </PageHeader>
      {notice && <div className="sync-banner">{notice}</div>}
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Unidades/locales</th>
              <th>Ubicación</th>
              <th>Prioridad</th>
              <th>Incorporación</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items
              .sort(
                (a, b) =>
                  Number(b.preferred) - Number(a.preferred) ||
                  b.priority - a.priority ||
                  b.incorporatedAt.localeCompare(a.incorporatedAt),
              )
              .map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.clientName}</strong>
                    {item.preferred && (
                      <small>
                        <Star size={11} /> Preferida
                      </small>
                    )}
                  </td>
                  <td style={{ textTransform: "capitalize" }}>
                    {item.projectType}
                    <small>
                      {item.residentialSubtype === "otros"
                        ? item.customUnitType
                        : item.residentialSubtype}
                    </small>
                  </td>
                  <td>{item.units}</td>
                  <td>{item.location}</td>
                  <td>{item.priority}</td>
                  <td>
                    {new Date(
                      `${item.incorporatedAt}T12:00:00`,
                    ).toLocaleDateString("es-DO")}
                  </td>
                  <td>
                    <span
                      className={`status-pill ${item.active ? "status-active" : "status-inactive"}`}
                    >
                      {item.active ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="button compact"
                        onClick={() => setEditing(item)}
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <button
                        className="button compact"
                        onClick={() => void toggle(item)}
                      >
                        {item.active ? (
                          <ToggleRight size={16} />
                        ) : (
                          <ToggleLeft size={16} />
                        )}{" "}
                        {item.active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <ReferenceModal
          value={editing}
          saving={saving}
          onClose={() => setEditing(undefined)}
          onSubmit={save}
        />
      )}
    </>
  );
}

function ReferenceModal({
  value,
  saving,
  onClose,
  onSubmit,
}: {
  value: CommercialReference;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [type, setType] = useState(value.projectType);
  const [subtype, setSubtype] = useState(
    value.residentialSubtype ?? "apartamento",
  );
  return (
    <Modal
      title={value.id ? "Editar referencia" : "Nueva referencia"}
      description="La prioridad y recencia influyen en las tres sugerencias automáticas."
      onClose={onClose}
      wide
    >
      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <Field
            name="clientName"
            label="Cliente / proyecto"
            value={value.clientName}
          />
          <Field name="location" label="Ubicación" value={value.location} />
          <label className="field">
            <span>Tipo de proyecto</span>
            <select
              name="projectType"
              value={type}
              onChange={(event) => setType(event.target.value as ProjectType)}
            >
              <option value="comercial">Comercial</option>
              <option value="residencial">Residencial</option>
            </select>
          </label>
          {type === "residencial" && (
            <label className="field">
              <span>Subtipo</span>
              <select
                name="residentialSubtype"
                value={subtype}
                onChange={(event) =>
                  setSubtype(event.target.value as ResidentialSubtype)
                }
              >
                <option value="apartamento">Apartamentos</option>
                <option value="casa">Casas</option>
                <option value="otros">Otros</option>
              </select>
            </label>
          )}
          {type === "residencial" && subtype === "otros" && (
            <Field
              name="customUnitType"
              label="Nombre de las unidades"
              value={value.customUnitType ?? ""}
            />
          )}
          <label className="field">
            <span>Segmento</span>
            <select name="accountType" defaultValue={value.accountType}>
              <option value="condominio_existente">Condominio existente</option>
              <option value="torre_residencial">Torre residencial</option>
              <option value="proyecto_nuevo">Proyecto nuevo</option>
              <option value="constructora">Constructora</option>
              <option value="desarrollador">Desarrollador</option>
              <option value="aliado">Aliado</option>
            </select>
          </label>
          <Field
            name="units"
            label={
              type === "comercial"
                ? "Cantidad de locales"
                : "Cantidad de unidades"
            }
            value={String(value.units)}
            type="number"
          />
          <Field name="profile" label="Perfil" value={value.profile} />
          <Field
            name="priority"
            label="Prioridad (0–100)"
            value={String(value.priority)}
            type="number"
          />
          <Field
            name="incorporatedAt"
            label="Fecha de incorporación"
            value={value.incorporatedAt}
            type="date"
          />
          <label className="field field-wide">
            <span>Observaciones</span>
            <textarea name="notes" defaultValue={value.notes} />
          </label>
          <label className="check-field">
            <input
              name="active"
              type="checkbox"
              defaultChecked={value.active}
            />{" "}
            Activa
          </label>
          <label className="check-field">
            <input
              name="preferred"
              type="checkbox"
              defaultChecked={value.preferred}
            />{" "}
            Preferida
          </label>
          <label className="check-field field-wide">
            <input
              name="contactShareAuthorized"
              type="checkbox"
              defaultChecked={value.contactShareAuthorized}
            />{" "}
            Permite compartir contacto
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button button-primary" disabled={saving}>
            {saving ? "Guardando…" : "Guardar referencia"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Field({
  name,
  label,
  value,
  type = "text",
}: {
  name: string;
  label: string;
  value: string;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={value}
        min={type === "number" ? 0 : undefined}
        required
      />
    </label>
  );
}
