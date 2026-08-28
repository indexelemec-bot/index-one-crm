import type { SupabaseClient } from "@supabase/supabase-js";
import { renderClientDocumentFile } from "@/lib/client-documents/render-file";
import type { ClientDocumentData } from "@/lib/client-documents/generate-pdf";

export async function loadClientDocumentFile(supabase: SupabaseClient, documentId: string, opportunityId?: string) {
  let query = supabase.from("client_documents").select("*").eq("id", documentId);
  if (opportunityId) query = query.eq("opportunity_id", opportunityId);
  const { data: document, error } = await query.single();
  if (error || !document) throw new Error("El documento no está disponible para este usuario.");
  const snapshot = document.data_snapshot as ClientDocumentData;
  const file = await renderClientDocumentFile(snapshot);
  return { document, file, snapshot };
}
