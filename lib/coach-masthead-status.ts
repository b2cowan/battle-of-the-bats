// What the team masthead's status line says today — the SELECTION half, pure and unit-tested.
//
// The masthead sits on every premium team page, so this is the portal's most-seen sentence and the
// one with the least room to be wrong. Two rules govern it:
//
//  1. **Game day is not re-derived here.** `deriveRepPhase` (lib/coach-rep-phase.ts) already owns
//     "is it game day", and the Overview's anchor asks it the same question. A second predicate
//     that agreed today would drift tomorrow — the masthead and the card beneath it would then
//     disagree about the single most important day of a coach's week.
//  2. **Selection here, copy in the component** (Chunk I's resolver rule). This file decides WHICH
//     of the three states holds and hands back the pieces; the masthead writes the sentence.
import { deriveRepPhase } from './coach-rep-phase';
import { calendarDaysBetween, formatInOrgZone } from './timezone';
import type { WltTally } from './coach-season-record';

/**
 * A decided-game tally for one season — the SAME shape every other record surface uses, re-exported
 * here (rather than redeclared) so the client masthead can name the type without importing the
 * `server-only` module that fills it.
 */
export type MastheadRecord = WltTally;

/** The one upcoming event the status line can talk about. */
export interface MastheadEvent {
  eventType: string;
  /** ISO datetime. */
  startsAt: string;
  opponent: string | null;
  name: string;
}

export interface MastheadStatusInput {
  /** `rep_program_years.status` of the season being shown. */
  programYearStatus: string;
  /** The next scheduled event on that season, or null when nothing is ahead. */
  nextEvent: MastheadEvent | null;
  /** At least one decided game this season — only affects phases the masthead doesn't render. */
  hasFinalizedGame: boolean;
  /** Injectable clock (tests). */
  now?: Date;
}

export type MastheadStatus =
  | { kind: 'game_day'; event: MastheadEvent; daysAway: number }
  | { kind: 'next'; event: MastheadEvent; daysAway: number }
  | null;

/**
 * Game day → the game. Anything else ahead → the next thing. Nothing ahead → NOTHING: a quiet week
 * adds no chrome, and "nothing scheduled" in a bar the coach cannot act from would be a nag.
 */
export function resolveMastheadStatus(input: MastheadStatusInput): MastheadStatus {
  const { programYearStatus, nextEvent, hasFinalizedGame, now = new Date() } = input;
  if (!nextEvent) return null;

  // Calendar-day gap in the ORG's zone, never a rolling 24h count — so a game later today reads 0
  // ("Game day") rather than 1 ("Tomorrow"). Raw UTC date math is the guardrail this obeys.
  const daysAway = Math.max(0, calendarDaysBetween(now, new Date(nextEvent.startsAt)));

  const phase = deriveRepPhase({
    programYearStatus,
    // ⚠ 1, not a real count. An UNKNOWN roster is not an EMPTY one — the Overview's own convention
    // where the roster isn't readable (a zero would short-circuit the phase to pre-season and hide
    // game day). The masthead never reads the roster, so its count is always unknown.
    //
    // KNOWN, ACCEPTED DIVERGENCE (/review 2026-08-02): a team with NO roster yet but a game already
    // on today's schedule gets "Game day" here while the Overview's anchor — which does read the
    // roster — shows a pre-season setup card. Both are true statements about different things (a
    // scheduled fact vs. what to do next), and buying agreement would cost a roster count query on
    // every team page for a team that has scheduled a game before adding a single player.
    rosterCount: 1,
    nextEvent: { eventType: nextEvent.eventType, startsAt: nextEvent.startsAt },
    nextEventDays: daysAway,
    hasFinalizedGame,
    // The masthead has no tournament-registration read, and this input only separates two phases
    // it never renders (pre-season vs an in-season lull) — both fall through to "next".
    hasUpcomingTournament: false,
  });

  // A closed season has no "next" — its frame is the Complete chip + final record instead.
  if (phase === 'result') return null;
  return { kind: phase === 'game_day' ? 'game_day' : 'next', event: nextEvent, daysAway };
}

/**
 * When an event is, in the fewest honest words: `Today` / `Thu` / `Aug 23`, plus the org-zone clock.
 *
 * The weekday is only used INSIDE the coming week — "Thu" three weeks out names a Thursday the
 * coach doesn't mean, so past six days it becomes a date.
 */
export function mastheadWhen(startsAt: string, daysAway: number): { day: string; time: string } {
  const time = formatInOrgZone(startsAt, { hour: 'numeric', minute: '2-digit' });
  const day = daysAway === 0
    ? 'Today'
    : daysAway <= 6
      ? formatInOrgZone(startsAt, { weekday: 'short' })
      : formatInOrgZone(startsAt, { month: 'short', day: 'numeric' });
  return { day, time };
}
