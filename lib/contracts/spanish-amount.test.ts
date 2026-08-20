import { describe, expect, it } from "vitest";
import { amountToSpanishWords } from "@/lib/contracts/spanish-amount";

describe("amountToSpanishWords", () => {
  it.each([
    [35_000, "TREINTA Y CINCO MIL CON 00/100"],
    [21_001.5, "VEINTIÚN MIL UN CON 50/100"],
    [1_000_000, "UN MILLÓN CON 00/100"],
    [2_345_678.99, "DOS MILLONES TRESCIENTOS CUARENTA Y CINCO MIL SEISCIENTOS SETENTA Y OCHO CON 99/100"]
  ])("convierte %s a letras para el contrato", (amount, expected) => {
    expect(amountToSpanishWords(amount)).toBe(expected);
  });

  it("rechaza montos inválidos", () => {
    expect(() => amountToSpanishWords(0)).toThrow("no puede convertirse");
  });
});
