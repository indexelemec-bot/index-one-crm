import type { Account, CommercialReference } from "@/types/domain";

export function referenceScore(
  account: Account,
  reference: CommercialReference,
) {
  if (account.projectType !== reference.projectType) return -1000;
  const subtype =
    account.projectType === "residencial" &&
    account.residentialSubtype === reference.residentialSubtype
      ? 25
      : 0;
  const type = account.accountType === reference.accountType ? 50 : 0;
  const profile = account.profile === reference.profile ? 15 : 0;
  const distance =
    Math.abs(account.units - reference.units) / Math.max(account.units, 1);
  const units = Math.max(0, 20 - distance * 20);
  const preferred = reference.preferred ? 15 : 0;
  const priority = Math.min(20, Math.max(0, reference.priority) / 5);
  const ageDays = Math.max(
    0,
    (Date.now() - new Date(`${reference.incorporatedAt}T12:00:00Z`).getTime()) /
      86400000,
  );
  const recency = Math.max(0, 10 - ageDays / 180);
  return Math.round(
    type + subtype + profile + units + preferred + priority + recency,
  );
}

export function selectComparableReferences(
  account: Account,
  catalog: CommercialReference[],
  limit = 3,
) {
  return catalog
    .filter(
      (item) =>
        item.approved &&
        item.active &&
        item.projectType === account.projectType,
    )
    .map((item) => ({ ...item, score: referenceScore(account, item) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.priority - a.priority ||
        b.incorporatedAt.localeCompare(a.incorporatedAt) ||
        Math.abs(account.units - a.units) - Math.abs(account.units - b.units),
    )
    .slice(0, limit);
}
