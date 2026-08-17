import type { Account, Opportunity, Stakeholder, UserProfile } from "@/types/domain";

export type ProspectImportRow = {
  accountName: string;
  contactName: string;
  phone: string;
  email: string;
  sector: string;
  accountType: Account["accountType"];
  units: number;
  primaryProblem: string;
  stage: Opportunity["stage"];
  monthlyFee: number;
  source: string;
  nextAction: string;
  nextActionAt: string;
  notes: string;
};

export type ProspectImportPreview = ProspectImportRow & {
  rowNumber: number;
  duplicate: boolean;
  errors: string[];
};

const HEADER_ALIASES: Record<keyof ProspectImportRow, string[]> = {
  accountName: ["prospecto", "cuenta", "cliente potencial", "condominio", "proyecto", "nombre del prospecto", "nombre de cuenta"],
  contactName: ["contacto", "decisor", "nombre del contacto", "contacto principal"],
  phone: ["telefono", "teléfono", "whatsapp", "celular", "movil", "móvil"],
  email: ["email", "correo", "correo electronico", "correo electrónico"],
  sector: ["sector", "ubicacion", "ubicación"],
  accountType: ["segmento", "tipo", "tipo de cuenta"],
  units: ["unidades", "cantidad de unidades", "apartamentos"],
  primaryProblem: ["necesidad", "necesidad principal", "problema", "requerimiento"],
  stage: ["etapa", "etapa comercial"],
  monthlyFee: ["honorarios", "valor mensual", "honorarios prospectados", "monto"],
  source: ["origen", "fuente", "fuente del prospecto", "origen del lead"],
  nextAction: ["proxima accion", "próxima acción", "seguimiento", "proximo paso", "próximo paso"],
  nextActionAt: ["fecha proxima accion", "fecha próxima acción", "fecha seguimiento", "proxima fecha", "próxima fecha"],
  notes: ["notas", "observaciones", "comentarios"]
};

function norm(value: unknown) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function numberValue(value: unknown) {
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeType(value: unknown): Account["accountType"] {
  const v = norm(value);
  if (v.includes("torre")) return "torre_residencial";
  if (v.includes("proyecto")) return "proyecto_nuevo";
  if (v.includes("construct")) return "constructora";
  if (v.includes("desarroll")) return "desarrollador";
  if (v.includes("aliad")) return "aliado";
  return "condominio_existente";
}

function normalizeStage(value: unknown): Opportunity["stage"] {
  const v = norm(value);
  const stages: Array<[string, Opportunity["stage"]]> = [
    ["problema", "problema_detectado"], ["contacto", "contacto_decisor"], ["diagnost", "diagnostico"],
    ["solucion", "solucion_recomendada"], ["present", "presentacion"], ["propuesta", "propuesta"],
    ["negoci", "negociacion"], ["aprob", "aprobacion"], ["contrato", "contrato_transicion"],
    ["cliente", "cliente_activo"], ["perdid", "perdida"]
  ];
  return stages.find(([needle]) => v.includes(needle))?.[1] ?? "prospecto_identificado";
}

function normalizeDate(value: unknown) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { cells.push(cell); cell = ""; }
    else cell += char;
  }
  cells.push(cell);
  return cells;
}

function csvRows(text: string): unknown[][] {
  return text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean).map(splitCsvLine);
}

export async function readProspectFile(file: File): Promise<unknown[][]> {
  if (file.name.toLowerCase().endsWith(".csv")) return csvRows(await file.text());
  const module = await import("read-excel-file/browser");
  return module.readSheet(file) as Promise<unknown[][]>;
}

function findColumn(headers: unknown[], aliases: string[]) {
  const normalized = headers.map(norm);
  return normalized.findIndex((header) => aliases.some((alias) => header === norm(alias)));
}

export function buildImportPreview(rows: unknown[][], accounts: Account[], stakeholders: Stakeholder[]): ProspectImportPreview[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  const indexes = Object.fromEntries(Object.entries(HEADER_ALIASES).map(([key, aliases]) => [key, findColumn(headers, aliases)])) as Record<keyof ProspectImportRow, number>;
  const get = (row: unknown[], key: keyof ProspectImportRow) => indexes[key] >= 0 ? row[indexes[key]] : "";
  const existingNames = new Set(accounts.map((item) => norm(item.name)));
  const existingPhones = new Set(stakeholders.map((item) => norm(item.phone)).filter(Boolean));
  const existingEmails = new Set(stakeholders.map((item) => norm(item.email)).filter(Boolean));

  return rows.slice(1).filter((row) => row.some((cell) => String(cell ?? "").trim())).map((row, index) => {
    const accountName = String(get(row, "accountName") ?? "").trim();
    const contactName = String(get(row, "contactName") ?? "").trim();
    const phone = String(get(row, "phone") ?? "").trim();
    const email = String(get(row, "email") ?? "").trim();
    const duplicate = existingNames.has(norm(accountName)) || Boolean(phone && existingPhones.has(norm(phone))) || Boolean(email && existingEmails.has(norm(email)));
    const errors: string[] = [];
    if (accountName.length < 2) errors.push("Falta nombre del prospecto");
    if (contactName.length < 2) errors.push("Falta contacto principal");
    if (!phone && !email) errors.push("Falta teléfono o correo");
    const nextActionAt = normalizeDate(get(row, "nextActionAt"));
    return {
      rowNumber: index + 2,
      accountName, contactName, phone, email,
      sector: String(get(row, "sector") ?? "").trim(),
      accountType: normalizeType(get(row, "accountType")),
      units: Math.max(0, Math.round(numberValue(get(row, "units")))),
      primaryProblem: String(get(row, "primaryProblem") ?? "Pendiente de diagnóstico").trim() || "Pendiente de diagnóstico",
      stage: normalizeStage(get(row, "stage")),
      monthlyFee: Math.max(0, numberValue(get(row, "monthlyFee"))),
      source: String(get(row, "source") ?? "Carga masiva").trim() || "Carga masiva",
      nextAction: String(get(row, "nextAction") ?? "Contactar al prospecto").trim() || "Contactar al prospecto",
      nextActionAt: nextActionAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      notes: String(get(row, "notes") ?? "").trim(),
      duplicate,
      errors
    };
  });
}

const EXPORT_HEADERS = ["Prospecto", "Contacto", "Teléfono", "Correo", "Sector", "Segmento", "Unidades", "Necesidad principal", "Etapa", "Probabilidad", "Honorarios prospectados", "Origen", "Ejecutivo", "Próxima acción", "Fecha próxima acción"];

export async function exportProspectsToExcel(items: Array<{ account: Account; stakeholder?: Stakeholder; opportunity?: Opportunity; owner?: UserProfile }>) {
  const { writeXlsxFile } = await import("write-excel-file/browser");
  const header = EXPORT_HEADERS.map((value) => ({ value, fontWeight: "bold" as const, backgroundColor: "#F3F4F6" }));
  const data = [header, ...items.map(({ account, stakeholder, opportunity, owner }) => [
    account.name, stakeholder?.fullName ?? "", stakeholder?.phone ?? "", stakeholder?.email ?? "", account.sector,
    account.accountType, account.units, opportunity?.primaryProblem ?? "", opportunity?.stage ?? "", opportunity?.probability ?? 0,
    opportunity?.monthlyFee ?? 0, account.source, owner?.fullName ?? "", opportunity?.nextAction ?? "", opportunity?.nextActionAt ? new Date(opportunity.nextActionAt) : ""
  ].map((value) => ({ value })) )];
  const stamp = new Date().toISOString().slice(0, 10);
  await writeXlsxFile(data, { fileName: `INDEX_ONE_Prospectos_${stamp}.xlsx`, columns: EXPORT_HEADERS.map((_, index) => ({ width: index === 0 || index === 7 || index === 13 ? 28 : 18 })) });
}

export async function downloadProspectTemplate() {
  const { writeXlsxFile } = await import("write-excel-file/browser");
  const rows = [
    EXPORT_HEADERS.map((value) => ({ value, fontWeight: "bold" as const, backgroundColor: "#F3F4F6" })),
    ["Torre Ejemplo", "María Pérez", "8095551234", "maria@ejemplo.com", "Piantini", "Torre residencial", 30, "Busca mejorar la administración", "Prospecto identificado", 15, 35000, "Carga masiva", "", "Contactar al prospecto", new Date(Date.now() + 24 * 60 * 60 * 1000)].map((value) => ({ value }))
  ];
  await writeXlsxFile(rows, { fileName: "Plantilla_INDEX_ONE_Prospectos.xlsx", columns: EXPORT_HEADERS.map((_, index) => ({ width: index === 0 || index === 7 || index === 13 ? 28 : 18 })) });
}
