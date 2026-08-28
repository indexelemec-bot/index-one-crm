import { readFile } from "node:fs/promises";
import path from "node:path";
import { generateClientDocumentPdf, type ClientDocumentData, type ClientDocumentTemplateKey } from "@/lib/client-documents/generate-pdf";

const templates: Record<ClientDocumentTemplateKey, string> = {
  onboarding_30_60_90: "plan-onboarding-30-60-90-index-condo.pdf",
  document_request: "solicitud-documentos-inicio-gestion-index-condo.pdf"
};

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

export function clientDocumentFileName(data: ClientDocumentData) {
  const prefix = data.templateKey === "onboarding_30_60_90" ? "plan-onboarding-30-60-90" : "solicitud-documentos";
  return `${prefix}-${slug(data.clientName)}.pdf`;
}

export async function renderClientDocumentFile(data: ClientDocumentData) {
  const [template, regular, bold] = await Promise.all([
    readFile(path.join(process.cwd(), "public", "templates", templates[data.templateKey])),
    readFile(path.join(process.cwd(), "public", "fonts", "Carlito-Regular.ttf")),
    readFile(path.join(process.cwd(), "public", "fonts", "Carlito-Bold.ttf"))
  ]);
  return {
    bytes: await generateClientDocumentPdf(template, regular, bold, data),
    fileName: clientDocumentFileName(data),
    contentType: "application/pdf"
  };
}
