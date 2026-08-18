import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildContract } from "@/lib/contracts/generate-contract";

export const runtime = "nodejs";
const schema = z.object({ opportunityId: z.string().uuid(), clientLegalName: z.string().trim().min(3), clientRnc: z.string().trim().min(5), clientAddress: z.string().trim().min(5), city: z.string().trim().min(2), sector: z.string().trim().min(2), representativeName: z.string().trim().min(3), representativeId: z.string().trim().min(5), representativeGenderEnding: z.enum(["o", "a"]), assemblyDate: z.string().date(), signatureDate: z.string().date(), changeReason: z.string().trim().min(3), negotiatedTerms: z.string().trim().max(12000).optional() });
const contractMasterSha256 = "1297909bcb760dd41f35dedc6468d72c1d650fd94f08a24600ee0afd877a6f74";

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Revisa los datos legales, fechas y motivo de versión." }, { status: 400 });
  const supabase = await createClient(); const { data: authData } = await supabase?.auth.getUser() ?? { data: { user: null } }; if (!supabase || !authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  const { data: opportunity } = await supabase.from("opportunities").select("id,account_id,owner_id").eq("id", parsed.data.opportunityId).single(); if (!opportunity) return NextResponse.json({ error: "Oportunidad no disponible." }, { status: 403 });
  const { data: proposal, error: proposalError } = await supabase.from("proposals").select("id,version,monthly_fee,status").eq("opportunity_id", opportunity.id).eq("status", "aceptada").order("version", { ascending: false }).limit(1).maybeSingle();
  if (proposalError) return NextResponse.json({ error: proposalError.message }, { status: 500 });
  if (!proposal) return NextResponse.json({ error: "Esta oportunidad no tiene una propuesta comercial aprobada. Aprueba una versión antes de generar el contrato." }, { status: 409 });
  const monthlyFee = Number(proposal.monthly_fee);
  if (!Number.isFinite(monthlyFee) || monthlyFee <= 0) return NextResponse.json({ error: "La propuesta aprobada no tiene honorarios válidos." }, { status: 409 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!url || !serviceKey) return NextResponse.json({ error: "Almacenamiento seguro no configurado." }, { status: 503 });
  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let { data: contract } = await supabase.from("contracts").select("*").eq("opportunity_id", opportunity.id).maybeSingle();
  if (!contract) { const created = await supabase.from("contracts").insert({ opportunity_id: opportunity.id, account_id: opportunity.account_id, client_legal_name: parsed.data.clientLegalName, client_rnc: parsed.data.clientRnc, client_address: parsed.data.clientAddress, representative_name: parsed.data.representativeName, representative_id: parsed.data.representativeId, signature_date: parsed.data.signatureDate, effective_date: parsed.data.signatureDate, expiration_date: `${Number(parsed.data.signatureDate.slice(0,4))+1}${parsed.data.signatureDate.slice(4)}`, created_by: authData.user.id }).select("*").single(); if (created.error || !created.data) return NextResponse.json({ error: created.error?.message ?? "No fue posible crear el contrato." }, { status: 500 }); contract = created.data; }
  const version = Number(contract.current_version) + 1; let bytes: Buffer; try { bytes = await buildContract({ ...parsed.data, monthlyFee }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible generar el contrato." }, { status: 500 }); }
  const safeName = parsed.data.clientLegalName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase(); const path = `${opportunity.id}/${contract.id}/v${version}-contrato-${safeName}.docx`;
  const upload = await admin.storage.from("contract-files").upload(path, bytes, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: false }); if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });
  const inserted = await supabase.from("contract_versions").insert({ contract_id: contract.id, proposal_id: proposal.id, version, monthly_fee: monthlyFee, change_reason: parsed.data.changeReason, negotiated_terms: parsed.data.negotiatedTerms || null, file_path: path, master_sha256: contractMasterSha256, generated_by: authData.user.id }).select("*").single();
  if (inserted.error) { await admin.storage.from("contract-files").remove([path]); return NextResponse.json({ error: inserted.error.message }, { status: 500 }); }
  await supabase.from("contracts").update({ client_legal_name: parsed.data.clientLegalName, client_rnc: parsed.data.clientRnc, client_address: parsed.data.clientAddress, representative_name: parsed.data.representativeName, representative_id: parsed.data.representativeId, signature_date: parsed.data.signatureDate, current_version: version, status: "revision_cliente", updated_at: new Date().toISOString() }).eq("id", contract.id);
  await supabase.from("contract_status_history").insert({ contract_id: contract.id, previous_status: contract.status, new_status: "revision_cliente", notes: parsed.data.changeReason, changed_by: authData.user.id });
  const signed = await admin.storage.from("contract-files").createSignedUrl(path, 60 * 15); return NextResponse.json({ contractId: contract.id, version, proposalId: proposal.id, proposalVersion: proposal.version, monthlyFee, signedUrl: signed.data?.signedUrl });
}
