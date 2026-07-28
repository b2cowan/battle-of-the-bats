import { tournamentToday } from './timezone';
/**
 * lib/coach-tournament-lifecycle.ts
 *
 * The coach tournament-LIST lifecycle chip (Rule CP-2) + the live-first sort that
 * orders the list by it. Distinct from `lib/coach-tournament-phase.ts` (which drives
 * the DETAIL hero and is gated by the coach's acceptance): this is the calendar-only
 * lifecycle of the EVENT, used to chip + sort the records list at a glance.
 *
 * Pure (dates → state); `today` is injectable for testing.
 */

export type CoachLifecycleState = 'live' | 'game_day' | 'upcoming' | 'future' | 'complete' | 'unknown';

export type CoachLifecycleChip = {
  state: CoachLifecycleState;
  /** Display label: "LIVE" / "GAME DAY" / "In 5 days" / "Jun 2026" / "Complete". */
  label: string;
  /** Sort rank — lower sorts first (live → game-day → upcoming → future → complete → unknown). */
  rank: number;
};

const DAY_MS = 86_400_000;

function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.parse(fromISO + 'T00:00:00');
  const to = Date.parse(toISO + 'T00:00:00');
  if (!Number.isFinite(from) || !Number.isFinite(to)) return NaN;
  return Math.round((to - from) / DAY_MS);
}

/**
 * Derive the lifecycle chip for a tournament from its start/end dates.
 * - live: today is within [start, end] (dates straddle today)
 * - game_day: start === today (single-day event, or start day of a multi-day before `live` applies)
 * - upcoming: 1–14 days before start
 * - future: > 14 days before start
 * - complete: today > end (or > start when no end)
 * - unknown: no start date (TBD) — sorts last, renders nothing.
 */
export function deriveCoachLifecycleChip(
  startDate: string | null,
  endDate: string | null,
  today: string = tournamentToday(),
): CoachLifecycleChip {
  if (!startDate) return { state: 'unknown', label: '', rank: 5 };

  const end = endDate ?? startDate;

  // Complete: the event is over.
  if (today > end) return { state: 'complete', label: 'Complete', rank: 4 };

  // Inside the event window: the opening day (single- or multi-day) reads as "game day";
  // any later day of a multi-day event whose window straddles today reads as "live".
  if (today >= startDate && today <= end) {
    if (today === startDate) return { state: 'game_day', label: 'Game Day', rank: 1 };
    return { state: 'live', label: 'Live', rank: 0 };
  }

  // Before the event.
  const daysToStart = daysBetween(today, startDate);
  if (Number.isFinite(daysToStart) && daysToStart >= 1 && daysToStart <= 14) {
    return { state: 'upcoming', label: `In ${daysToStart} ${daysToStart === 1 ? 'day' : 'days'}`, rank: 2 };
  }

  // Further out — a quiet "Month Year" label.
  const monthYear = new Date(startDate + 'T00:00:00').toLocaleDateString('en-CA', {
    month: 'short',
    year: 'numeric',
  });
  return { state: 'future', label: monthYear, rank: 3 };
}

/**
 * Live-first sort (§3c/§3d): order a list of tournament-bearing items by lifecycle chip rank
 * (live → game-day → upcoming → future → complete → unknown). Within a bucket: soonest start
 * first for anything still ahead, but the COMPLETE bucket reads as history — most recent first
 * (a flat premium list would otherwise open its "Complete" tail with the oldest season).
 * Null start dates sort last in either direction. Derives each item's chip exactly once (not
 * per comparison) via a decorate-sort-undecorate pass. `getStart`/`getEnd` let callers pass
 * either camelCase or snake_case date fields without remapping their data first.
 */
export function sortByCoachLifecycle<T>(
  items: T[],
  getStart: (item: T) => string | null,
  getEnd: (item: T) => string | null,
  today: string = tournamentToday(),
): T[] {
  return items
    .map(item => ({ item, chip: deriveCoachLifecycleChip(getStart(item), getEnd(item), today) }))
    .sort((a, b) => {
      const rankDiff = a.chip.rank - b.chip.rank;
      if (rankDiff !== 0) return rankDiff;
      const desc = a.chip.state === 'complete';
      const sentinel = desc ? '0000-01-01' : '9999-12-31';
      const aStart = getStart(a.item) ?? sentinel;
      const bStart = getStart(b.item) ?? sentinel;
      return desc ? bStart.localeCompare(aStart) : aStart.localeCompare(bStart);
    })
    .map(({ item }) => item);
}

/** Map a lifecycle state to the CSS-module class suffix (PascalCase modifier). */
export function lifecycleChipClassKey(state: CoachLifecycleState): string {
  switch (state) {
    case 'live':
      return 'Live';
    case 'game_day':
      return 'GameDay';
    case 'upcoming':
      return 'Upcoming';
    case 'future':
      return 'Future';
    case 'complete':
      return 'Complete';
    default:
      return '';
  }
}
