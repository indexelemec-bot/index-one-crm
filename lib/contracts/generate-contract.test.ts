import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildContract } from "@/lib/contracts/generate-contract";

describe("contrato corporativo", () => {
  it("genera una copia Word sin modificar el maestro", async () => {
    const bytes = await buildContract({ opportunityId: "11111111-1111-4111-8111-111111111111", clientLegalName: "TORRE PRUEBA", clientRnc: "1-01-99999-1", clientAddress: "Avenida Principal 10", city: "SANTO DOMINGO", sector: "PIANTINI", representativeName: "ANA PÉREZ", representativeId: "001-9999999-1", representativeGenderEnding: "a", assemblyDate: "2026-08-01", monthlyFee: 35000, signatureDate: "2026-08-15", changeReason: "Versión inicial", negotiatedTerms: "Sin cambios" });
    const auditDirectory = await mkdtemp(join(tmpdir(), "index-one-contract-audit-"));
    await writeFile(join(auditDirectory, "generated-test.docx"), bytes);
    const zip = await JSZip.loadAsync(bytes); const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("TORRE PRUEBA"); expect(xml).toContain("TREINTA Y CINCO MIL PESOS DOMINICANOS CON 00/100"); expect(xml).toMatch(/35[.,]000[.,]00/); expect(xml).toContain("ANA PÉREZ"); expect(xml).toContain("15"); expect(xml).toContain("agosto");
    await rm(auditDirectory, { recursive: true, force: true });
  });
});
