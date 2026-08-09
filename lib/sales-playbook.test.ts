import { describe, expect, it } from "vitest";
import { salesTechniques, stagePlaybook } from "@/lib/sales-playbook";
import { pipelineStages } from "@/lib/constants";

describe("ecosistema de venta consultiva", () => {
  it("define guía y técnica para todas las etapas", () => {
    for (const stage of [...pipelineStages, "perdida" as const]) {
      expect(stagePlaybook[stage].actions.length).toBeGreaterThanOrEqual(3);
      expect(salesTechniques.some((technique) => technique.id === stagePlaybook[stage].techniqueId)).toBe(true);
    }
  });
});
