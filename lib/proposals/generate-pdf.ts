import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import type { CommercialReference } from "@/types/domain";

export interface ProposalPdfData {
  clientName: string;
  issueDate: string;
  monthlyFee: number;
  references: CommercialReference[];
}

const navy = rgb(25 / 255, 46 / 255, 103 / 255);
const gray = rgb(90 / 255, 90 / 255, 90 / 255);
const orange = rgb(240 / 255, 117 / 255, 32 / 255);
const black = rgb(0, 0, 0);

function spanishDate(value: string) {
  return new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function fee(value: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function fittedSize(font: PDFFont, text: string, preferred: number, maxWidth: number, minimum: number) {
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.25;
  return size;
}

function drawCentered(page: PDFPage, text: string, y: number, font: PDFFont, preferredSize: number, maxWidth: number, color = black) {
  const size = fittedSize(font, text, preferredSize, maxWidth, Math.max(7, preferredSize - 4));
  page.drawText(text, { x: (page.getWidth() - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color });
}

function drawRight(page: PDFPage, text: string, right: number, y: number, font: PDFFont, size: number, color = black) {
  page.drawText(text, { x: right - font.widthOfTextAtSize(text, size), y, size, font, color });
}

function drawReference(page: PDFPage, reference: CommercialReference, y: number, regular: PDFFont, bold: PDFFont) {
  const nameSize = fittedSize(bold, reference.clientName, 10, 165, 7.5);
  const locationSize = fittedSize(regular, reference.location, 9.5, 190, 7);
  const units = String(reference.units);
  page.drawText(reference.clientName, { x: 62.85, y, size: nameSize, font: bold, color: navy });
  page.drawText(reference.location, { x: 242.8, y: y + 0.5, size: locationSize, font: regular, color: black });
  page.drawText(units, { x: 494.1 - bold.widthOfTextAtSize(units, 9.5) / 2, y: y + 0.2, size: 9.5, font: bold, color: orange });
}

export async function generateProposalPdf(
  template: ArrayBuffer | Uint8Array,
  regularFont: ArrayBuffer | Uint8Array,
  boldFont: ArrayBuffer | Uint8Array,
  data: ProposalPdfData
) {
  if (data.references.length !== 3) throw new Error("La plantilla requiere exactamente tres referencias comerciales.");
  const pdf = await PDFDocument.load(template);
  if (pdf.getPageCount() !== 6) throw new Error("La plantilla PDF corporativa debe contener seis páginas.");
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(regularFont, { subset: true });
  const bold = await pdf.embedFont(boldFont, { subset: true });
  const pages = pdf.getPages();
  const longDate = spanishDate(data.issueDate);

  drawCentered(pages[0], data.clientName, 421.2, bold, 15, 470, navy);
  drawCentered(pages[0], longDate, 378.7, regular, 10, 230, gray);
  drawRight(pages[1], `Santo Domingo, ${longDate}`, 557.02, 694.85, regular, 10, gray);
  pages[1].drawText(data.clientName, {
    x: 55.1,
    y: 651.33,
    size: fittedSize(bold, data.clientName, 11.5, 500, 8),
    font: bold,
    color: navy
  });

  drawReference(pages[3], data.references[0], 332.25, regular, bold);
  drawReference(pages[3], data.references[1], 307.55, regular, bold);
  drawReference(pages[3], data.references[2], 282.85, regular, bold);
  drawCentered(pages[4], `RD$ ${fee(data.monthlyFee)} / mes`, 408, bold, 18, 330, orange);

  pdf.setTitle(`Propuesta INDEX ONE - ${data.clientName}`);
  pdf.setSubject("Propuesta de administración de edificios y condominios");
  pdf.setProducer("INDEX ONE CRM");
  return pdf.save();
}
