export type DiscardFollowupMode = "six_months" | "none";

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
}

export function buildDiscardUpdate(now: Date, reason: string, followupMode: DiscardFollowupMode) {
  const withoutFollowup = followupMode === "none";
  const next = addMonths(now, 6);

  return {
    update: {
      stage: "perdida" as const,
      lost_reason: reason,
      followup_enabled: !withoutFollowup,
      followup_interval_months: 6,
      next_followup_at: withoutFollowup ? null : next.toISOString(),
      next_action: withoutFollowup ? "Sin seguimiento comercial" : "Seguimiento comercial semestral",
      next_action_at: withoutFollowup ? now.toISOString() : next.toISOString(),
      probability: 0,
      updated_at: now.toISOString()
    },
    nextFollowupAt: withoutFollowup ? null : next.toISOString()
  };
}
