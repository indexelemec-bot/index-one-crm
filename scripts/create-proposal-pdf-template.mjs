import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const decodeXml = (value) => value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const encodeXml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function replaceDocumentText(xml, target, replacement = "") {
  const regex = /<w:t(?=\s|>)([^>]*)>([\s\S]*?)<\/w:t>/g;
  const nodes = [];
  let match;
  let plain = "";
  while ((match = regex.exec(xml))) {
    const text = decodeXml(match[2]);
    nodes.push({ start: plain.length, end: plain.length + text.length, xmlStart: match.index, xmlEnd: regex.lastIndex, attrs: match[1], text });
    plain += text;
  }
  const hits = [];
  let from = 0;
  while ((from = plain.indexOf(target, from)) !== -1) {
    hits.push(from);
    from += target.length;
  }
  const edits = [];
  for (const hit of hits.reverse()) {
    const end = hit + target.length;
    const affected = nodes.filter((node) => node.end > hit && node.start < end);
    if (!affected.length) continue;
    const first = affected[0];
    const last = affected.at(-1);
    const before = first.text.slice(0, Math.max(0, hit - first.start));
    const after = last.text.slice(Math.max(0, end - last.start));
    affected.forEach((node, index) => edits.push({
      start: node.xmlStart,
      end: node.xmlEnd,
      value: `<w:t${node.attrs}>${encodeXml(index === 0 ? before + replacement + (affected.length === 1 ? after : "") : index === affected.length - 1 ? after : "")}</w:t>`
    }));
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) xml = xml.slice(0, edit.start) + edit.value + xml.slice(edit.end);
  return xml;
}

const root = process.cwd();
const source = path.join(root, "public/templates/propuesta-index-condo-2026.docx");
const output = path.join(root, "tmp/proposal-template/propuesta-index-condo-2026-blank.docx");
const zip = await JSZip.loadAsync(await readFile(source));
const document = zip.file("word/document.xml");
if (!document) throw new Error("La plantilla no contiene word/document.xml");
let xml = await document.async("string");
const dynamicValues = [
  "Condominio Residencial Residencial Randy A, B, C",
  "Condominio Residencial Randy A, B, C",
  "Santo Domingo, 29 de julio de 2026",
  "29 de julio de 2026",
  "RD$ 36,000.00 / mes",
  "Condominio Torre Ducal", "C. Padre Fantino Falco 79, Serralles, D.N.", "64",
  "Torre Arche Tres", "C. General Cambiazo No.8, Ens. Naco, D.N.", "23",
  "Torre Kesington", "C. Rafael Augusto Sánchez 13, Ens. Naco", "16"
];
for (const value of dynamicValues) xml = replaceDocumentText(xml, value);
zip.file("word/document.xml", xml);
await writeFile(output, await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } }));
console.log(output);
