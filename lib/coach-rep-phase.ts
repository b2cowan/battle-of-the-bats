// Derives the current "season phase" for the Premium Coaches Portal team Overview,
// so the Overview's top "Right now" anchor can adapt (pre-season / in-season /
// game-day / result). This is a REP-TEAM season model — deliberately distinct from
// the tournament-registration phase in lib/coach-tournament-phase.ts (a rep team has
// a program year + a schedule, not a single registration lifecycle).
//
// Design: the anchor ports THIS logic but renders in the operating-tool dashboard
// card language, never the celebratory TeamHQ hero skin (design_decisions 2026-07-04).

export type CoachRepPhase = 'preseason' | 'in_season' | 'game_day' | 'result';

const GAME_EVENT_TYPES = ['league_game', 'tournament_game', 'scrimmage'];

export interface RepPhaseInput {
  /** rep_program_years.status ('draft' | 'active' | 'completed' | 'archived') */
  programYearStatus: string;
  /** active roster player count */
  rosterCount: number;
  /** the next upcoming scheduled event, if any */
  nextEvent: { eventType: string; startsAt: string } | null;
  /** whole days until the next event (0 = today), null when nothing upcoming */
  nextEventDays: number | null;
  /** at least one finalized (result set, non-cancelled) game exists this season */
  hasFinalizedGame: boolean;
  /** the team has an upcoming (or currently-live) registered tournament */
  hasUpcomingTournament: boolean;
}

/**
 * Priority order is deliberate:
 *  - The afterglow/result view is ONLY shown for a season the coach has actually closed
 *    (status completed/archived). It is never INFERRED from "a game was played and nothing
 *    is on the schedule" — plenty of active teams have no future games queued yet, or track
 *    their next event as a tournament, so inferring "season over" there is wrong.
 *  - A missing roster always leads with setup.
 *  - Game day is a SCHEDULED game happening today (which always has an event to show). A
 *    live tournament with no scheduled game is handled as in-season ("your tournament is on"),
 *    not game-day — the game-day card is built around a scheduled game's opponent/lineup.
 *  - Anything scheduled ahead is in-season.
 *  - Nothing scheduled but the season is still open, with a played game or an upcoming
 *    tournament, is an in-season lull (still in_season) — the anchor shows a "nothing
 *    scheduled" state, not the afterglow.
 *  - Only a brand-new team (roster set, nothing scheduled, no history, no tournament) is
 *    pre-season.
 */
export function deriveRepPhase(input: RepPhaseInput): CoachRepPhase {
  const {
    programYearStatus,
    rosterCount,
    nextEvent,
    nextEventDays,
    hasFinalizedGame,
    hasUpcomingTournament,
  } = input;

  if (programYearStatus === 'completed' || programYearStatus === 'archived') return 'result';
  if (rosterCount === 0) return 'preseason';

  const nextIsGame = !!nextEvent && GAME_EVENT_TYPES.includes(nextEvent.eventType);
  if (nextIsGame && nextEventDays === 0) return 'game_day';
  if (nextEvent) return 'in_season';
  if (hasFinalizedGame || hasUpcomingTournament) return 'in_season';
  return 'preseason';
}
