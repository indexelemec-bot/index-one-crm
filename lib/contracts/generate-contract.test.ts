import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildContract } from "@/lib/contracts/generate-contract";
import { COMPANY_ADDRESS, cleanWordMarkup } from "@/lib/contracts/clean-docx";
import { buildContractPdf } from "@/lib/contracts/generate-pdf";

describe("contrato corporativo", () => {
  it("genera una copia Word sin modificar el maestro", async () => {
    const bytes = await buildContract({ opportunityId: "11111111-1111-4111-8111-111111111111", clientLegalName: "TORRE PRUEBA", clientRnc: "1-01-99999-1", clientAddress: "Avenida Principal 10", city: "SANTO DOMINGO", sector: "PIANTINI", representativeName: "ANA PÉREZ", representativeId: "001-9999999-1", representativeGenderEnding: "a", assemblyDate: "2026-08-01", monthlyFee: 35000, signatureDate: "2026-08-15", changeReason: "Versión inicial", negotiatedTerms: "Sin cambios" });
    const auditDirectory = await mkdtemp(join(tmpdir(), "index-one-contract-audit-"));
    await writeFile(join(auditDirectory, "generated-test.docx"), bytes);
    const zip = await JSZip.loadAsync(bytes); const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("TORRE PRUEBA"); expect(xml).toContain("TREINTA Y CINCO MIL PESOS DOMINICANOS CON 00/100"); expect(xml).toMatch(/35[.,]000[.,]00/); expect(xml).toContain("ANA PÉREZ"); expect(xml).toContain("15"); expect(xml).toContain("agosto"); expect(xml).toContain(COMPANY_ADDRESS); expect(xml).toContain("quince (15) días del mes de agosto del año dos mil veintiséis (2026)"); expect(xml).not.toContain("dos mil veintiuno (2021)");
    const wordXml = await Promise.all(Object.keys(zip.files).filter((name) => name.startsWith("word/") && name.endsWith(".xml")).map((name) => zip.file(name)!.async("string")));
    expect(wordXml.join("\n")).not.toMatch(/<w:(?:highlight|ins|del|moveFrom|moveTo|commentRangeStart|commentRangeEnd|commentReference)\b/);
    const pdfBytes = await buildContractPdf(bytes); const pdf = await PDFDocument.load(pdfBytes);
    expect(pdf.getPageCount()).toBeGreaterThan(0);
    if (process.env.CONTRACT_QA_DIR) {
      await mkdir(process.env.CONTRACT_QA_DIR, { recursive: true });
      await writeFile(join(process.env.CONTRACT_QA_DIR, "contrato-prueba-limpio.docx"), bytes);
      await writeFile(join(process.env.CONTRACT_QA_DIR, "contrato-prueba-limpio.pdf"), pdfBytes);
    }
    await rm(auditDirectory, { recursive: true, force: true });
  });

  it("acepta inserciones y elimina cambios, comentarios y resaltados", () => {
    const dirty = '<w:p><w:del w:id="1"><w:r><w:delText>viejo</w:delText></w:r></w:del><w:ins w:id="2"><w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t>vigente</w:t></w:r></w:ins><w:commentReference w:id="0"/></w:p>';
    expect(cleanWordMarkup(dirty)).toBe("<w:p><w:r><w:rPr></w:rPr><w:t>vigente</w:t></w:r></w:p>");
  });
});
