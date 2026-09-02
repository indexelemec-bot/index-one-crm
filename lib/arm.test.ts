import { describe, expect, it } from "vitest";
import { canAgentExecute, summarizeArm } from "@/lib/arm";

describe("ARM governance", () => {
  it("blocks advisory agents from executing actions", () => {
    expect(canAgentExecute({ status: "activo", autonomyLevel: "asesor", requiresHumanApproval: false, capabilities: ["analizar"] }, "analizar", true)).toBe(false);
  });

  it("requires approval when the agent is supervised", () => {
    const agent = { status: "piloto" as const, autonomyLevel: "supervisado" as const, requiresHumanApproval: true, capabilities: ["enviar"] };
    expect(canAgentExecute(agent, "enviar")).toBe(false);
    expect(canAgentExecute(agent, "enviar", true)).toBe(true);
  });

  it("calculates coverage and executed interaction success", () => {
    const result = summarizeArm(
      [{ status: "activo" }, { status: "pausado" }] as never,
      [{ status: "activa", opportunityId: "o1" }, { status: "activa", opportunityId: "o1" }] as never,
      [{ decisionStatus: "ejecutada" }, { decisionStatus: "fallida" }, { decisionStatus: "pendiente_aprobacion" }] as never
    );
    expect(result).toEqual({ activeAgents: 1, coveredOpportunities: 1, pendingApprovals: 1, successRate: 50 });
  });
});
