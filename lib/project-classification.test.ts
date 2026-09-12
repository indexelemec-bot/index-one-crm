import { describe, expect, it } from "vitest";
import { accountSchema } from "@/lib/validation";

const baseAccount={name:"Proyecto Central",accountType:"proyecto_nuevo",sector:"Naco",units:24,primaryProblem:"Necesita administración integral",stakeholderName:"Ana Pérez",stakeholderEmail:"ana@example.com",nextAction:"Coordinar reunión",nextActionAt:"2026-09-10T10:00"};

describe("clasificación de proyecto",()=>{
  it("acepta comercial con locales",()=>{expect(accountSchema.safeParse({...baseAccount,projectType:"comercial"}).success).toBe(true)});
  it("acepta apartamentos y casas",()=>{expect(accountSchema.safeParse({...baseAccount,projectType:"residencial",residentialSubtype:"apartamento"}).success).toBe(true);expect(accountSchema.safeParse({...baseAccount,projectType:"residencial",residentialSubtype:"casa"}).success).toBe(true)});
  it("exige término cuando el subtipo es otros",()=>{expect(accountSchema.safeParse({...baseAccount,projectType:"residencial",residentialSubtype:"otros"}).success).toBe(false);expect(accountSchema.safeParse({...baseAccount,projectType:"residencial",residentialSubtype:"otros",customUnitType:"villas"}).success).toBe(true)});
});
