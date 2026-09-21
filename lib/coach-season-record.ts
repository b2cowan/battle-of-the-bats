// The team's season W/L/T record — ONE definition of what counts and how it is tallied.
//
// This existed as a comment-enforced convention rather than shared code: the Overview's old
// season-record widget and the Insights page each declared their own `WLT_DEFAULT` / `tally()` /
// storage key, with a comment in one of them saying "same categories, defaults and storage key as
// the other, so the band's record can never disagree with the Overview's record glance". ⚰ That
// widget (`components/coaches/SeasonRecordWidget.tsx`) was itself deleted on 2026-09-01 with no
// importers left — the Overview draws the record from this module now. Chunk I turned that comment
// into a real defect: the Overview's record tile computed its own scrimmage-excluded tally, so a
// coach who had switched scrimmages ON saw one record on Insights and a different one on the
// Overview — the same failure the comment was written to prevent.
//
// A convention that two files must agree by hand is not a single source of truth. This is.
//
// ⚰ THE "COUNT SCRIMMAGES" PREFERENCE IS GONE (2026-09-20). `WLT_DEFAULT` / `wltStorageKey` /
// `readWltPreference` survived here as a per-device switch that NOTHING had written since the
// 2026-09-02 dead-code sweep deleted its only control — every surface counted league + tournament
// and never a scrimmage, while the Overview tile still carried a "choose them in Insights" branch
// and four help articles promised the switch. Since mig 306 a scrimmage is a BOX on a Game, which
// is the finer instrument: a game the coach wants counted is a Game — untick it (owner ruling D4).
// The rule is therefore one predicate with no preference behind it: `countsTowardRecord`
// (lib/season-wrapped.ts). This module keeps the tally, the string, and the by-competition split.

// Relative WITH the .ts extension, like the vocabulary module — so the unit tests run under plain
// `node --test` as well as under the resolver.
import { competitionOf, type Competition } from './season-wrapped.ts';

/**
 * The by-competition split — the three lines Season's End and Wrapped draw under the record.
 * `scrimmage` is listed so a season's scrimmages are visible, and marked `counted: false` so no
 * surface can total it into the record by iterating this list.
 */
export const COMPETITIONS: readonly { key: Competition; label: string; counted: boolean }[] = [
  { key: 'game', label: 'Games', counted: true },
  { key: 'tournament', label: 'Tournament', counted: true },
  { key: 'scrimmage', label: 'Scrimmages', counted: false },
] as const;

/**
 * The record split by competition — one line per competition that has a decided game, in
 * `COMPETITIONS` order, each carrying its `counted` flag so a renderer can say "not counted" beside
 * the scrimmage line. Season's End (through its route) and the Insights Results report both draw
 * this; a season that never scrimmaged shows two lines, not three with a 0-0.
 */
export function splitByCompetition<T extends { eventType: string; isScrimmage?: boolean | null; result: string | null }>(
  games: readonly T[],
): { key: Competition; label: string; counted: boolean; tally: WltTally }[] {
  return COMPETITIONS
    .map(c => ({ key: c.key, label: c.label, counted: c.counted, tally: tallyResults(games.filter(g => competitionOf(g) === c.key)) }))
    .filter(r => r.tally.w + r.tally.l + r.tally.t > 0);
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
