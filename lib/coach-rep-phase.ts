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
  /** a registered tournament is live today */
  liveNow: boolean;
  /** at least one finalized (result set, non-cancelled) game exists this season */
  hasFinalizedGame: boolean;
}

/**
 * Priority order is deliberate: a closed season is always the wrap view; a missing
 * roster always leads with setup; then game-day (today/live) beats a generic upcoming
 * event; then anything upcoming is in-season; then a played-out season with nothing
 * ahead is the afterglow; otherwise (roster set, nothing scheduled or played) we're
 * still in pre-season.
 */
export function deriveRepPhase(input: RepPhaseInput): CoachRepPhase {
  const { programYearStatus, rosterCount, nextEvent, nextEventDays, liveNow, hasFinalizedGame } = input;

  if (programYearStatus === 'completed' || programYearStatus === 'archived') return 'result';
  if (rosterCount === 0) return 'preseason';

  const nextIsGame = !!nextEvent && GAME_EVENT_TYPES.includes(nextEvent.eventType);
  if (liveNow || (nextIsGame && nextEventDays === 0)) return 'game_day';
  if (nextEvent) return 'in_season';
  if (hasFinalizedGame) return 'result';
  return 'preseason';
}
