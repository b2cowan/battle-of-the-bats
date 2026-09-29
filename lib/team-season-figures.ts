/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A TEAM'S TWO HEADLINE FIGURES — ONE RULE EACH, WRITTEN ONCE (Club Tier Stage 2, B08).
 *
 * The club side counted a team's roster three ways and its record two ways:
 *   · roster — the Rep Teams cards counted every season's rows (a team of 14 read 27: the 13 still
 *     standing on last season's roster were added in); the history list and past seasons counted
 *     inactive players AND call-ups; the history detail excluded call-ups but kept inactive ones.
 *   · record — the season schedule's widget counted league games only; the history detail counted
 *     cancelled games that still carried a score; the history list dropped them.
 *
 * Every club read now asks these two functions (a guard test holds each surface to it:
 * `tests/unit/club-stage2-server-guard.test.ts`).
 *
 * ⚠ PURE (no database) so client pages and server reads share it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { countsTowardRecord } from './season-wrapped';
import { tallyResults, type WltTally } from './coach-season-record';

/**
 * THE ROSTER RULE: a player counts on a season's roster when they are ACTIVE on it. Never a call-up
 * (a borrowed player is in a game, not on the team — mig 309 made that a status of its own) and
 * never an inactive player. Applied per season; "the roster" of a team is its LIVE season's.
 */
export function countsOnRoster(player: { status: string }): boolean {
  return player.status === 'active';
}

export function rosterCountOf(players: readonly { status: string }[]): number {
  return players.filter(countsOnRoster).length;
}

/**
 * THE RECORD RULE: a FINALIZED game that counts toward the record — league and tournament games
 * (`countsTowardRecord`: never a scrimmage), with a result, and not cancelled (cancelling keeps the
 * row and any score already typed, so the result alone is not enough).
 */
export function countsInRecord(e: {
  eventType: string; isScrimmage?: boolean | null; result: string | null; status?: string | null;
}): boolean {
  return countsTowardRecord(e) && e.result != null && e.status !== 'cancelled';
}

export function seasonRecordOf(events: readonly {
  eventType: string; isScrimmage?: boolean | null; result: string | null; status?: string | null;
}[]): WltTally {
  return tallyResults(events.filter(countsInRecord));
}

/** True when a season has at least one decided game — "No games yet" otherwise. */
export function hasDecidedGames(tally: WltTally): boolean {
  return tally.w + tally.l + tally.t > 0;
}
