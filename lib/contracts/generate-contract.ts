import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { amountToSpanishWords } from "@/lib/contracts/spanish-amount";

export type ContractValues = {
  opportunityId: string;
  clientLegalName: string;
  clientRnc: string;
  clientAddress: string;
  city: string;
  sector: string;
  representativeName: string;
  representativeId: string;
  representativeGenderEnding: "o" | "a";
  assemblyDate: string;
  monthlyFee: number;
  signatureDate: string;
  changeReason: string;
  negotiatedTerms?: string;
};

const xmlEscape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const units = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];

function yearTailWords(year: number) {
  const tail = year % 100;
  if (tail < 30) return units[tail];
  const tens = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
  const ten = Math.floor(tail / 10);
  const unit = tail % 10;
  return unit ? `${tens[ten]} y ${units[unit]}` : tens[ten];
}

export async function buildContract(values: ContractValues) {
  const assembly = new Date(`${values.assemblyDate}T12:00:00Z`);
  const signature = new Date(`${values.signatureDate}T12:00:00Z`);
  const replacements = [values.clientLegalName, values.clientRnc, values.clientAddress, values.city, values.sector, values.representativeName, values.representativeGenderEnding, values.representativeId, values.clientLegalName, values.clientLegalName, monthNames[assembly.getUTCMonth()], yearTailWords(assembly.getUTCFullYear()), String(assembly.getUTCFullYear()).slice(-1), amountToSpanishWords(values.monthlyFee), new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(values.monthlyFee), String(signature.getUTCDate()).padStart(2, "0"), " ", `${monthNames[signature.getUTCMonth()]} `, "del ", "año dos mil ", yearTailWords(signature.getUTCFullYear()), "(", "20", String(signature.getUTCFullYear()).slice(-2), "). _", values.representativeName, values.representativeGenderEnding === "a" ? "a" : "e", values.clientLegalName];
  const contractMasterBase64 = (await readFile(path.join(process.cwd(), "private/templates/contract-master.b64"), "utf8")).trim();
  const zip = await JSZip.loadAsync(Buffer.from(contractMasterBase64, "base64"));
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("Plantilla de contrato inválida.");
  let xml = await documentFile.async("string");
  let index = 0;
  xml = xml.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (run) => {
    if (!run.includes("<w:highlight") || !run.includes("<w:t")) return run;
    const replacement = replacements[index++];
    if (replacement === undefined) return run;
    return run.replace(/(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/, `$1${xmlEscape(replacement)}$2`);
  });
  xml = xml.replace("<w:t>xx</w:t>", `<w:t>${String(assembly.getUTCDate()).padStart(2, "0")}</w:t>`);
  if (index < replacements.length) throw new Error(`La plantilla solo expuso ${index} de ${replacements.length} campos esperados.`);
  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
