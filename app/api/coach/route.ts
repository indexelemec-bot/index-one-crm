import { NextResponse } from "next/server";
import { generateText, gateway, Output } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const requestSchema = z.object({ opportunityId: z.string().uuid(), question: z.string().trim().min(3).max(1200) });
const responseSchema = z.object({ summary: z.string(), recommendations: z.array(z.string()).min(2).max(4), questions: z.array(z.string()).min(2).max(4), risk: z.string(), nextAction: z.string() });

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escribe una consulta comercial concreta." }, { status: 400 });
  const supabase = await createClient(); const { data: authData } = await supabase?.auth.getUser() ?? { data: { user: null } };
  if (!supabase || !authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  const { data: opportunity } = await supabase.from("opportunities").select("*,accounts(*)").eq("id", parsed.data.opportunityId).single();
  if (!opportunity) return NextResponse.json({ error: "La oportunidad no está disponible para este usuario." }, { status: 403 });
  const [{ data: stakeholders }, { data: proposals }, { data: tasks }] = await Promise.all([
    supabase.from("stakeholders").select("full_name,role,influence,position,is_decision_maker").eq("account_id", opportunity.account_id),
    supabase.from("proposals").select("version,monthly_fee,status,change_reason,sent_at").eq("opportunity_id", opportunity.id).order("version"),
    supabase.from("tasks").select("title,due_at,status,outcome").eq("opportunity_id", opportunity.id).order("due_at", { ascending: false }).limit(12)
  ]);
  const { data: armAgent } = await supabase.from("arm_agents").select("id,name,system_instructions").eq("slug", "coach-comercial").in("status", ["activo", "piloto"]).maybeSingle();
  const logInteraction = async (output: z.infer<typeof responseSchema>, metadata: Record<string, unknown> = {}) => {
    if (!armAgent?.id) return;
    const { error: logError } = await supabase.from("arm_interactions").insert({
      agent_id: armAgent.id, opportunity_id: opportunity.id, initiated_by: authData.user.id,
      interaction_type: "consulta_coach", input_summary: parsed.data.question,
      output_summary: `${output.summary} Próximo paso: ${output.nextAction}`,
      decision_status: "recomendacion", requires_approval: false,
      metadata: { recommendations: output.recommendations, questions: output.questions, risk: output.risk, ...metadata }
    });
    if (logError) console.error("arm-interaction-log", logError);
  };
  try {
    const { output } = await generateText({
      model: gateway("openai/gpt-5-mini"),
      output: Output.object({ schema: responseSchema }),
      instructions: `${armAgent?.system_instructions ?? ""}\nEres coach de ventas B2B consultivas para INDEX CONDO, empresa de administración de condominios en República Dominicana. Responde en español claro. Usa solo la evidencia aportada, distingue hechos de hipótesis y propone acciones éticas, concretas y medibles. Nunca inventes urgencia, ahorros, testimonios ni autoridad de decisión. No recomiendes manipulación psicológica, hostigamiento ni descuentos sin contraprestación.`,
      prompt: `Consulta del vendedor: ${parsed.data.question}\n\nContexto CRM verificable:\n${JSON.stringify({ opportunity, stakeholders, proposals, tasks })}`
    });
    if (output) await logInteraction(output, { source: "ai_gateway" });
    return NextResponse.json(output);
  } catch (error) {
    console.error("coach-ai-gateway", error);
    const accountName = opportunity.accounts?.name ?? "esta oportunidad";
    const nextAction = opportunity.next_action?.trim() || "Confirmar con el responsable humano el próximo paso y su fecha objetivo.";
    const fallback = responseSchema.parse({
      summary: `Modo de continuidad ARM para ${accountName}: el modelo externo no respondió, por lo que esta orientación usa únicamente los datos verificados del CRM.`,
      recommendations: [
        `Validar que el próximo paso registrado siga vigente: ${nextAction}`,
        "Confirmar responsable, fecha y evidencia esperada antes de mover la oportunidad de etapa.",
        "Registrar el resultado de la gestión para que la siguiente recomendación tenga contexto actualizado."
      ],
      questions: [
        "¿Qué evidencia confirma que la etapa actual está completa?",
        "¿Quién debe validar el próximo paso y en qué fecha?"
      ],
      risk: "La orientación de continuidad no sustituye el análisis del modelo; una persona debe revisar el expediente antes de decidir o comunicarse con el cliente.",
      nextAction
    });
    await logInteraction(fallback, { source: "rules_fallback", provider_status: "unavailable" });
    return NextResponse.json({ ...fallback, degraded: true });
  }
}
