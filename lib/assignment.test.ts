import { describe, expect, it } from "vitest";
import { opportunityAssignmentSchema } from "./assignment";

const opportunityId = "11111111-1111-4111-8111-111111111111";
const newOwnerId = "22222222-2222-4222-8222-222222222222";

describe("opportunityAssignmentSchema", () => {
  it("requires a meaningful reason", () => {
    expect(opportunityAssignmentSchema.safeParse({ opportunityId, newOwnerId, reason: "  " }).success).toBe(false);
    expect(opportunityAssignmentSchema.safeParse({ opportunityId, newOwnerId, reason: "ok" }).success).toBe(false);
  });

  it("normalizes reason and accepts an optional note", () => {
    const result = opportunityAssignmentSchema.parse({ opportunityId, newOwnerId, reason: "  Cobertura territorial  ", note: "  Contexto adicional  " });
    expect(result).toMatchObject({ reason: "Cobertura territorial", note: "Contexto adicional" });
  });
});
