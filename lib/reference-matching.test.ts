import { describe, expect, it } from "vitest";
import { accounts, references } from "@/lib/mock-data";
import { selectComparableReferences } from "@/lib/reference-matching";

describe("selección de referencias comparables",()=>{it("prioriza tipo, perfil y unidades cercanas",()=>{const selected=selectComparableReferences(accounts[0],references,3);expect(selected).toHaveLength(3);expect(selected[0].clientName).toBe("Condominio Torre Ducal");expect(selected[0].score).toBe(100)});it("solo devuelve referencias aprobadas",()=>{const selected=selectComparableReferences(accounts[1],[...references,{...references[3],id:"blocked",approved:false,units:36}],3);expect(selected.some((r)=>r.id==="blocked")).toBe(false)})});
