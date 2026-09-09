import { NextResponse } from "next/server";
import { renderProposalFile } from "@/lib/proposals/render-file";
import { createClient } from "@/lib/supabase/server";
import { mapReference } from "@/lib/supabase/mappers";
import { proposalSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = proposalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos de propuesta inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (new Set(parsed.data.referenceIds).size !== 3) {
    return NextResponse.json(
      { error: "Selecciona tres referencias diferentes." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: authData, error: authError } =
    (await supabase?.auth.getUser()) ?? { data: { user: null }, error: null };
  if (!supabase || authError || !authData.user) {
    return NextResponse.json(
      { error: "Sesión no disponible." },
      { status: 401 },
    );
  }

  try {
    const { data: opportunity, error: opportunityError } = await supabase
      .from("opportunities")
      .select("id,account_id")
      .eq("id", parsed.data.opportunityId)
      .maybeSingle();
    if (opportunityError) throw opportunityError;
    if (!opportunity) {
      return NextResponse.json(
        { error: "La oportunidad no existe o no está disponible." },
        { status: 404 },
      );
    }

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select(
        "id,name,project_type,residential_subtype,custom_unit_type",
      )
      .eq("id", opportunity.account_id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) {
      return NextResponse.json(
        { error: "La cuenta no existe o no está disponible." },
        { status: 404 },
      );
    }

    const { data: rows, error: referencesError } = await supabase
      .from("references_catalog")
      .select("*")
      .in("id", parsed.data.referenceIds)
      .eq("active", true)
      .eq("approved", true)
      .eq("project_type", account.project_type);
    if (referencesError) throw referencesError;
    if (!rows || rows.length !== 3) {
      return NextResponse.json(
        {
          error:
            "Las tres referencias deben estar activas y corresponder al tipo del proyecto.",
        },
        { status: 422 },
      );
    }

    const byId = new Map(rows.map((row) => [String(row.id), mapReference(row)]));
    const references = parsed.data.referenceIds.map((id) => byId.get(id));
    if (references.some((reference) => !reference)) {
      return NextResponse.json(
        { error: "No fue posible resolver las tres referencias." },
        { status: 422 },
      );
    }

    const file = await renderProposalFile(parsed.data.format, {
      clientName: String(account.name),
      issueDate: parsed.data.issueDate,
      monthlyFee: parsed.data.monthlyFee,
      references: references as NonNullable<(typeof references)[number]>[],
      projectType: account.project_type,
      residentialSubtype: account.residential_subtype ?? undefined,
      customUnitType: account.custom_unit_type ?? undefined,
    });
    return new NextResponse(Buffer.from(file.bytes), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("proposal:generate", error);
    return NextResponse.json(
      { error: "No se pudo generar la propuesta." },
      { status: 500 },
    );
  }
}
