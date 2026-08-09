import { describe, expect, it } from "vitest";
import { pipelineStages } from "@/lib/constants";
import { availableSpeeches, personalizeSpeech, speechesForStage } from "@/lib/sales-speeches";
import { accounts, opportunities, stakeholders } from "@/lib/mock-data";
import type { SpeechUsage } from "@/types/domain";

describe("biblioteca de speeches B2B", () => {
  it("ofrece al menos tres opciones en cada etapa del embudo", () => {
    for (const stage of pipelineStages) expect(speechesForStage(stage).length).toBeGreaterThanOrEqual(3);
  });

  it("no vuelve a recomendar un speech usado para el mismo contacto y etapa", () => {
    const opportunity = opportunities[0];
    const first = speechesForStage(opportunity.stage)[0];
    const usage: SpeechUsage = { id: "usage-1", speechId: first.id, opportunityId: opportunity.id, stakeholderId: stakeholders[0].id, stage: opportunity.stage, userId: opportunity.ownerId, channel: "llamada", outcome: "interes", nextAction: "Llamar", nextActionAt: new Date().toISOString(), usedAt: new Date().toISOString() };
    expect(availableSpeeches(opportunity.stage, [usage], opportunity.id, stakeholders[0].id).map((item) => item.id)).not.toContain(first.id);
  });

  it("personaliza el cliente y elimina los campos principales", () => {
    const account = accounts[0];
    const opportunity = { ...opportunities[0], accountId: account.id, stage: "prospecto_identificado" as const };
    const contact = stakeholders.find((item) => item.accountId === account.id);
    const text = personalizeSpeech(speechesForStage(opportunity.stage)[1], account, opportunity, contact);
    expect(text).toContain(account.name);
    expect(text).not.toContain("[Condominio]");
  });
});
