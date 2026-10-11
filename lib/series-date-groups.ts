/**
 * series-date-groups.ts — a weekly series' dates, grouped by what they have to say (owner 2026-10-11, decision sheet
 * https://claude.ai/artifact/NKSa5J2q25Rm13aEXFwk2G, Asks 1–5 as recommended). The permit window's price rows made the
 * same move (lib/permit-words.ts `priceGroups`): say a thing once, with everything it applies to beside it. Here the
 * list is edited, so each date stays its own one-tap chip inside its group. Client-safe, pure.
 *
 * ⚖ ORDER (Ask 2): the groups that say something come first, in the order of their first date; the dates with nothing
 * to say are one group, last. The coach's decisions are in the marked groups, so they lead (a permit's price rows keep
 * their fields' order, because a price isn't something to act on).
 *
 * Copy status: signed off by /marketing 2026-10-11 as drawn ("Tap a date to remove it", "The other dates", "Remove these
 * 4", "Put these 4 back" — one verb per act, the chips' "Remove Oct 28" / "Put Oct 28 back"), and the game rows' grey
 * placeholder naming the opponent a blank date takes.
 */

/** What one date has to say: the clash mark (amber) and the permit mark (quiet), either, both or neither. */
export interface SeriesDateNote { clash?: string | null; permit?: string | null }

export interface SeriesDateGroup {
  /** Stable for React: the two notes, joined. The plain group's key is `plain`. */
  key: string;
  clash: string | null;
  permit: string | null;
  /** In the list's own (date) order. */
  dates: string[];
}

/**
 * One group per distinct note (a date that clashes AND is outside the permit groups with the dates that say both),
 * marked groups first by their first date, then the dates with nothing to say. `dates` arrive in date order.
 */
export function seriesDateGroups(
  dates: readonly string[],
  noteOf: (date: string) => SeriesDateNote | undefined,
): SeriesDateGroup[] {
  const marked = new Map<string, SeriesDateGroup>();
  const plain: string[] = [];
  for (const date of dates) {
    const n = noteOf(date);
    const clash = n?.clash || null;
    const permit = n?.permit || null;
    if (!clash && !permit) { plain.push(date); continue; }
    const key = `${clash ?? ''}␟${permit ?? ''}`;
    const g = marked.get(key) ?? { key, clash, permit, dates: [] };
    g.dates.push(date);
    marked.set(key, g);
  }
  const groups = [...marked.values()];
  if (plain.length) groups.push({ key: 'plain', clash: null, permit: null, dates: plain });
  return groups;
}

/**
 * A marked group's one door (Ask 3) — what it does next, or null when it would save nothing:
 *   two or more dates still in → remove them all ("Remove these 3");
 *   every date removed        → put them all back ("Put these 4 back");
 *   one date still in, or a group of one → no door (the chip is the one tap).
 */
export function groupDoor(groupSize: number, keptInGroup: number): { act: 'remove' | 'restore'; label: string } | null {
  if (groupSize < 2) return null;
  if (keptInGroup >= 2) return { act: 'remove', label: SERIES_LIST_WORDS.removeThese(keptInGroup) };
  if (keptInGroup === 0) return { act: 'restore', label: SERIES_LIST_WORDS.putTheseBack(groupSize) };
  return null;
}

// ── The list's words ───────────────────────────────────────────────────────────────────────────────────

export const SERIES_LIST_WORDS = {
  /** Add's hint over a practice (or any type without an opponent) series' chips. */
  hintAdd: 'Tap a date to remove it. Nothing is saved until you tap Add.',
  /** Add's hint over a game series' rows (unchanged). */
  hintAddGames: 'Add an opponent to each. Nothing is saved until you tap Add.',
  /** A series edit's hint (unchanged, owner ruling 2026-10-09). */
  hintEdit: 'Each keeps its own date. Nothing is saved until you tap Save.',
  /** The last group's head, shown only when a group with a note sits above it. */
  otherDates: 'The other dates',
  removeThese: (n: number) => `Remove these ${n}`,
  putTheseBack: (n: number) => `Put these ${n} back`,
  /** A date chip's name for a screen reader (today's words). */
  removeDate: (date: string) => `Remove ${date}`,
  putDateBack: (date: string) => `Put ${date} back`,
} as const;
