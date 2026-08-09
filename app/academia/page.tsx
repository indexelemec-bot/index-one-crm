"use client";
import { BookOpenCheck, CheckCircle2, MessageCircleQuestion, ShieldCheck, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui";
import { salesTechniques, stagePlaybook } from "@/lib/sales-playbook";
import { pipelineStages, stageLabels } from "@/lib/constants";

export default function AcademiaPage() {
  const [query, setQuery] = useState("");
  const techniques = useMemo(() => salesTechniques.filter((item) => `${item.title} ${item.summary} ${item.whenToUse}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <><PageHeader eyebrow="Formación continua" title="Academia Comercial B2B" description="Venta consultiva para comprender el negocio del cliente, aportar valor y construir decisiones sostenibles sin presión engañosa." />
    <section className="academy-principles card"><div><ShieldCheck size={30}/><span><b>Persuasión ética</b><small>Claridad, evidencia, escucha y reciprocidad. Nunca urgencia falsa, promesas inventadas ni manipulación.</small></span></div><div><Target size={30}/><span><b>Resultado compartido</b><small>El cierre correcto ocurre cuando la solución resuelve un problema real y ambas partes conocen el próximo paso.</small></span></div></section>
    <section className="card stage-roadmap"><div className="section-head"><div><h2>Guía de ejecución por etapa</h2><p>Objetivo, acciones y criterio de avance para que cada vendedor sepa qué hacer.</p></div></div><div className="roadmap-scroll">{pipelineStages.map((stage)=><article key={stage}><span>{stageLabels[stage]}</span><b>{stagePlaybook[stage].objective}</b><small>{stagePlaybook[stage].exitCriteria.join(" · ")}</small></article>)}</div></section>
    <div className="toolbar academy-search"><label className="search"><BookOpenCheck size={18}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar técnica, situación o concepto…"/></label></div>
    <div className="academy-grid">{techniques.map((technique)=><article className="card technique-card" id={technique.id} key={technique.id}><div className="technique-tag">{technique.category}</div><h2>{technique.title}</h2><p>{technique.summary}</p><div className="technique-block"><b><Target size={15}/> Cuándo usarla</b><span>{technique.whenToUse}</span></div><div className="technique-block"><b><CheckCircle2 size={15}/> Aplicación</b><ol>{technique.steps.map((step)=><li key={step}>{step}</li>)}</ol></div><div className="technique-block"><b><MessageCircleQuestion size={15}/> Preguntas útiles</b><ul>{technique.questions.map((question)=><li key={question}>{question}</li>)}</ul></div><blockquote>{technique.example}</blockquote><small className="ethical-note"><ShieldCheck size={14}/>{technique.caution}</small></article>)}</div>
  </>;
}
