import type { SupabaseClient } from "@supabase/supabase-js";
import { renderProposalFile } from "@/lib/proposals/render-file";
import type { CommercialReference, ProposalFileFormat } from "@/types/domain";

export async function loadProposalDeliveryFile(supabase: SupabaseClient, proposalId: string, opportunityId?: string) {
  let query = supabase.from("proposals").select("id,opportunity_id,client_name,issue_date,monthly_fee,reference_ids,file_format,version").eq("id", proposalId);
  if (opportunityId) query = query.eq("opportunity_id", opportunityId);
  const { data: proposal, error: proposalError } = await query.single();
  if (proposalError || !proposal) throw new Error("La versión seleccionada de la propuesta no está disponible.");

  const referenceIds = proposal.reference_ids as string[];
  const { data: rows, error: referencesError } = await supabase.from("references_catalog").select("*").in("id", referenceIds);
  if (referencesError || !rows || rows.length !== 3) throw new Error("No fue posible recuperar las tres referencias de esta propuesta.");
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  const references = referenceIds.map((id) => {
    const row = byId.get(id);
    if (!row) throw new Error("Una referencia de la propuesta ya no está disponible.");
    return { id: String(row.id), clientName: String(row.client_name), location: String(row.location), units: Number(row.units), accountType: row.account_type, profile: String(row.profile ?? ""), approved: Boolean(row.approved) } as CommercialReference;
  });
  const format: ProposalFileFormat = proposal.file_format === "pdf" ? "pdf" : "docx";
  const file = await renderProposalFile(format, { clientName: String(proposal.client_name), issueDate: String(proposal.issue_date), monthlyFee: Number(proposal.monthly_fee), references }, Number(proposal.version));
  return { proposal, file };
}
