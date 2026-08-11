import { describe, expect, it } from "vitest";
import { calculateOpportunityScore } from "@/lib/opportunity-score";
import type { Opportunity } from "@/types/domain";

const opportunity: Opportunity = { id: "o1", accountId: "a1", stage: "prospecto_identificado", primaryProblem: "Falta de reportes", impact: "Decisiones tardías", proposedSolution: "Reportes mensuales", monthlyFee: 0, probability: 15, nextAction: "Llamar", nextActionAt: "2026-08-10T14:00:00.000Z", ownerId: "u1", updatedAt: "2026-08-09T00:00:00.000Z" };

describe("calculateOpportunityScore", () => {
  it("explica el puntaje de una oportunidad activa", () => {
    const result = calculateOpportunityScore(opportunity, [{ id: "s1", accountId: "a1", fullName: "Ana", role: "presidente", phone: "", email: "", influence: 5, position: "champion", isDecisionMaker: true }], [], [], new Date("2026-08-09T12:00:00.000Z"));
    expect(result.score).toBe(27);
    expect(result.factors.find((factor) => factor.label === "Decisor confirmado")?.achieved).toBe(true);
  });
  it("reserva 100 para clientes activos", () => expect(calculateOpportunityScore({ ...opportunity, stage: "cliente_activo" }, [], [], []).score).toBe(100));
});
