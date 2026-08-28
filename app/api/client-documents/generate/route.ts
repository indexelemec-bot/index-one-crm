import { NextResponse } from "next/server";
import { z } from "zod";
import { renderClientDocumentFile } from "@/lib/client-documents/render-file";
import type { ClientDocumentData } from "@/lib/client-documents/generate-pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  opportunityId: z.string().uuid(),
  stakeholderId: z.string().uuid().optional(),
  templateKey: z.enum(["onboarding_30_60_90", "document_request"]),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  onboardingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  location: z.string().trim().min(2).max(180),
  accountManager: z.string().trim().min(2).max(120).optional(),
  accountManagerContact: z.string().trim().max(180).optional(),
  reference: z.string().trim().max(40).optional(),
  deadlineDays: z.number().int().min(1).max(60).optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa el cliente, las fechas y los datos del documento." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  const { data: opportunity, error: opportunityError } = await supabase.from("opportunities").select("id,account_id").eq("id", parsed.data.opportunityId).single();
  if (opportunityError || !opportunity) return NextResponse.json({ error: "La oportunidad no está disponible para este usuario." }, { status: 403 });
  const { data: account, error: accountError } = await supabase.from("accounts").select("id,name,address,sector,city").eq("id", opportunity.account_id).single();
  if (accountError || !account) return NextResponse.json({ error: "No fue posible cargar los datos del cliente." }, { status: 404 });
  const { data: profile } = await supabase.from("profiles").select("full_name,email").eq("id", authData.user.id).single();

  let stakeholder: { id: string; full_name: string; role: string | null; account_id: string } | null = null;
  if (parsed.data.stakeholderId) {
    const result = await supabase.from("stakeholders").select("id,full_name,role,account_id").eq("id", parsed.data.stakeholderId).eq("account_id", account.id).single();
    if (result.error || !result.data) return NextResponse.json({ error: "El contacto no pertenece al cliente seleccionado." }, { status: 400 });
    stakeholder = result.data;
  }

  const year = Number(parsed.data.issueDate.slice(0, 4));
  const data: ClientDocumentData = {
    templateKey: parsed.data.templateKey,
    clientName: account.name,
    issueDate: parsed.data.issueDate,
    location: parsed.data.location,
    recipientName: stakeholder?.full_name,
    recipientRole: stakeholder?.role || undefined,
    accountManager: parsed.data.accountManager || profile?.full_name || "Equipo INDEX CONDO",
    accountManagerContact: parsed.data.accountManagerContact || profile?.email || undefined,
    onboardingDate: parsed.data.onboardingDate || parsed.data.issueDate,
    reference: parsed.data.reference || `IC-GA-${year}-${String(Date.now()).slice(-6)}`,
    deadlineDays: parsed.data.deadlineDays || 10
  };

  try {
    const file = await renderClientDocumentFile(data);
    const title = data.templateKey === "onboarding_30_60_90" ? "Plan de Onboarding 30-60-90" : "Solicitud de documentos para inicio de gestión";
    const documentId = crypto.randomUUID();
    const { error: insertError } = await supabase.from("client_documents").insert({
      id: documentId, opportunity_id: opportunity.id, stakeholder_id: stakeholder?.id ?? null,
      template_key: data.templateKey, title, file_name: file.fileName, data_snapshot: data,
      status: "generated", generated_by: authData.user.id
    });
    if (insertError) return NextResponse.json({ error: `El PDF se preparó, pero no pudo guardarse: ${insertError.message}` }, { status: 500 });
    return new NextResponse(Buffer.from(file.bytes), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
        "Cache-Control": "no-store",
        "X-Client-Document-Id": documentId,
        "X-Client-Document-Name": encodeURIComponent(file.fileName)
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No fue posible generar el PDF personalizado." }, { status: 500 });
  }
}
