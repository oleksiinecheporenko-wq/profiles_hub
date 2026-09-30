// Autocomplete for tag inputs (Skills): previously saved values matching the typed text.

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("uk");

/**
 * Suggestions that contain the query (case-insensitive), excluding tags already
 * selected. Prefix matches come first, then the rest; each group alphabetical.
 */
export function suggestTags(all: string[], selected: string[], query: string, limit = 8): string[] {
  const q = norm(query);
  if (!q) return [];
  const taken = new Set(selected.map(norm));
  const seen = new Set<string>();
  const prefix: string[] = [];
  const inner: string[] = [];
  for (const s of all) {
    const key = norm(s);
    if (!key || taken.has(key) || seen.has(key)) continue;
    seen.add(key);
    if (key.startsWith(q)) prefix.push(s);
    else if (key.includes(q)) inner.push(s);
  }
  const byName = (a: string, b: string) => a.localeCompare(b, "uk");
  return [...prefix.sort(byName), ...inner.sort(byName)].slice(0, limit);
}
