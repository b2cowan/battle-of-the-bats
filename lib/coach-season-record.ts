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

/**
 * Tally decided results. Cancelled events are excluded by the caller's candidate list.
 *
 * Takes the STRUCTURAL minimum rather than `RepTeamEvent` so every surface that counts a record
 * can call it — including the masthead's feed, which tallies raw `{ result }` rows straight from a
 * multi-season query and would otherwise have hand-rolled this arithmetic a fourth time. Widening
 * the parameter is what makes "one definition of how it is tallied" actually reachable.
 */
export function tallyResults(events: readonly { result: string | null }[]): WltTally {
  return {
    w: events.filter(e => e.result === 'win').length,
    l: events.filter(e => e.result === 'loss').length,
    t: events.filter(e => e.result === 'tie').length,
  };
}

/**
 * "6-4" or "6-4-1" — the one place the record is turned into a string.
 *
 * ⚠ HYPHEN, NOT AN EN DASH (owner decision 2026-08-19). This spelled the record with an en dash
 * while two Insights surfaces spelled it with a hyphen, and the reports portal put both on ONE
 * screen — the masthead's `12–4–2` sitting an inch above the Dashboard's `12-4-2`. The owner
 * chose the hyphen: it is how a coach types a record, and it is what the public club site already
 * shows, so the same team's season now reads identically wherever a family or a coach meets it.
 *
 * The fix was to change this one function, NOT to leave four surfaces spelling it by hand — the
 * whole reason this file exists is that a convention two files must honour by hand is not a source
 * of truth. Both local `recStr` copies were deleted into this call at the same time.
 */
export function formatRecord(tally: WltTally): string {
  return `${tally.w}-${tally.l}${tally.t ? `-${tally.t}` : ''}`;
}
