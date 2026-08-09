import { readFile } from "node:fs/promises";
import path from "node:path";
import { generateProposalPdf } from "@/lib/proposals/generate-pdf";
import { generateProposalDocx } from "@/lib/proposals/generate-template";
import type { CommercialReference, ProposalFileFormat } from "@/types/domain";

export interface ProposalFileData {
  clientName: string;
  issueDate: string;
  monthlyFee: number;
  references: CommercialReference[];
}

export function proposalFileName(clientName: string, format: ProposalFileFormat, version?: number) {
  const safeName = clientName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `propuesta-index-${safeName}${version ? `-v${version}` : ""}.${format}`;
}

export async function renderProposalFile(format: ProposalFileFormat, data: ProposalFileData, version?: number) {
  if (format === "pdf") {
    const [template, regular, bold] = await Promise.all([
      readFile(path.join(process.cwd(), "public", "templates", "propuesta-index-condo-2026.pdf")),
      readFile(path.join(process.cwd(), "public", "fonts", "Carlito-Regular.ttf")),
      readFile(path.join(process.cwd(), "public", "fonts", "Carlito-Bold.ttf"))
    ]);
    return { bytes: await generateProposalPdf(template, regular, bold, data), fileName: proposalFileName(data.clientName, format, version), contentType: "application/pdf" };
  }
  const template = await readFile(path.join(process.cwd(), "public", "templates", "propuesta-index-condo-2026.docx"));
  return { bytes: await generateProposalDocx(template, data), fileName: proposalFileName(data.clientName, format, version), contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
}
