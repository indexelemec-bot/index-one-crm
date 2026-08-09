import { describe, expect, it } from "vitest";
import { calculateSaleFigures } from "@/lib/commissions";

describe("calculateSaleFigures", () => {
  it("calcula 50% del primer honorario mensual cerrado", () => {
    expect(calculateSaleFigures(60000, 50000, false)).toMatchObject({
      initialFee: 60000, finalFee: 50000, annualValue: 600000,
      commissionBase: 50000, commissionAmount: 25000, commissionStatus: "ganada"
    });
  });

  it("pasa a pagadera cuando se confirma el primer cobro", () => {
    expect(calculateSaleFigures(50000, 50000, true).commissionStatus).toBe("pagadera");
  });
});
