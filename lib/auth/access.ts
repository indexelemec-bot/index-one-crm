export type CrmAccessProfile = {
  active?: boolean | null;
  deleted_at?: string | null;
};

export function isEnabledCrmProfile(
  profile: CrmAccessProfile | null | undefined,
) {
  return profile?.active === true && profile.deleted_at === null;
}
