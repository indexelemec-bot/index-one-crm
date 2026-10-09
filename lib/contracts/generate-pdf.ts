import JSZip from "jszip";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { cleanWordMarkup } from "@/lib/contracts/clean-docx";

type ContractParagraph = { text: string; centered: boolean; bold: boolean };

function decodeXml(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'");
}

function pdfSafe(value: string) {
  return value.normalize("NFC").replaceAll("\u00a0", " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/•/g, "-").replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "");
}

function extractParagraphs(xml: string): ContractParagraph[] {
  const clean = cleanWordMarkup(xml);
  return [...clean.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(([paragraph]) => {
    const text = [...paragraph.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => decodeXml(match[1])).join("");
    return { text: pdfSafe(text).trim(), centered: /<w:jc\b[^>]*w:val="center"/.test(paragraph), bold: /<w:b(?:\s|\/|>)/.test(paragraph) };
  }).filter((paragraph) => paragraph.text.length > 0);
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = []; let current = "";
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || font.widthOfTextAtSize(candidate, size) <= width) current = candidate;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}

export async function buildContractPdf(docxBytes: Uint8Array) {
  const zip = await JSZip.loadAsync(docxBytes);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("Documento Word inválido para convertir a PDF.");
  const paragraphs = extractParagraphs(await documentFile.async("string"));
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const pageWidth = 612; const pageHeight = 792; const margin = 64; const bodySize = 10.5; const lineHeight = 14;
  let page: PDFPage; let y = pageHeight - 58;
  const addPage = () => { page = pdf.addPage([pageWidth, pageHeight]); y = pageHeight - 58; };
  addPage();
  for (const paragraph of paragraphs) {
    const font = paragraph.bold ? bold : regular;
    const lines = wrap(paragraph.text, font, bodySize, pageWidth - margin * 2);
    const required = lines.length * lineHeight + 7;
    if (y - required < 54) addPage();
    for (const line of lines) {
      const lineWidth = font.widthOfTextAtSize(line, bodySize);
      page!.drawText(line, { x: paragraph.centered ? Math.max(margin, (pageWidth - lineWidth) / 2) : margin, y, size: bodySize, font, color: rgb(0, 0, 0) });
      y -= lineHeight;
    }
    y -= 7;
  }
  const pages = pdf.getPages();
  pages.forEach((item, index) => item.drawText(`Página ${index + 1} de ${pages.length}`, { x: pageWidth / 2 - 28, y: 28, size: 8, font: regular, color: rgb(0.35, 0.35, 0.35) }));
  return Buffer.from(await pdf.save());
}
