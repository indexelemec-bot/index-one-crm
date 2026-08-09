import JSZip from "jszip";
import type { CommercialReference } from "@/types/domain";

export interface ProposalTemplateData { clientName: string; issueDate: string; monthlyFee: number; references: CommercialReference[]; }

const decodeXml = (value: string) => value.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'");
const encodeXml = (value: string) => value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");

export function replaceDocumentText(xml: string, target: string, replacement: string) {
  const regex=/<w:t(?=\s|>)([^>]*)>([\s\S]*?)<\/w:t>/g; const nodes:Array<{start:number;end:number;xmlStart:number;xmlEnd:number;attrs:string;text:string}>=[]; let match:RegExpExecArray|null; let plain="";
  while((match=regex.exec(xml))){const text=decodeXml(match[2]);nodes.push({start:plain.length,end:plain.length+text.length,xmlStart:match.index,xmlEnd:regex.lastIndex,attrs:match[1],text});plain+=text;}
  const hits:number[]=[];let from=0;while((from=plain.indexOf(target,from))!==-1){hits.push(from);from+=target.length;}
  if(!hits.length)return xml;
  const edits:Array<{start:number;end:number;value:string}>=[];
  for(const hit of hits.reverse()){
    const end=hit+target.length;const affected=nodes.filter((n)=>n.end>hit&&n.start<end);if(!affected.length)continue;
    const first=affected[0],last=affected[affected.length-1];const before=first.text.slice(0,Math.max(0,hit-first.start));const after=last.text.slice(Math.max(0,end-last.start));
    affected.forEach((node,index)=>edits.push({start:node.xmlStart,end:node.xmlEnd,value:`<w:t${node.attrs}>${encodeXml(index===0?before+replacement+(affected.length===1?after:""):index===affected.length-1?after:"")}</w:t>`}));
  }
  let output=xml;for(const edit of edits.sort((a,b)=>b.start-a.start))output=output.slice(0,edit.start)+edit.value+output.slice(edit.end);
  return output;
}

function spanishDate(value:string){return new Intl.DateTimeFormat("es-DO",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));}
function fee(value:number){return new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);}

export async function generateProposalDocx(template:ArrayBuffer|Uint8Array,data:ProposalTemplateData){
  if(data.references.length!==3)throw new Error("La plantilla requiere exactamente tres referencias comerciales.");
  const zip=await JSZip.loadAsync(template);const file=zip.file("word/document.xml");if(!file)throw new Error("La plantilla corporativa no contiene word/document.xml");let xml=await file.async("string");
  const replacements:[string,string][]=[
    ["Condominio Residencial Residencial Randy A, B, C",data.clientName],
    ["Condominio Residencial Randy A, B, C",data.clientName],
    ["29 de julio de 2026",spanishDate(data.issueDate)],
    ["36,000.00",fee(data.monthlyFee)],
    ["Condominio Torre Ducal",data.references[0].clientName],["C. Padre Fantino Falco 79, Serralles, D.N.",data.references[0].location],["64",String(data.references[0].units)],
    ["Torre Arche Tres",data.references[1].clientName],["C. General Cambiazo No.8, Ens. Naco, D.N.",data.references[1].location],["23",String(data.references[1].units)],
    ["Torre Kesington",data.references[2].clientName],["C. Rafael Augusto Sánchez 13, Ens. Naco",data.references[2].location],["16",String(data.references[2].units)]
  ];
  for(const [source,target] of replacements)xml=replaceDocumentText(xml,source,target);
  zip.file("word/document.xml",xml);return zip.generateAsync({type:"uint8array",compression:"DEFLATE",compressionOptions:{level:6}});
}
