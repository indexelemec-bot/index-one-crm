import { describe, expect, it } from "vitest";
import { buildDiscardUpdate } from "./discard-prospect";

describe("buildDiscardUpdate", () => {
  const now = new Date("2026-08-19T20:00:00.000Z");

  it("preserves the existing six-month follow-up behavior", () => {
    const result = buildDiscardUpdate(now, "Sin presupuesto", "six_months");

    expect(result.nextFollowupAt).toBe("2027-02-19T20:00:00.000Z");
    expect(result.update).toMatchObject({
      stage: "perdida",
      lost_reason: "Sin presupuesto",
      followup_enabled: true,
      next_followup_at: "2027-02-19T20:00:00.000Z",
      next_action: "Seguimiento comercial semestral",
      probability: 0
    });
  });

  it("discards permanently without scheduling another follow-up", () => {
    const result = buildDiscardUpdate(now, "No volver a contactar", "none");

    expect(result.nextFollowupAt).toBeNull();
    expect(result.update).toMatchObject({
      stage: "perdida",
      lost_reason: "No volver a contactar",
      followup_enabled: false,
      next_followup_at: null,
      next_action: "Sin seguimiento comercial",
      next_action_at: now.toISOString(),
      probability: 0
    });
  });
});
