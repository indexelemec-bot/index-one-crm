"use client";

import { Activity, Bot, Check, CircleGauge, GitBranch, Network, Pause, Play, Plus, ShieldCheck, UserCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCrm } from "@/components/crm-provider";
import { EmptyState, Modal, PageHeader } from "@/components/ui";
import { armAutonomyLabels, armDecisionLabels, armStatusLabels, summarizeArm } from "@/lib/arm";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { mapArmAgent, mapArmAssignment, mapArmInteraction } from "@/lib/supabase/mappers";
import type { ArmAgent, ArmAgentAssignment, ArmAutonomyLevel, ArmInteraction } from "@/types/domain";

const managerRoles = ["superadmin", "gerencia_comercial"];
const capabilityLabels: Record<string, string> = {
  coordinar_agentes: "Coordinar agentes", priorizar_oportunidades: "Priorizar oportunidades", crear_handoffs: "Crear transferencias",
  analizar_oportunidad: "Analizar oportunidad", recomendar_proximo_paso: "Recomendar próximos pasos", detectar_riesgos: "Detectar riesgos",
  calcular_salud: "Calcular salud", detectar_bloqueos: "Detectar bloqueos", comparar_historial: "Comparar historial",
  preparar_borrador: "Preparar borradores", validar_propuesta: "Validar propuestas", comparar_versiones: "Comparar versiones",
  sugerir_seguimiento: "Sugerir seguimiento", detectar_inactividad: "Detectar inactividad", proponer_mensaje: "Proponer mensajes",
  identificar_agente_externo: "Identificar agente externo", intercambiar_datos_autorizados: "Intercambiar datos autorizados", escalar_a_humano: "Escalar a una persona"
};

type AgentForm = { name: string; roleKey: string; description: string; autonomyLevel: ArmAutonomyLevel; riskLevel: "bajo" | "medio" | "alto"; capabilities: string; channels: string; instructions: string };
const initialAgentForm: AgentForm = { name: "", roleKey: "", description: "", autonomyLevel: "asesor", riskLevel: "bajo", capabilities: "", channels: "crm", instructions: "" };

export default function AgentesPage() {
  const { opportunities, accounts, users, currentUser } = useCrm();
  const [agents, setAgents] = useState<ArmAgent[]>([]);
  const [assignments, setAssignments] = useState<ArmAgentAssignment[]>([]);
  const [interactions, setInteractions] = useState<ArmInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [agentModal, setAgentModal] = useState(false);
  const [assignmentModal, setAssignmentModal] = useState(false);
  const [form, setForm] = useState<AgentForm>(initialAgentForm);
  const [assignment, setAssignment] = useState({ agentId: "", opportunityId: "", relationshipRole: "apoyo" as ArmAgentAssignment["relationshipRole"], notes: "" });
  const manager = managerRoles.includes(currentUser.role);

  const loadArm = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }
    setLoading(true); setError("");
    const [agentsResult, assignmentsResult, interactionsResult] = await Promise.all([
      supabase.from("arm_agents").select("*").order("name"),
      supabase.from("arm_agent_assignments").select("*").order("assigned_at", { ascending: false }),
      supabase.from("arm_interactions").select("*").order("created_at", { ascending: false }).limit(80)
    ]);
    const failure = agentsResult.error ?? assignmentsResult.error ?? interactionsResult.error;
    if (failure) setError(failure.message);
    else {
      setAgents((agentsResult.data ?? []).map(mapArmAgent));
      setAssignments((assignmentsResult.data ?? []).map(mapArmAssignment));
      setInteractions((interactionsResult.data ?? []).map(mapArmInteraction));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadArm(); }, [loadArm]);
  const metrics = useMemo(() => summarizeArm(agents, assignments, interactions), [agents, assignments, interactions]);
  const pending = interactions.filter((item) => item.decisionStatus === "pendiente_aprobacion");
  const activeAgents = agents.filter((item) => item.status === "activo" || item.status === "piloto");

  function accountName(opportunityId?: string) {
    const opportunity = opportunities.find((item) => item.id === opportunityId);
    return accounts.find((item) => item.id === opportunity?.accountId)?.name ?? "Sin oportunidad";
  }

  async function saveAgent(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    const slug = form.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { error: saveError } = await supabase.from("arm_agents").insert({
      name: form.name.trim(), slug, kind: "interno", role_key: form.roleKey.trim(), description: form.description.trim(),
      status: "borrador", autonomy_level: form.autonomyLevel, risk_level: form.riskLevel, requires_human_approval: true,
      capabilities: form.capabilities.split(",").map((item) => item.trim()).filter(Boolean),
      allowed_channels: form.channels.split(",").map((item) => item.trim()).filter(Boolean),
      system_instructions: form.instructions.trim() || null, owner_id: currentUser.id, created_by: currentUser.id
    });
    if (saveError) { setError(saveError.message); return; }
    setForm(initialAgentForm); setAgentModal(false); setNotice("Agente creado en borrador. Debe probarse antes de activarlo."); void loadArm();
  }

  async function toggleAgent(agent: ArmAgent) {
    const supabase = createClient(); if (!supabase) return;
    const nextStatus = agent.status === "activo" || agent.status === "piloto" ? "pausado" : "piloto";
    const { error: updateError } = await supabase.from("arm_agents").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", agent.id);
    if (updateError) { setError(updateError.message); return; }
    setNotice(nextStatus === "pausado" ? `${agent.name} quedó pausado.` : `${agent.name} inició un piloto controlado.`); void loadArm();
  }

  async function saveAssignment(event: React.FormEvent) {
    event.preventDefault(); const supabase = createClient(); if (!supabase) return;
    const { error: assignmentError } = await supabase.from("arm_agent_assignments").upsert({
      agent_id: assignment.agentId, opportunity_id: assignment.opportunityId, relationship_role: assignment.relationshipRole,
      status: "activa", notes: assignment.notes.trim() || null, assigned_by: currentUser.id, updated_at: new Date().toISOString()
    }, { onConflict: "agent_id,opportunity_id" });
    if (assignmentError) { setError(assignmentError.message); return; }
    setAssignment({ agentId: "", opportunityId: "", relationshipRole: "apoyo", notes: "" }); setAssignmentModal(false);
    setNotice("Agente asignado a la oportunidad con supervisión humana."); void loadArm();
  }

  async function decide(interaction: ArmInteraction, approved: boolean) {
    const supabase = createClient(); if (!supabase) return;
    const { error: decisionError } = await supabase.from("arm_interactions").update({
      decision_status: approved ? "aprobada" : "rechazada", approved_by: currentUser.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq("id", interaction.id);
    if (decisionError) { setError(decisionError.message); return; }
    setNotice(approved ? "Recomendación aprobada. Aún debe ejecutarse desde el flujo correspondiente." : "Recomendación rechazada y registrada."); void loadArm();
  }

  return <>
    <PageHeader eyebrow="Gobierno de inteligencia" title="ARM · Agent Relationship Management" description="Administra identidades, funciones, permisos, relaciones y resultados de los agentes de IA que colaboran con el equipo comercial.">
      {manager && <><button className="button" onClick={() => setAssignmentModal(true)}><GitBranch size={16}/> Asignar agente</button><button className="button button-primary" onClick={() => setAgentModal(true)}><Plus size={16}/> Nuevo agente</button></>}
    </PageHeader>
    <section className="card arm-definition"><div className="arm-definition-icon"><Network size={28}/></div><div><h2>CRM gestiona clientes; ARM gobierna agentes</h2><p>El ARM identifica cada agente, limita lo que puede ver y hacer, registra sus decisiones, coordina transferencias con otros agentes y obliga a escalar a una persona cuando hay precio, contrato, datos sensibles o comunicación externa.</p></div><span className="status-pill status-active"><ShieldCheck size={13}/> Humano al mando</span></section>
    {error && <div className="sync-banner sync-error">{error}</div>}{notice && <div className="sync-banner">{notice}</div>}
    <div className="grid kpi-grid"><ArmKpi icon={<Bot/>} label="Agentes operativos" value={String(metrics.activeAgents)} foot="Activos o en piloto"/><ArmKpi icon={<Network/>} label="Oportunidades cubiertas" value={String(metrics.coveredOpportunities)} foot="Con relación ARM activa"/><ArmKpi icon={<UserCheck/>} label="Aprobaciones pendientes" value={String(metrics.pendingApprovals)} foot="Requieren decisión humana"/><ArmKpi icon={<CircleGauge/>} label="Ejecuciones exitosas" value={`${metrics.successRate}%`} foot="Sobre acciones terminadas"/></div>
    <section className="arm-governance-grid"><article className="card card-pad"><h2>Reglas de operación</h2><ol className="arm-rules"><li><b>Identidad verificable</b><span>Cada agente tiene nombre, función, propietario y estado.</span></li><li><b>Mínimo acceso</b><span>Solo recibe datos y canales necesarios para su tarea.</span></li><li><b>Aprobación proporcional al riesgo</b><span>Precio, propuestas, contratos y envíos siempre escalan.</span></li><li><b>Trazabilidad completa</b><span>Entrada, recomendación, aprobación, ejecución y resultado quedan registrados.</span></li></ol></article><article className="card card-pad"><h2>Relaciones que administra</h2><div className="arm-relations"><span><Bot size={18}/><b>Agente ↔ vendedor</b><small>Apoya y entrega decisiones al responsable humano.</small></span><span><Network size={18}/><b>Agente ↔ agente</b><small>Coordina especialidades y evita acciones duplicadas.</small></span><span><UserCheck size={18}/><b>Agente ↔ cliente</b><small>Solo mediante canales autorizados y con registro.</small></span></div></article></section>
    <section className="academy-library-head"><div><span className="eyebrow">Registro central</span><h2>Agentes de INDEX CONDO</h2><p>Cada tarjeta define su autonomía, riesgo, capacidades y canales permitidos.</p></div><span className="speech-count">{agents.length} agentes</span></section>
    {loading ? <div className="empty-state"><b>Cargando ecosistema ARM…</b></div> : <div className="arm-agent-grid">{agents.map((agent) => <article className="card arm-agent-card" key={agent.id}><div className="arm-agent-head"><span className={`arm-agent-avatar arm-risk-${agent.riskLevel}`}><Bot size={22}/></span><div><h3>{agent.name}</h3><small>{agent.roleKey.replaceAll("_", " ")}</small></div><span className={`status-pill arm-status-${agent.status}`}>{armStatusLabels[agent.status]}</span></div><p>{agent.description}</p><div className="arm-agent-facts"><span><small>AUTONOMÍA</small><b>{armAutonomyLabels[agent.autonomyLevel]}</b></span><span><small>RIESGO</small><b>{agent.riskLevel}</b></span><span><small>CANALES</small><b>{agent.allowedChannels.join(" · ") || "Ninguno"}</b></span></div><div className="arm-capabilities">{agent.capabilities.map((capability) => <span key={capability}>{capabilityLabels[capability] ?? capability.replaceAll("_", " ")}</span>)}</div><footer><span><ShieldCheck size={14}/> {agent.requiresHumanApproval ? "Aprobación humana requerida" : "Solo recomendación"}</span>{manager && <button className="button compact" onClick={() => toggleAgent(agent)}>{agent.status === "activo" || agent.status === "piloto" ? <><Pause size={14}/> Pausar</> : <><Play size={14}/> Iniciar piloto</>}</button>}</footer></article>)}</div>}
    <div className="arm-operations-grid"><section className="card"><div className="section-head"><div><h2>Agentes asignados</h2><p>Relación entre agente, oportunidad y responsable comercial.</p></div></div><div className="table-wrap"><table className="table"><thead><tr><th>Agente</th><th>Prospecto</th><th>Función</th><th>Asignado por</th><th>Estado</th></tr></thead><tbody>{assignments.map((item) => <tr key={item.id}><td><strong>{agents.find((agent) => agent.id === item.agentId)?.name ?? "Agente"}</strong></td><td><strong>{accountName(item.opportunityId)}</strong></td><td>{item.relationshipRole}</td><td>{users.find((user) => user.id === item.assignedBy)?.fullName ?? "Usuario"}</td><td><span className="status-pill status-active">{item.status}</span></td></tr>)}</tbody></table>{assignments.length === 0 && <EmptyState title="Sin asignaciones" description="Asigna un agente a una oportunidad para iniciar una relación ARM supervisada."/>}</div></section><section className="card"><div className="section-head"><div><h2>Cola de aprobación</h2><p>Ningún agente ejecuta una decisión sensible sin control humano.</p></div></div><div className="arm-approval-list">{pending.map((item) => <article key={item.id}><div><b>{agents.find((agent) => agent.id === item.agentId)?.name ?? "Agente"}</b><small>{accountName(item.opportunityId)} · {new Date(item.createdAt).toLocaleString("es-DO")}</small><p>{item.outputSummary ?? item.inputSummary}</p></div>{manager && <span><button className="icon-button arm-approve" onClick={() => decide(item, true)} aria-label="Aprobar"><Check size={17}/></button><button className="icon-button arm-reject" onClick={() => decide(item, false)} aria-label="Rechazar"><X size={17}/></button></span>}</article>)}{pending.length === 0 && <EmptyState title="Sin decisiones pendientes" description="Las futuras acciones sensibles aparecerán aquí antes de ejecutarse."/>}</div></section></div>
    <section className="card arm-audit"><div className="section-head"><div><h2>Registro auditable</h2><p>Consultas, recomendaciones, aprobaciones y resultados de todos los agentes.</p></div><Activity size={20}/></div><div className="table-wrap"><table className="table"><thead><tr><th>Fecha</th><th>Agente</th><th>Oportunidad</th><th>Interacción</th><th>Decisión</th><th>Confianza</th></tr></thead><tbody>{interactions.map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString("es-DO")}</td><td><strong>{agents.find((agent) => agent.id === item.agentId)?.name ?? "Agente"}</strong></td><td>{accountName(item.opportunityId)}</td><td><strong>{item.interactionType.replaceAll("_", " ")}</strong><small>{item.outputSummary ?? item.inputSummary}</small></td><td><span className={`status-pill arm-decision-${item.decisionStatus}`}>{armDecisionLabels[item.decisionStatus]}</span></td><td>{item.confidenceScore === undefined ? "—" : `${item.confidenceScore}%`}</td></tr>)}</tbody></table>{interactions.length === 0 && <EmptyState title="Aún no hay actividad" description="Las consultas al Coach IA empezarán a alimentar este historial."/>}</div></section>
    {agentModal && <Modal title="Crear agente ARM" description="El agente se crea en borrador y no puede actuar hasta iniciar un piloto." onClose={() => setAgentModal(false)}><form onSubmit={saveAgent}><div className="form-grid"><label className="field"><span>Nombre</span><input required minLength={3} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label><label className="field"><span>Función interna</span><input required minLength={3} placeholder="ej. analisis_financiero" value={form.roleKey} onChange={(event) => setForm({ ...form, roleKey: event.target.value })}/></label><label className="field field-wide"><span>Descripción</span><textarea required minLength={12} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></label><label className="field"><span>Autonomía</span><select value={form.autonomyLevel} onChange={(event) => setForm({ ...form, autonomyLevel: event.target.value as ArmAutonomyLevel })}><option value="asesor">Solo recomienda</option><option value="supervisado">Actúa con aprobación</option><option value="acotado">Autonomía limitada</option></select></label><label className="field"><span>Riesgo</span><select value={form.riskLevel} onChange={(event) => setForm({ ...form, riskLevel: event.target.value as AgentForm["riskLevel"] })}><option value="bajo">Bajo</option><option value="medio">Medio</option><option value="alto">Alto</option></select></label><label className="field field-wide"><span>Capacidades separadas por coma</span><input required value={form.capabilities} onChange={(event) => setForm({ ...form, capabilities: event.target.value })}/></label><label className="field"><span>Canales permitidos</span><input value={form.channels} onChange={(event) => setForm({ ...form, channels: event.target.value })}/></label><label className="field field-wide"><span>Instrucciones y límites</span><textarea value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })}/></label></div><div className="form-actions"><button type="button" className="button" onClick={() => setAgentModal(false)}>Cancelar</button><button className="button button-primary"><ShieldCheck size={16}/> Crear borrador</button></div></form></Modal>}
    {assignmentModal && <Modal title="Asignar agente" description="Crea una relación supervisada entre un agente y una oportunidad." onClose={() => setAssignmentModal(false)}><form onSubmit={saveAssignment}><div className="form-grid"><label className="field"><span>Agente</span><select required value={assignment.agentId} onChange={(event) => setAssignment({ ...assignment, agentId: event.target.value })}><option value="">Selecciona…</option>{activeAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label><label className="field"><span>Oportunidad</span><select required value={assignment.opportunityId} onChange={(event) => setAssignment({ ...assignment, opportunityId: event.target.value })}><option value="">Selecciona…</option>{opportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{accountName(opportunity.id)}</option>)}</select></label><label className="field"><span>Relación</span><select value={assignment.relationshipRole} onChange={(event) => setAssignment({ ...assignment, relationshipRole: event.target.value as ArmAgentAssignment["relationshipRole"] })}><option value="principal">Principal</option><option value="apoyo">Apoyo</option><option value="revision">Revisión</option><option value="escalamiento">Escalamiento</option></select></label><label className="field field-wide"><span>Alcance o notas</span><textarea value={assignment.notes} onChange={(event) => setAssignment({ ...assignment, notes: event.target.value })}/></label></div><div className="form-actions"><button type="button" className="button" onClick={() => setAssignmentModal(false)}>Cancelar</button><button className="button button-primary"><GitBranch size={16}/> Asignar</button></div></form></Modal>}
  </>;
}

function ArmKpi({ icon, label, value, foot }: { icon: React.ReactNode; label: string; value: string; foot: string }) {
  return <article className="card kpi-card"><div className="kpi-top"><span className="kpi-label">{label}</span><span className="kpi-icon">{icon}</span></div><div className="kpi-value">{value}</div><div className="kpi-foot">{foot}</div></article>;
}
