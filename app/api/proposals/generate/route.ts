import { NextResponse } from "next/server";
import { renderProposalFile } from "@/lib/proposals/render-file";
import { proposalSchema } from "@/lib/validation";
import type { CommercialReference } from "@/types/domain";

export const runtime="nodejs";
export async function POST(request:Request){try{const body=await request.json();const parsed=proposalSchema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Datos de propuesta inválidos",details:parsed.error.flatten()},{status:400});const references=body.references as CommercialReference[];if(!Array.isArray(references)||references.length!==3)return NextResponse.json({error:"Se requieren tres referencias"},{status:400});const file=await renderProposalFile(parsed.data.format,{clientName:String(body.clientName),issueDate:parsed.data.issueDate,monthlyFee:parsed.data.monthlyFee,references});return new NextResponse(Buffer.from(file.bytes),{headers:{"Content-Type":file.contentType,"Content-Disposition":`attachment; filename="${file.fileName}"`,"Cache-Control":"no-store"}})}catch(error){console.error(error);return NextResponse.json({error:"No se pudo generar la propuesta"},{status:500})}}
