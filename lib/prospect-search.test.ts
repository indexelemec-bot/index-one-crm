import { describe, expect, it } from "vitest";
import { matchesProspectSearch } from "./prospect-search";

describe("matchesProspectSearch", () => {
  it("finds a prospect by condominium name", () => {
    expect(matchesProspectSearch("Torre Carmen XXI", ["Luis Carlos Sánchez"], "Carmen")).toBe(true);
  });

  it("finds a prospect by any associated contact name", () => {
    expect(matchesProspectSearch("Torre Carmen XXI", ["Luis Carlos Sánchez", "María Gómez"], "Maria Gomez")).toBe(true);
  });

  it("ignores casing, accents and surrounding spaces", () => {
    expect(matchesProspectSearch("Residencial Ámbar", ["José Núñez"], "  JOSE NUNEZ  ")).toBe(true);
  });

  it("does not match unrelated names", () => {
    expect(matchesProspectSearch("Residencial Ámbar", ["José Núñez"], "Patricia")).toBe(false);
  });
});
