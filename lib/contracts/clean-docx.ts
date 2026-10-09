import JSZip from "jszip";

const trackedInsertion = /<w:(?:ins|moveTo)\b[^>]*>([\s\S]*?)<\/w:(?:ins|moveTo)>/g;
const trackedDeletion = /<w:(?:del|moveFrom)\b[^>]*>[\s\S]*?<\/w:(?:del|moveFrom)>/g;
const commentMarker = /<w:(?:commentRangeStart|commentRangeEnd|commentReference)\b[^>]*\/?>(?:<\/w:(?:commentRangeStart|commentRangeEnd|commentReference)>)?/g;
const highlight = /<w:highlight\b[^>]*\/>/g;

export const COMPANY_ADDRESS = "Calle General Domingo Mallol No. 46, segundo nivel, Distrito Nacional, Santo Domingo";
const PREVIOUS_COMPANY_ADDRESS = "Calle Gustavo Mejía Ricart No. 237, Plaza Joabra Local No. L2-B, Sector Los Prados, Santo Domingo, Distrito Nacional";
const previousAddressAcrossRuns = /<w:t xml:space="preserve"> Calle Gustavo Mejía Ricart No\. 237, Plaza Joabra Local No\. L2-B, <\/w:t>[\s\S]*?<w:t xml:space="preserve">, Santo Domingo, Distrito Nacional(?=; válidamente )/;

export function cleanWordMarkup(xml: string) {
  let cleaned = xml;
  let previous = "";
  while (previous !== cleaned) {
    previous = cleaned;
    cleaned = cleaned.replace(trackedInsertion, "$1").replace(trackedDeletion, "");
  }
  return cleaned
    .replace(commentMarker, "")
    .replace(highlight, "")
    .replace(/<w:trackRevisions\b[^>]*\/>/g, "");
}

export function applyCurrentCompanyAddress(xml: string) {
  return xml.replace(previousAddressAcrossRuns, `<w:t xml:space="preserve"> ${COMPANY_ADDRESS}`).replaceAll(PREVIOUS_COMPANY_ADDRESS, COMPANY_ADDRESS);
}

export async function cleanContractPackage(zip: JSZip) {
  const xmlParts = Object.keys(zip.files).filter((name) => name.startsWith("word/") && name.endsWith(".xml"));
  for (const name of xmlParts) {
    const file = zip.file(name);
    if (file) zip.file(name, cleanWordMarkup(await file.async("string")));
  }

  for (const name of Object.keys(zip.files)) {
    if (/^word\/(?:comments|people)(?:Extended|Ids)?\.xml$/.test(name)) zip.remove(name);
  }

  const relationships = zip.file("word/_rels/document.xml.rels");
  if (relationships) {
    const xml = await relationships.async("string");
    zip.file("word/_rels/document.xml.rels", xml.replace(/<Relationship\b[^>]*Type="[^"]*\/(?:comments|commentsExtended|commentsIds|people)"[^>]*\/>/g, ""));
  }

  const contentTypes = zip.file("[Content_Types].xml");
  if (contentTypes) {
    const xml = await contentTypes.async("string");
    zip.file("[Content_Types].xml", xml.replace(/<Override\b[^>]*PartName="\/word\/(?:comments|people)(?:Extended|Ids)?\.xml"[^>]*\/>/g, ""));
  }
}
