import JSZip from "jszip";
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

const EXPORT_HEADERS = ["Prospecto", "Contacto", "Teléfono", "Correo", "Sector", "Segmento", "Unidades", "Necesidad principal", "Etapa", "Probabilidad", "Honorarios prospectados", "Origen", "Ejecutivo", "Próxima acción", "Fecha próxima acción"];

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

function columnIndex(reference: string) {
  const letters = reference.replace(/\d/g, "").toUpperCase();
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, result - 1);
}

function parseXml(xml: string) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("El archivo Excel no tiene un formato válido.");
  return doc;
}

async function xlsxRows(file: File): Promise<unknown[][]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const sheetEntry = zip.file("xl/worksheets/sheet1.xml");
  if (!sheetEntry) throw new Error("No se encontró la primera hoja del archivo Excel.");

  const sharedEntry = zip.file("xl/sharedStrings.xml");
  const sharedStrings: string[] = [];
  if (sharedEntry) {
    const sharedDoc = parseXml(await sharedEntry.async("text"));
    sharedDoc.querySelectorAll("si").forEach((node) => sharedStrings.push(Array.from(node.querySelectorAll("t")).map((part) => part.textContent ?? "").join("")));
  }

  const sheetDoc = parseXml(await sheetEntry.async("text"));
  const rows: unknown[][] = [];
  sheetDoc.querySelectorAll("sheetData > row").forEach((rowNode) => {
    const row: unknown[] = [];
    rowNode.querySelectorAll("c").forEach((cell) => {
      const ref = cell.getAttribute("r") ?? "A1";
      const index = columnIndex(ref);
      const type = cell.getAttribute("t") ?? "";
      let value: unknown = "";
      if (type === "inlineStr") value = Array.from(cell.querySelectorAll("is t")).map((part) => part.textContent ?? "").join("");
      else {
        const raw = cell.querySelector("v")?.textContent ?? "";
        if (type === "s") value = sharedStrings[Number(raw)] ?? "";
        else if (type === "b") value = raw === "1";
        else if (raw !== "" && Number.isFinite(Number(raw))) value = Number(raw);
        else value = raw;
      }
      while (row.length < index) row.push("");
      row[index] = value;
    });
    rows.push(row);
  });
  return rows;
}

export async function readProspectFile(file: File): Promise<unknown[][]> {
  if (file.name.toLowerCase().endsWith(".csv")) return csvRows(await file.text());
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Usa un archivo Excel .xlsx o CSV.");
  return xlsxRows(file);
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

function xmlEscape(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function columnName(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) { value -= 1; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); }
  return result;
}

function worksheetXml(rows: unknown[][]) {
  const body = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndexValue) => {
    const ref = `${columnName(columnIndexValue)}${rowIndex + 1}`;
    const style = rowIndex === 0 ? ' s="1"' : "";
    if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${style}><is><t>${xmlEscape(value instanceof Date ? value.toISOString() : value)}</t></is></c>`;
  }).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${body}</sheetData><autoFilter ref="A1:O${Math.max(1, rows.length)}"/></worksheet>`;
}

async function buildWorkbook(rows: unknown[][]) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.folder("xl")?.file("workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Prospectos" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.folder("xl")?.folder("_rels")?.file("workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.folder("xl")?.file("styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`);
  zip.folder("xl")?.folder("worksheets")?.file("sheet1.xml", worksheetXml(rows));
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportProspectsToExcel(items: Array<{ account: Account; stakeholder?: Stakeholder; opportunity?: Opportunity; owner?: UserProfile }>) {
  const rows: unknown[][] = [EXPORT_HEADERS, ...items.map(({ account, stakeholder, opportunity, owner }) => [
    account.name, stakeholder?.fullName ?? "", stakeholder?.phone ?? "", stakeholder?.email ?? "", account.sector,
    account.accountType, account.units, opportunity?.primaryProblem ?? "", opportunity?.stage ?? "", opportunity?.probability ?? 0,
    opportunity?.monthlyFee ?? 0, account.source, owner?.fullName ?? "", opportunity?.nextAction ?? "", opportunity?.nextActionAt ? new Date(opportunity.nextActionAt).toLocaleString("es-DO") : ""
  ])];
  downloadBlob(await buildWorkbook(rows), `INDEX_ONE_Prospectos_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function downloadProspectTemplate() {
  const rows: unknown[][] = [EXPORT_HEADERS, ["Torre Ejemplo", "María Pérez", "8095551234", "maria@ejemplo.com", "Piantini", "Torre residencial", 30, "Busca mejorar la administración", "Prospecto identificado", 15, 35000, "Carga masiva", "", "Contactar al prospecto", new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString("es-DO")]];
  downloadBlob(await buildWorkbook(rows), "Plantilla_INDEX_ONE_Prospectos.xlsx");
}
