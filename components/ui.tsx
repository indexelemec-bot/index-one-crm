"use client";
import { X } from "lucide-react";
import type { OpportunityStage } from "@/types/domain";
import { stageLabels } from "@/lib/constants";

export function PageHeader({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description: string; children?: React.ReactNode }) { return <div className="page-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>{children && <div className="page-actions">{children}</div>}</div>; }
export function StagePill({ stage }: { stage: OpportunityStage }) { return <span className={`stage-pill stage-${stage}`}>{stageLabels[stage]}</span>; }
export function Modal({ title, description, onClose, children, wide = false }: { title: string; description?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) { return <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={onClose} aria-label="Cerrar"/><section className={`modal ${wide ? "modal-wide" : ""}`}><header><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={20}/></button></header>{children}</section></div>; }
export function EmptyState({ title, description }: { title: string; description: string }) { return <div className="empty-state"><b>{title}</b><p>{description}</p></div>; }
