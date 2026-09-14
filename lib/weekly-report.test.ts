import { describe, expect, it } from "vitest";
import { buildWeeklyReport, type WeeklyReportInput } from "@/lib/weekly-report";

const fixture: WeeklyReportInput = {
  filters: { start: "2025-09-08T04:00:00.000Z", endExclusive: "2025-09-15T04:00:00.000Z" },
  settings: { neverContactedBusinessDays: 1, inactiveDays: 7, proposalFollowupDays: 3 },
  accounts: [
    { id: "a1", name: "Torre Uno", owner_id: "u1", source: "Referido", project_type: "residencial", residential_subtype: "apartamento", created_at: "2025-09-08T12:00:00Z" },
    { id: "a2", name: "Plaza Dos", owner_id: "u2", source: "Google", project_type: "comercial", residential_subtype: null, created_at: "2025-08-20T12:00:00Z" }
  ],
  opportunities: [
    { id: "o1", account_id: "a1", owner_id: "u1", stage: "propuesta", next_action: "Dar seguimiento", next_action_at: "2025-09-16T14:00:00Z", monthly_fee: 40_000, created_at: "2025-09-08T12:00:00Z", updated_at: "2025-09-10T12:00:00Z" },
    { id: "o2", account_id: "a2", owner_id: "u2", stage: "negociacion", next_action: null, next_action_at: null, monthly_fee: 60_000, created_at: "2025-08-20T12:00:00Z", updated_at: "2025-08-20T12:00:00Z" }
  ],
  activities: [
    { opportunity_id: "o1", activity_type: "llamada", due_at: null, completed_at: "2025-09-09T15:00:00Z", created_at: "2025-09-09T15:00:00Z" },
    { opportunity_id: "o1", activity_type: "reunion", due_at: "2025-09-10T15:00:00Z", completed_at: "2025-09-10T16:00:00Z", created_at: "2025-09-09T18:00:00Z" }
  ],
  tasks: [{ opportunity_id: "o2", owner_id: "u2", status: "pendiente", due_at: "2025-09-05T12:00:00Z", created_at: "2025-08-25T12:00:00Z" }],
  proposals: [{ opportunity_id: "o1", status: "enviada", generated_at: "2025-09-11T12:00:00Z", sent_at: "2025-09-11T13:00:00Z" }],
  communications: [],
  sales: [],
  stageHistory: [{ id: "h1", opportunity_id: "o1", previous_stage: "diagnostico", new_stage: "propuesta", moved_by: "u1", owner_id_snapshot: "u1", moved_at: "2025-09-10T12:00:00Z", previous_stage_duration_seconds: 172_800, change_note: "Cliente solicitó propuesta" }],
  profiles: [
    { id: "u1", full_name: "Laura Méndez", role: "ejecutivo", active: true },
    { id: "u2", full_name: "Carlos Peña", role: "ejecutivo", active: true }
  ]
};

describe("weekly sales report", () => {
  it("summarizes movement, contact, proposal and follow-up risks", () => {
    const report = buildWeeklyReport(fixture);
    expect(report.kpis).toMatchObject({
      newProspects: 1,
      contacted: 1,
      neverContacted: 1,
      stageMovements: 1,
      stagnant: 1,
      meetingsScheduled: 1,
      meetingsHeld: 1,
      proposalsGenerated: 1,
      proposalsSent: 1,
      overdueFollowups: 1,
      approachingClose: 1
    });
    expect(report.movements[0]).toMatchObject({ accountName: "Torre Uno", previousStageHours: 48, note: "Cliente solicitó propuesta" });
    expect(report.attention.find((item) => item.accountId === "a2")?.reasons).toEqual(expect.arrayContaining(["Nunca contactado", "Seguimiento vencido", "Sin próxima acción"]));
  });

  it("limits every metric to the selected seller", () => {
    const report = buildWeeklyReport({ ...fixture, filters: { ...fixture.filters, sellerId: "u1" } });
    expect(report.sellers).toHaveLength(1);
    expect(report.sellers[0].sellerName).toBe("Laura Méndez");
    expect(report.kpis.neverContacted).toBe(0);
    expect(report.kpis.overdueFollowups).toBe(0);
  });
});
