"use client";
import { Bot, Lightbulb, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui";

type Advice = { summary: string; recommendations: string[]; questions: string[]; risk: string; nextAction: string };

export function AiSalesCoach({ opportunityId, clientName, onClose }: { opportunityId: string; clientName: string; onClose: () => void }) {
  const [question, setQuestion] = useState("¿Qué debo hacer ahora para avanzar esta oportunidad de forma efectiva?"); const [advice, setAdvice] = useState<Advice>(); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function ask(event: React.FormEvent) { event.preventDefault(); setLoading(true); setError(""); const response = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId, question }) }); const result = await response.json().catch(() => ({})); setLoading(false); if (!response.ok) { setError(result.error ?? "No fue posible consultar al asistente."); return; } setAdvice(result); }
  return <Modal title={`Coach IA · ${clientName}`} description="Consulta el expediente comercial completo para recomendar próximos pasos basados en evidencia." onClose={onClose} wide><form onSubmit={ask}><label className="field"><span>¿Qué deseas analizar?</span><textarea value={question} onChange={(event) => setQuestion(event.target.value)} required/></label><div className="form-actions"><button className="button button-primary" disabled={loading}><Bot size={16}/>{loading ? "Analizando expediente…" : "Obtener recomendación"}</button></div></form>{error && <div className="sync-banner sync-error">{error}</div>}{advice && <div className="ai-advice"><div className="coach-title"><Lightbulb size={20}/><div><small>LECTURA DEL CASO</small><h2>{advice.summary}</h2></div></div><section><b>Acciones recomendadas</b><ol>{advice.recommendations.map((item) => <li key={item}>{item}</li>)}</ol></section><section><b>Preguntas útiles al cliente</b><ul>{advice.questions.map((item) => <li key={item}>{item}</li>)}</ul></section><div className="problem-box"><small>RIESGO A VIGILAR</small><p>{advice.risk}</p></div><div className="formal-note"><ShieldCheck size={16}/><span><b>Próximo paso sugerido:</b> {advice.nextAction}</span></div></div>}</Modal>;
}
