/**
 * A TOURNAMENT'S NAME — one rule for "is it taken?" and one answer when it is (Tournament admin redesign Stage 5,
 * A55; pure, unit-tested).
 *
 * Two events that aren't archived may not share a name (case and spacing aside) or a public link: New tournament, the
 * clone and the record's rename refuse it (the database holds the link: `tournaments_org_slug_live_unique`). Under one
 * at a time (A23) last year's FINISHED event stays online, so it keeps both — and next year's "Spring Classic" is
 * refused. The wizard answers before the refusal: as the name is typed it names the event that holds it and offers the
 * year-bumped name in one tap ("Spring Classic 2027"), as Reuse this setup already did.
 */

export function normalizeTournamentName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function sameTournamentName(a: string, b: string): boolean {
  return normalizeTournamentName(a) === normalizeTournamentName(b);
}

/**
 * The name for `year`: a name carrying the held event's year has it replaced ("Spring Classic 2026" → "… 2027"),
 * otherwise the year is added ("Spring Classic" → "Spring Classic 2027").
 */
export function nameForYear(name: string, year: number, heldYear?: number | null): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (heldYear && trimmed.includes(String(heldYear))) return trimmed.replace(String(heldYear), String(year));
  const trailing = trimmed.match(/^(.*?)\s*\b(19|20)\d{2}$/);
  if (trailing) return `${trailing[1]} ${year}`;
  return `${trimmed} ${year}`;
}

/** The public link a name makes: lowercase letters, numbers and hyphens. */
export function slugForName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** The server's refusal for a name another live event holds — the same words at every door. */
export function nameTakenRefusal(name: string): string {
  return `A tournament named "${name}" already exists. Choose a different name.`;
}
