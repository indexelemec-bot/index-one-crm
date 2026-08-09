import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { references } from "@/lib/mock-data";
import { generateProposalPdf } from "@/lib/proposals/generate-pdf";

describe("propuesta PDF corporativa", () => {
  it("genera las seis páginas desde la plantilla bloqueada", async () => {
    const [template, regular, bold] = await Promise.all([
      readFile(path.join(process.cwd(), "public/templates/propuesta-index-condo-2026.pdf")),
      readFile(path.join(process.cwd(), "public/fonts/Carlito-Regular.ttf")),
      readFile(path.join(process.cwd(), "public/fonts/Carlito-Bold.ttf"))
    ]);
    const generated = await generateProposalPdf(template, regular, bold, {
      clientName: "Condominio Residencial Altos del Este",
      issueDate: "2026-08-09",
      monthlyFee: 33500,
      references: references.slice(0, 3)
    });
    const pdf = await PDFDocument.load(generated);

    expect(pdf.getPageCount()).toBe(6);
    expect(pdf.getTitle()).toBe("Propuesta INDEX ONE - Condominio Residencial Altos del Este");
    expect(generated.byteLength).toBeGreaterThan(100_000);
  }, 15_000);
});
