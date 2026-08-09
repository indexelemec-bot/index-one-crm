import type { Account, CommercialReference } from "@/types/domain";

export function referenceScore(account: Account, reference: CommercialReference) {
  const type = account.accountType === reference.accountType ? 50 : 0;
  const profile = account.profile === reference.profile ? 25 : 0;
  const distance = Math.abs(account.units - reference.units) / Math.max(account.units, 1);
  const units = Math.max(0, 25 - distance * 25);
  return Math.round(type + profile + units);
}

export function selectComparableReferences(account: Account, catalog: CommercialReference[], limit = 3) {
  return catalog.filter((item) => item.approved).map((item) => ({ ...item, score: referenceScore(account, item) })).sort((a, b) => b.score - a.score || Math.abs(account.units - a.units) - Math.abs(account.units - b.units)).slice(0, limit);
}
