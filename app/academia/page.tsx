"use client";
import { BookOpenCheck, CalendarClock, Check, CheckCircle2, Clipboard, MessageCircleQuestion, ShieldCheck, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui";
import { salesTechniques, stagePlaybook } from "@/lib/sales-playbook";
import { salesSpeeches } from "@/lib/sales-speeches";
import { pipelineStages, stageLabels } from "@/lib/constants";
import type { OpportunityStage } from "@/types/domain";

export default function AcademiaPage() {
  const [query, setQuery] = useState(""); const [stage, setStage] = useState<"all" | OpportunityStage>("all"); const [copied, setCopied] = useState("");
  const speeches = useMemo(() => salesSpeeches.filter((item) => (stage === "all" || item.stage === stage) && `${item.title} ${item.body} ${item.cta} ${stageLabels[item.stage]}`.toLowerCase().includes(query.toLowerCase())), [query, stage]);
  const techniques = useMemo(() => salesTechniques.filter((item) => `${item.title} ${item.summary} ${item.whenToUse}`.toLowerCase().includes(query.toLowerCase())), [query]);
  async function copy(id: string, text: string) { await navigator.clipboard.writeText(text); setCopied(id); window.setTimeout(() => setCopied(""), 1600); }

  return <><PageHeader eyebrow="Formación continua" title="Academia Comercial B2B" description="Guiones por etapa y técnicas consultivas para generar decisiones claras, sostenibles y sin presión engañosa."/>
    <div className="sync-banner"><CalendarClock size={16}/> Revisión bimestral automatizada: la IA analiza uso de speeches, resultados, tareas y cierres; genera un borrador que gerencia debe aprobar antes de publicar cambios.</div>
    <section className="academy-principles card"><div><ShieldCheck size={30}/><span><b>Persuasión ética</b><small>Claridad, evidencia, escucha y reciprocidad. Nunca urgencia falsa, promesas inventadas ni manipulación.</small></span></div><div><Target size={30}/><span><b>Resultado compartido</b><small>El cierre correcto ocurre cuando la solución resuelve un problema real y ambas partes conocen el próximo paso.</small></span></div></section>
    <section className="card stage-roadmap"><div className="section-head"><div><h2>Guía de ejecución por etapa</h2><p>Objetivo, acciones y criterio de avance para que cada vendedor sepa qué hacer.</p></div></div><div className="roadmap-scroll">{pipelineStages.map((item) => <article key={item}><span>{stageLabels[item]}</span><b>{stagePlaybook[item].objective}</b><small>{stagePlaybook[item].exitCriteria.join(" · ")}</small></article>)}</div></section>
    <div className="toolbar academy-search"><label className="search"><BookOpenCheck size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar speech, etapa, técnica o situación…"/></label><select className="filter-select" value={stage} onChange={(event) => setStage(event.target.value as "all" | OpportunityStage)}><option value="all">Todas las etapas</option>{pipelineStages.map((item) => <option value={item} key={item}>{stageLabels[item]}</option>)}</select></div>
    <section className="academy-library-head"><div><span className="eyebrow">Biblioteca aplicable</span><h2>Speeches por etapa</h2><p>Adapta los campos entre corchetes al contexto real del cliente. En el embudo se personalizan automáticamente.</p></div><span className="speech-count">{speeches.length} guiones</span></section>
    <div className="speech-academy-grid">{speeches.map((item) => <article className="card academy-speech" key={item.id}><div className="speech-card-head"><span className="stage-pill">{stageLabels[item.stage]}</span><span>{item.channel}</span></div><h3>{item.title}</h3><p>{item.body}</p><div className="speech-cta"><Target size={14}/><span><b>Cierre esperado</b>{item.cta}</span></div><button className="button compact" onClick={() => copy(item.id, `${item.body}\n\nCierre esperado: ${item.cta}`)}>{copied === item.id ? <Check size={14}/> : <Clipboard size={14}/>} {copied === item.id ? "Copiado" : "Copiar guion"}</button></article>)}</div>
    <section className="academy-library-head techniques-heading"><div><span className="eyebrow">Fundamentos</span><h2>Técnicas de venta consultiva</h2></div></section>
    <div className="academy-grid">{techniques.map((technique) => <article className="card technique-card" id={technique.id} key={technique.id}><div className="technique-tag">{technique.category}</div><h2>{technique.title}</h2><p>{technique.summary}</p><div className="technique-block"><b><Target size={15}/> Cuándo usarla</b><span>{technique.whenToUse}</span></div><div className="technique-block"><b><CheckCircle2 size={15}/> Aplicación</b><ol>{technique.steps.map((step) => <li key={step}>{step}</li>)}</ol></div><div className="technique-block"><b><MessageCircleQuestion size={15}/> Preguntas útiles</b><ul>{technique.questions.map((question) => <li key={question}>{question}</li>)}</ul></div><blockquote>{technique.example}</blockquote><small className="ethical-note"><ShieldCheck size={14}/>{technique.caution}</small></article>)}</div>
  </>;
}
