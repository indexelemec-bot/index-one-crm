function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

export function matchesProspectSearch(accountName: string, stakeholderNames: string[], query: string) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;

  return [accountName, ...stakeholderNames]
    .some((value) => normalizeSearchValue(value).includes(normalizedQuery));
}
