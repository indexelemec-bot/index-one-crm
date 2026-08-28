import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { generateClientDocumentPdf, type ClientDocumentData } from "@/lib/client-documents/generate-pdf";

const root = process.cwd();
const fonts = Promise.all([
  readFile(path.join(root, "public/fonts/Carlito-Regular.ttf")),
  readFile(path.join(root, "public/fonts/Carlito-Bold.ttf"))
]);

async function generate(templateName: string, data: ClientDocumentData) {
  const [template, [regular, bold]] = await Promise.all([readFile(path.join(root, "public/templates", templateName)), fonts]);
  return generateClientDocumentPdf(template, regular, bold, data);
}

describe("documentos personalizados", () => {
  it("conserva las nueve páginas del plan de onboarding", async () => {
    const bytes = await generate("plan-onboarding-30-60-90-index-condo.pdf", {
      templateKey: "onboarding_30_60_90", clientName: "Condominio Jardines del Mar", issueDate: "2026-08-28",
      onboardingDate: "2026-09-01", location: "Santo Domingo", recipientName: "María Pérez",
      recipientRole: "presidente", accountManager: "Wilmer Andújar", accountManagerContact: "809-555-0101"
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(9);
    expect(pdf.getTitle()).toContain("Condominio Jardines del Mar");
    expect(bytes.byteLength).toBeGreaterThan(100_000);
  });

  it("conserva la carta de una página y sus metadatos", async () => {
    const bytes = await generate("solicitud-documentos-inicio-gestion-index-condo.pdf", {
      templateKey: "document_request", clientName: "Residencial Las Palmas", issueDate: "2026-08-28",
      location: "Piantini, Santo Domingo", recipientName: "Consejo de Administración",
      accountManager: "Wilmer Andújar", reference: "IC-GA-2026-245", deadlineDays: 10
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getCreator()).toBe("INDEX ONE CRM");
    expect(bytes.byteLength).toBeGreaterThan(100_000);
  });
});
