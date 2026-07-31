// The team's season W/L/T record — ONE definition of what counts and how it is tallied.
//
// This existed as a comment-enforced convention rather than shared code: `SeasonRecordWidget` and
// the Insights page each declared their own `WLT_DEFAULT` / `tally()` / storage key, with a comment
// in one of them saying "Same categories + defaults + storage key as SeasonRecordWidget, so the
// band's record can never disagree with the Overview's record glance". Chunk I turned that comment
// into a real defect: the Overview's record tile computed its own scrimmage-excluded tally, so a
// coach who had switched scrimmages ON saw one record on Insights and a different one on the
// Overview — the same failure the comment was written to prevent.
//
// A convention that two files must agree by hand is not a single source of truth. This is.

import type { RepTeamEvent } from './types';

/** Event types that can carry a result. Scrimmages count only when the coach opts in. */
export const WLT_CATEGORIES = [
  { key: 'league_game', label: 'League' },
  { key: 'tournament_game', label: 'Tournament' },
  { key: 'scrimmage', label: 'Scrimmage' },
] as const;

/** League + tournament count; scrimmages do not, until the coach says otherwise. */
export const WLT_DEFAULT: Record<string, boolean> = {
  league_game: true,
  tournament_game: true,
  scrimmage: false,
};

/** Per-team, device-remembered scope. The coach sets it on Insights; every surface reads it. */
export function wltStorageKey(teamId: string): string {
  return `flhq.coachWlt.${teamId}`;
}

/**
 * Read the coach's remembered scope. Best-effort by design — a device with no stored preference,
 * or unreadable storage, falls back to the default rather than showing no record at all.
 */
export function readWltPreference(teamId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(wltStorageKey(teamId));
    return raw ? { ...WLT_DEFAULT, ...(JSON.parse(raw) as Record<string, boolean>) } : { ...WLT_DEFAULT };
  } catch {
    return { ...WLT_DEFAULT };
  }
}

export interface WltTally { w: number; l: number; t: number }

/** Tally decided results. Cancelled events are excluded by the caller's candidate list. */
export function tallyResults(events: readonly RepTeamEvent[]): WltTally {
  return {
    w: events.filter(e => e.result === 'win').length,
    l: events.filter(e => e.result === 'loss').length,
    t: events.filter(e => e.result === 'tie').length,
  };
}

/** "6–4" or "6–4–1" — the one place the record is turned into a string. */
export function formatRecord(tally: WltTally): string {
  return `${tally.w}–${tally.l}${tally.t ? `–${tally.t}` : ''}`;
}
