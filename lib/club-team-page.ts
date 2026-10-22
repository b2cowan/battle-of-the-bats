/**
 * lib/club-team-page.ts — THE PUBLIC TEAM PAGE'S RECIPE (Club Tier Stage 4b-2a; End state 3, ruled 2026-10-19).
 *
 * The name, its division and season → the tryout door (or one quiet sentence) → the schedule, when the coach
 * chose Public link → About the team. A part with nothing to show is absent. No Past seasons list (DC-07); no Coaches
 * section (it arrives in 4c with the coach's own switch). Pure, so the absences are unit-tested.
 */

export type TeamPagePart = 'concluded' | 'tryoutDoor' | 'tryoutQuiet' | 'schedule' | 'about';

/** The page's parts in phone order. An archived team's page still opens for old links, says it has concluded, and offers
 *  no tryout part at all (a "not taking sign-ups right now" would promise a later). */
export function teamPageParts(has: { archived: boolean; tryoutOpen: boolean; schedule: boolean; about: boolean }): TeamPagePart[] {
  const out: TeamPagePart[] = [];
  if (has.archived) out.push('concluded');
  else out.push(has.tryoutOpen ? 'tryoutDoor' : 'tryoutQuiet');
  if (has.schedule && !has.archived) out.push('schedule');
  if (has.about) out.push('about');
  return out;
}

/** "Provincial AAA · 2026 season" — either part alone, or nothing. */
export function teamMetaLine(division: string | null | undefined, seasonYear: number | null | undefined): string | null {
  const parts = [division?.trim() || null, seasonYear ? `${seasonYear} season` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** How many coming events show before "Show the rest of the season". */
export const SCHEDULE_SHOWN = 4;

/**
 * The season's events split at now (C3): what is over folds into "Earlier this season" above Up next; then the next
 * few; then the rest on demand. An event is over when it has ENDED — a game in progress stays in view (a family arriving
 * late still finds it); one with no end time is over once it has started, the rule that picks Up next
 * (`lib/family-view.ts` findNextUpId). Instants, so it is right in every zone. A cancelled event stays where its date
 * puts it (C9).
 */
export function splitPublicSchedule<T extends { startsAt: string; endsAt?: string | null }>(
  entries: readonly T[],
  now: number = Date.now(),
  shown: number = SCHEDULE_SHOWN,
): { earlier: T[]; upcoming: T[]; later: T[] } {
  const sorted = [...entries].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const over = (e: T) => Date.parse(e.endsAt ?? e.startsAt) < now;
  const coming = sorted.filter(e => !over(e));
  return { earlier: sorted.filter(over), upcoming: coming.slice(0, shown), later: coming.slice(shown) };
}
