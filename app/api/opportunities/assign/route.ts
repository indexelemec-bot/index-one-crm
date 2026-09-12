import { NextResponse } from "next/server";
import { opportunityAssignmentSchema } from "@/lib/assignment";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const parsed = opportunityAssignmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos de asignación inválidos." }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  const { data, error } = await supabase.rpc("reassign_opportunity", {
    target_opportunity: parsed.data.opportunityId,
    replacement_owner: parsed.data.newOwnerId,
    assignment_reason: parsed.data.reason,
    assignment_note: parsed.data.note || null
  });

  if (error) {
    console.error("Opportunity assignment failed", { code: error.code, details: error.details });
    if (error.code === "42501") return NextResponse.json({ error: "No tienes permiso para reasignar esta oportunidad." }, { status: 403 });
    if (error.code === "P0002") return NextResponse.json({ error: "La oportunidad no existe o no está disponible." }, { status: 404 });
    if (error.code === "P0001" && error.message.includes("exactamente una oportunidad")) return NextResponse.json({ error: "Esta cuenta no cumple el modelo de una oportunidad por cuenta. Requiere revisión administrativa." }, { status: 409 });
    if (error.code === "22023" || error.code === "23514") return NextResponse.json({ error: "Los datos de asignación no cumplen las reglas requeridas." }, { status: 400 });
    return NextResponse.json({ error: "No fue posible completar la reasignación." }, { status: 500 });
  }
  return NextResponse.json({ assignment: Array.isArray(data) ? data[0] : data });
}
