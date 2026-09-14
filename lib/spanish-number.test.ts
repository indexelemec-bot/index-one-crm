import { describe, expect, it } from "vitest";
import { dominicanPesosInWords, integerToSpanish } from "@/lib/spanish-number";

describe("números en letras para contratos", () => {
  it("convierte honorarios comunes y centavos", () => {
    expect(dominicanPesosInWords(35_000)).toBe("TREINTA Y CINCO MIL PESOS DOMINICANOS CON 00/100");
    expect(dominicanPesosInWords(22_500.75)).toBe("VEINTIDÓS MIL QUINIENTOS PESOS DOMINICANOS CON 75/100");
  });

  it("maneja millones y límites", () => {
    expect(dominicanPesosInWords(1_000_000)).toBe("UN MILLÓN DE PESOS DOMINICANOS CON 00/100");
    expect(integerToSpanish(999_999_999)).toContain("novecientos noventa y nueve millones");
  });
});
