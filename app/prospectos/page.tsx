"use client";
import Link from "next/link";
import { AlertTriangle, Building2, Download, FileSpreadsheet, Plus, Search, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCrm } from "@/components/crm-provider";
import { Modal, PageHeader, StagePill } from "@/components/ui";
import { accountTypeLabels, formatCurrency } from "@/lib/constants";
import { calculateOpportunityScore } from "@/lib/opportunity-score";
import { buildImportPreview, downloadProspectTemplate, exportProspectsToExcel, readProspectFile, type ProspectImportPreview } from "@/lib/prospect-spreadsheet";
import { accountSchema } from "@/lib/validation";
import type { AccountType } from "@/types/domain";

export default function ProspectosPage() {
  const { accounts, opportunities, stakeholders, proposals, tasks, addProspect, currentUser, users } = useCrm();
  const [open,setOpen]=useState(false);
  const [importOpen,setImportOpen]=useState(false);
  const [query,setQuery]=useState("");
  const [type,setType]=useState("todos");
  const [status,setStatus]=useState("activos");
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [importRows,setImportRows]=useState<ProspectImportPreview[]>([]);
  const [importFileName,setImportFileName]=useState("");
  const [importError,setImportError]=useState("");
  const [importing,setImporting]=useState(false);
  const [exporting,setExporting]=useState(false);
  const fileInput=useRef<HTMLInputElement>(null);

  useEffect(()=>{if(new URLSearchParams(window.location.search).get("nuevo")) setOpen(true)},[]);

  const rows=useMemo(()=>accounts.filter((account)=>{
    const opportunity=opportunities.find((item)=>item.accountId===account.id);
    const isDiscarded=opportunity?.stage==="perdida";
    const isConverted=opportunity?.stage==="contrato_transicion"||opportunity?.stage==="cliente_activo";
    const matchesStatus=status==="todos"
      ? !isConverted
      : status==="descartados"
        ? isDiscarded
        : !isDiscarded&&!isConverted;
    return account.name.toLowerCase().includes(query.toLowerCase())&&(type==="todos"||account.accountType===type)&&matchesStatus;
  }),[accounts,opportunities,query,type,status]);

  const validImports=importRows.filter((row)=>row.errors.length===0&&!row.duplicate);
  const duplicateImports=importRows.filter((row)=>row.duplicate).length;
  const errorImports=importRows.filter((row)=>row.errors.length>0).length;

  function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    const form=new FormData(e.currentTarget);
    const values=Object.fromEntries(form);
    const parsed=accountSchema.safeParse(values);
    if(!parsed.success){setErrors(Object.fromEntries(parsed.error.issues.map((i)=>[String(i.path[0]),i.message])));return}
    const now=Date.now().toString();
    const accountId=`a${now}`;
    const opportunityId=`o${now}`;
    addProspect({
      account:{id:accountId,name:parsed.data.name,accountType:parsed.data.accountType as AccountType,address:String(values.address||""),sector:parsed.data.sector,city:"Santo Domingo",units:parsed.data.units,towers:Number(values.towers||1),profile:String(values.profile||"familiar"),ownerId:currentUser.id,source:String(values.source||"Directo"),createdAt:new Date().toISOString()},
      stakeholder:{id:`s${now}`,accountId,fullName:parsed.data.stakeholderName,role:"presidente",phone:String(values.phone||""),email:parsed.data.stakeholderEmail,influence:5,position:"unknown",isDecisionMaker:true},
      opportunity:{id:opportunityId,accountId,stage:"prospecto_identificado",primaryProblem:parsed.data.primaryProblem,impact:"Pendiente de diagnóstico",proposedSolution:"Pendiente de diagnóstico",monthlyFee:0,probability:15,nextAction:parsed.data.nextAction,nextActionAt:new Date(parsed.data.nextActionAt).toISOString(),ownerId:currentUser.id,updatedAt:new Date().toISOString()}
    });
    setOpen(false);setErrors({});
  }

  async function selectImportFile(file?:File){
    if(!file)return;
    setImportError("");setImportRows([]);setImportFileName(file.name);
    try{
      const parsed=await readProspectFile(file);
      const preview=buildImportPreview(parsed,accounts,stakeholders);
      if(preview.length===0){setImportError("El archivo no contiene filas de prospectos para importar.");return}
      setImportRows(preview);
    }catch(error){
      setImportError(error instanceof Error?error.message:"No fue posible leer el archivo. Usa Excel .xlsx o CSV.");
    }
  }

  function importProspects(){
    if(validImports.length===0)return;
    setImporting(true);
    const now=new Date().toISOString();
    validImports.forEach((row)=>{
      const accountId=crypto.randomUUID();
      addProspect({
        account:{id:accountId,name:row.accountName,accountType:row.accountType,address:"",sector:row.sector,city:"Santo Domingo",units:row.units,towers:1,profile:"familiar",ownerId:currentUser.id,source:row.source,createdAt:now},
        stakeholder:{id:crypto.randomUUID(),accountId,fullName:row.contactName,role:"otro",phone:row.phone,email:row.email,influence:3,position:"unknown",isDecisionMaker:true},
        opportunity:{id:crypto.randomUUID(),accountId,stage:row.stage,primaryProblem:row.primaryProblem,impact:"Pendiente de diagnóstico",proposedSolution:"Pendiente de diagnóstico",monthlyFee:row.monthlyFee,probability:row.stage==="perdida"?0:15,nextAction:row.nextAction,nextActionAt:row.nextActionAt,ownerId:currentUser.id,updatedAt:now}
      });
    });
    setTimeout(()=>{setImporting(false);setImportOpen(false);setImportRows([]);setImportFileName("");},300);
  }

  async function exportRows(){
    setExporting(true);
    try{
      await exportProspectsToExcel(rows.map((account)=>{
        const opportunity=opportunities.find((item)=>item.accountId===account.id);
        const stakeholder=stakeholders.find((item)=>item.accountId===account.id&&item.isDecisionMaker)??stakeholders.find((item)=>item.accountId===account.id);
        const owner=users.find((item)=>item.id===opportunity?.ownerId);
        return {account,stakeholder,opportunity,owner};
      }));
    }finally{setExporting(false)}
  }

  function closeImport(){setImportOpen(false);setImportRows([]);setImportFileName("");setImportError("");}

  return <>
    <PageHeader eyebrow="Cuentas B2B" title="Prospectos y cuentas" description="Gestiona únicamente prospectos en gestión comercial y descartados. Los clientes que pasan a contrato o cliente activo salen automáticamente de esta lista sin perder su historial.">
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button className="button" onClick={()=>setImportOpen(true)}><Upload size={18}/> Importar prospectos</button>
        <button className="button" onClick={()=>void exportRows()} disabled={exporting||rows.length===0}><Download size={18}/> {exporting?"Generando…":"Exportar a Excel"}</button>
        <button className="button button-primary" onClick={()=>setOpen(true)}><Plus size={18}/> Registrar prospecto</button>
      </div>
    </PageHeader>

    <div className="toolbar">
      <label className="search"><Search size={18}/><input placeholder="Buscar por nombre del condominio…" value={query} onChange={(e)=>setQuery(e.target.value)}/></label>
      <select className="filter-select" value={status} onChange={(e)=>setStatus(e.target.value)}><option value="activos">Prospectos activos</option><option value="descartados">Prospectos descartados</option><option value="todos">Todos los prospectos</option></select>
      <select className="filter-select" value={type} onChange={(e)=>setType(e.target.value)}><option value="todos">Todos los segmentos</option>{Object.entries(accountTypeLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select>
    </div>

    <div className="card table-wrap"><table className="table"><thead><tr><th>Cliente potencial</th><th>Segmento</th><th>Unidades</th><th>Necesidad principal</th><th>Etapa</th><th>Probabilidad</th><th>{status==="descartados"?"Próximo seguimiento":"Valor mensual"}</th></tr></thead><tbody>{rows.map((account)=>{const opportunity=opportunities.find((o)=>o.accountId===account.id);const score=opportunity?calculateOpportunityScore(opportunity,stakeholders,proposals,tasks).score:0;return <tr key={account.id}><td><Link className="account-name" href={`/prospectos/${account.id}`}><span className="account-icon"><Building2 size={18}/></span><span><strong>{account.name}</strong><small>{account.sector} · {account.source}</small></span></Link></td><td>{accountTypeLabels[account.accountType]}</td><td>{account.units}</td><td>{opportunity?.primaryProblem}</td><td>{opportunity&&<StagePill stage={opportunity.stage}/>}</td><td><b>{opportunity?.stage==="perdida"?0:score}%</b><div className="progress"><span style={{width:`${opportunity?.stage==="perdida"?0:score}%`}}/></div></td><td className="amount">{opportunity?.stage==="perdida"?(opportunity.nextFollowupAt?new Date(opportunity.nextFollowupAt).toLocaleDateString("es-DO",{dateStyle:"medium"}):"Sin seguimiento") : formatCurrency(opportunity?.monthlyFee??0)}</td></tr>})}</tbody></table></div>

    {open&&<Modal title="Registrar prospecto B2B" description="Crea la cuenta, el decisor inicial y la primera próxima acción." onClose={()=>setOpen(false)} wide><form onSubmit={submit}><div className="form-grid"><Field name="name" label="Nombre del condominio o proyecto" error={errors.name}/><label className="field"><span>Tipo de cuenta</span><select name="accountType" defaultValue="condominio_existente">{Object.entries(accountTypeLabels).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><Field name="sector" label="Sector" error={errors.sector}/><Field name="address" label="Dirección"/><Field name="units" type="number" label="Cantidad de unidades" error={errors.units}/><Field name="towers" type="number" label="Cantidad de torres" defaultValue="1"/><label className="field"><span>Perfil</span><select name="profile"><option value="familiar">Familiar</option><option value="premium">Premium</option><option value="corporativo">Corporativo</option></select></label><Field name="source" label="Fuente del prospecto" defaultValue="Referido"/><Field name="stakeholderName" label="Contacto / decisor principal" error={errors.stakeholderName}/><Field name="stakeholderEmail" type="email" label="Correo del contacto" error={errors.stakeholderEmail}/><Field name="phone" label="Teléfono / WhatsApp"/><label className="field field-wide"><span>Necesidad principal</span><textarea name="primaryProblem" placeholder="¿Qué problema desea resolver el condominio?"/>{errors.primaryProblem&&<small className="field-error">{errors.primaryProblem}</small>}</label><Field name="nextAction" label="Próxima acción obligatoria" error={errors.nextAction}/><Field name="nextActionAt" type="datetime-local" label="Fecha y hora" error={errors.nextActionAt}/></div><div className="form-actions"><button type="button" className="button" onClick={()=>setOpen(false)}>Cancelar</button><button className="button button-primary">Crear prospecto</button></div></form></Modal>}

    {importOpen&&<Modal title="Importar prospectos" description="Carga una base desde Excel o CSV. INDEX ONE revisará errores y duplicados antes de guardar." onClose={closeImport} wide>
      <div style={{display:"grid",gap:16}}>
        <div className="card" style={{padding:16,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}><FileSpreadsheet size={24}/><div><b>Plantilla oficial INDEX ONE</b><div style={{fontSize:13,opacity:.7}}>Úsala si estás preparando una base nueva para importar.</div></div></div>
          <button className="button" type="button" onClick={()=>void downloadProspectTemplate()}><Download size={17}/> Descargar plantilla</button>
        </div>

        <input ref={fileInput} type="file" accept=".xlsx,.csv" style={{display:"none"}} onChange={(e)=>void selectImportFile(e.target.files?.[0])}/>
        <button className="button button-primary" type="button" onClick={()=>fileInput.current?.click()}><Upload size={18}/> {importFileName?"Cambiar archivo":"Seleccionar Excel o CSV"}</button>
        {importFileName&&<small>Archivo: <b>{importFileName}</b></small>}
        {importError&&<div className="sync-banner sync-error">{importError}</div>}

        {importRows.length>0&&<>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <span className="button" style={{pointerEvents:"none"}}>Listos: {validImports.length}</span>
            <span className="button" style={{pointerEvents:"none"}}>Duplicados: {duplicateImports}</span>
            <span className="button" style={{pointerEvents:"none"}}>Con errores: {errorImports}</span>
          </div>
          {(duplicateImports>0||errorImports>0)&&<div className="sync-banner"><AlertTriangle size={17}/> Los duplicados y filas con errores se omitirán en esta primera importación. Puedes corregir el archivo y volver a cargarlo.</div>}
          <div className="table-wrap" style={{maxHeight:320,overflow:"auto"}}><table className="table"><thead><tr><th>Fila</th><th>Prospecto</th><th>Contacto</th><th>Teléfono</th><th>Origen</th><th>Resultado</th></tr></thead><tbody>{importRows.slice(0,100).map((row)=><tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.accountName||"—"}</td><td>{row.contactName||"—"}</td><td>{row.phone||"—"}</td><td>{row.source}</td><td>{row.errors.length>0?<span style={{color:"var(--danger, #b42318)"}}>{row.errors.join(" · ")}</span>:row.duplicate?<b>Duplicado · se omitirá</b>:<b>Listo</b>}</td></tr>)}</tbody></table></div>
          {importRows.length>100&&<small>Vista previa de las primeras 100 filas. Se procesarán {importRows.length} filas.</small>}
        </>}

        <div className="form-actions"><button type="button" className="button" onClick={closeImport}>Cancelar</button><button type="button" className="button button-primary" disabled={validImports.length===0||importing} onClick={importProspects}>{importing?"Importando…":`Importar ${validImports.length} prospectos`}</button></div>
      </div>
    </Modal>}
  </>;
}

function Field({name,label,type="text",error,defaultValue}:{name:string;label:string;type?:string;error?:string;defaultValue?:string}){return <label className="field"><span>{label}</span><input name={name} type={type} defaultValue={defaultValue}/>{error&&<small className="field-error">{error}</small>}</label>}
