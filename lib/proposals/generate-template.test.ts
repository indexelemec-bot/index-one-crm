import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { references } from "@/lib/mock-data";
import { generateProposalDocx } from "@/lib/proposals/generate-template";

describe("plantilla corporativa",()=>{it("sustituye únicamente los datos permitidos",async()=>{const template=await readFile(path.join(process.cwd(),"public/templates/propuesta-index-condo-2026.docx"));const generated=await generateProposalDocx(template,{clientName:"Torre Prueba Uno",issueDate:"2026-08-08",monthlyFee:45500,references:references.slice(0,3)});const zip=await JSZip.loadAsync(generated);const xml=await zip.file("word/document.xml")!.async("string");expect(xml).toContain("Torre Prueba Uno");expect(xml).toContain("45,500.00");expect(xml).not.toContain("29 de julio de 2026");expect(xml).not.toContain("&lt;w:");expect(zip.file("word/media/image1.png")).not.toBeNull()})});
