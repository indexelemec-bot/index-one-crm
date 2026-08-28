import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";

export type ClientDocumentTemplateKey = "onboarding_30_60_90" | "document_request";

export interface ClientDocumentData {
  templateKey: ClientDocumentTemplateKey;
  clientName: string;
  issueDate: string;
  location: string;
  recipientName?: string;
  recipientRole?: string;
  accountManager: string;
  accountManagerContact?: string;
  onboardingDate?: string;
  reference?: string;
  deadlineDays?: number;
}

const navy = rgb(0.07, 0.17, 0.31);
const gray = rgb(0.36, 0.42, 0.5);

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function longDateLabel(value: string) {
  const formatted = new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function fitSize(font: PDFFont, text: string, size: number, maxWidth: number, minimum = 7) {
  let candidate = size;
  while (candidate > minimum && font.widthOfTextAtSize(text, candidate) > maxWidth) candidate -= 0.25;
  return candidate;
}

function replaceLine(page: PDFPage, x: number, y: number, width: number, text: string, font: PDFFont, size = 9.5, color = navy) {
  page.drawRectangle({ x, y: y - 2, width, height: size + 5, color: rgb(1, 1, 1) });
  page.drawText(text, { x: x + 2, y, font, size: fitSize(font, text, size, width - 4), color });
}

function personalizeOnboarding(document: PDFDocument, regular: PDFFont, bold: PDFFont, data: ClientDocumentData) {
  const first = document.getPage(0);
  replaceLine(first, 200, 570, 350, data.clientName, bold, 10);
  replaceLine(first, 200, 546, 350, dateLabel(data.onboardingDate || data.issueDate), regular, 10);
  const manager = data.accountManagerContact ? `${data.accountManager} · ${data.accountManagerContact}` : data.accountManager;
  replaceLine(first, 200, 522, 350, manager, regular, 9.5);

  const approval = document.getPage(8);
  replaceLine(approval, 75, 605, 205, data.accountManager, bold, 9);
  const clientSigner = data.recipientName ? `${data.recipientName}${data.recipientRole ? ` · ${data.recipientRole}` : ""}` : data.clientName;
  replaceLine(approval, 310, 605, 205, clientSigner, bold, 9);
  approval.drawRectangle({ x: 72, y: 548, width: 210, height: 34, color: rgb(1, 1, 1) });
  approval.drawRectangle({ x: 307, y: 548, width: 210, height: 34, color: rgb(1, 1, 1) });
  approval.drawText(dateLabel(data.issueDate), { x: 77, y: 565, font: regular, size: 9, color: gray });
  approval.drawText(dateLabel(data.issueDate), { x: 312, y: 565, font: regular, size: 9, color: gray });
  approval.drawRectangle({ x: 68, y: 475, width: 518, height: 45, color: rgb(0.93, 0.95, 0.96) });
  approval.drawRectangle({ x: 68, y: 475, width: 2.5, height: 45, color: rgb(0.05, 0.5, 0.46) });
  approval.drawText("DOCUMENTO PERSONALIZADO", { x: 78, y: 500, font: bold, size: 8, color: rgb(0.05, 0.5, 0.46) });
  approval.drawText(`Preparado para ${data.clientName} con los datos confirmados en INDEX ONE CRM.`, { x: 78, y: 486, font: regular, size: fitSize(regular, `Preparado para ${data.clientName} con los datos confirmados en INDEX ONE CRM.`, 8.5, 490), color: navy });
}

function personalizeDocumentRequest(document: PDFDocument, regular: PDFFont, bold: PDFFont, data: ClientDocumentData) {
  const page = document.getPage(0);
  const reference = data.reference || `IC-GA-${new Date(`${data.issueDate}T12:00:00Z`).getUTCFullYear()}`;
  page.drawRectangle({ x: 298, y: 666, width: 284, height: 58, color: rgb(1, 1, 1) });
  page.drawText(`Ref.: ${reference}`, { x: 442, y: 708, font: bold, size: fitSize(bold, `Ref.: ${reference}`, 9.5, 138), color: navy });
  const datedLocation = `${data.location} · ${longDateLabel(data.issueDate)}`;
  page.drawText(datedLocation, { x: 310, y: 692, font: regular, size: fitSize(regular, datedLocation, 8.5, 270), color: gray });

  page.drawRectangle({ x: 47, y: 608, width: 350, height: 84, color: rgb(1, 1, 1) });
  page.drawText("SEÑORES(AS)", { x: 49, y: 678, font: bold, size: 10.5, color: navy });
  page.drawText(data.recipientName || "Consejo de Administración / Condóminos", { x: 49, y: 663, font: bold, size: fitSize(bold, data.recipientName || "Consejo de Administración / Condóminos", 10, 300), color: navy });
  page.drawText(data.clientName, { x: 49, y: 649, font: regular, size: fitSize(regular, data.clientName, 9.5, 300), color: navy });
  page.drawText(data.location, { x: 49, y: 634, font: regular, size: fitSize(regular, data.location, 8.5, 300), color: gray });

  const deadline = Math.max(1, Math.min(60, data.deadlineDays || 10));
  page.drawRectangle({ x: 47, y: 160, width: 520, height: 38, color: rgb(1, 1, 1) });
  page.drawText("PLAZO DE ENTREGA:", { x: 49, y: 183, font: bold, size: 8.5, color: navy });
  page.drawText(`Agradecemos remitir la documentación en un plazo no mayor a ${deadline} (${deadline}) días calendario desde la recepción`, { x: 136, y: 183, font: regular, size: 7.5, color: navy });
  page.drawText("de esta comunicación, priorizando los renglones clasificados como “Crítica”.", { x: 49, y: 171, font: regular, size: 7.5, color: navy });
}

export async function generateClientDocumentPdf(templateBytes: Uint8Array, regularFontBytes: Uint8Array, boldFontBytes: Uint8Array, data: ClientDocumentData) {
  const document = await PDFDocument.load(templateBytes);
  document.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all([
    document.embedFont(regularFontBytes, { subset: true }),
    document.embedFont(boldFontBytes, { subset: true })
  ]);
  if (data.templateKey === "onboarding_30_60_90") personalizeOnboarding(document, regular, bold, data);
  else personalizeDocumentRequest(document, regular, bold, data);
  document.setTitle(`${data.templateKey === "onboarding_30_60_90" ? "Plan de Onboarding 30-60-90" : "Solicitud de documentos"} — ${data.clientName}`);
  document.setSubject(`Documento personalizado para ${data.clientName}`);
  document.setCreator("INDEX ONE CRM");
  document.setProducer("INDEX ONE CRM");
  return document.save();
}
