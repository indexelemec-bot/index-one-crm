import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { generateProposalDocx } from "@/lib/proposals/generate-template";
import { proposalSchema } from "@/lib/validation";
import type { CommercialReference } from "@/types/domain";

export const runtime="nodejs";
export async function POST(request:Request){try{const body=await request.json();const parsed=proposalSchema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Datos de propuesta inválidos",details:parsed.error.flatten()},{status:400});const template=await readFile(path.join(process.cwd(),"public","templates","propuesta-index-condo-2026.docx"));const references=body.references as CommercialReference[];if(!Array.isArray(references)||references.length!==3)return NextResponse.json({error:"Se requieren tres referencias"},{status:400});const result=await generateProposalDocx(template,{clientName:String(body.clientName),issueDate:parsed.data.issueDate,monthlyFee:parsed.data.monthlyFee,references});const safeName=String(body.clientName).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"").toLowerCase();return new NextResponse(Buffer.from(result),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":`attachment; filename="propuesta-index-${safeName}.docx"`,"Cache-Control":"no-store"}})}catch(error){console.error(error);return NextResponse.json({error:"No se pudo generar la propuesta"},{status:500})}}
