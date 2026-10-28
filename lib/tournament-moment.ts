/**
 * lib/tournament-moment.ts — WHICH MOMENT A TOURNAMENT'S OVERVIEW ANSWERS (Public tournament pages, Stage 2; plan
 * docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md §5, Ask 3).
 *
 * The frame-on Overview is three pages in one: BEFORE the event (the Register card, the facts), GAME DAY (Live now, Up
 * next, Latest results) and AFTER it (the champions first). This decides which, from the inputs the Overview already
 * loads. Pure, so tests/unit/tournament-moment.test.ts pins its table.
 *
 * ⚠ `finished` IS TODAY'S OVERVIEW RULE, EXACTLY (components/public/TournamentHomeContent.tsx `isFinished`): the
 * organizer completed it, or — never while a division's schedule is withheld (Stage 0 · D1) — the bracket is decided
 * with nothing left to play, or a no-bracket event has played out on or after its last day. The crowned stamp is NOT
 * part of it (a game rescheduled after the final keeps the page on game day). Six other surfaces carry their own
 * copies of a finished rule; rewiring them to this one is a named follow-up (plan §9, Stage 2), not this stage's.
 */
import { isTournamentPlayoffsComplete } from './champions';
import type { Division, Game } from './types';

export type TournamentMoment = 'before' | 'gameDay' | 'after';

export interface TournamentMomentInput {
  tournament: { status: string; startDate?: string | null; endDate?: string | null; championsCrownedAt?: string | null };
  /** The club's today, YYYY-MM-DD (`tournamentToday()`). */
  today: string;
  /** The games families can see (`readPublicGames`), and every division. */
  games: Game[];
  divisions: Division[];
  /** A division's schedule is held back (`readPublicGames`'s `withheld`). */
  scheduleWithheld: boolean;
  /** The event takes sign-ups now: the Register page is on and `getRegistrationState` offers a CTA. */
  registrationOpen: boolean;
}

export interface TournamentMomentState {
  moment: TournamentMoment;
  /** Today's Overview's `isFinished`. */
  finished: boolean;
  /** Sign-ups are open and the event has not started — the Register card's condition. */
  registrationOpen: boolean;
  /** A game (not cancelled) is on today's date. */
  gamesToday: boolean;
  /** The one-time "Champions crowned" stamp — what the band's Finished reads (lib/club-site-home.ts). */
  championCrowned: boolean;
  scheduleWithheld: boolean;
}

const isTerminal = (g: Game) => g.status === 'completed' || g.status === 'forfeit' || g.status === 'cancelled';

export function tournamentMoment(input: TournamentMomentInput): TournamentMomentState {
  const { tournament, today, games, divisions, scheduleWithheld } = input;
  const startDate = tournament.startDate ?? null;
  const endDate = tournament.endDate ?? null;

  const playoffsComplete = isTournamentPlayoffsComplete(games, divisions);
  const hasPlayoffGames = games.some(g => g.isPlayoff);
  const allGamesTerminal = games.length > 0 && games.every(isTerminal);
  const noUnplayedGames = !games.some(g => g.status === 'scheduled');
  const eventEnded = !endDate || today >= endDate;
  const roundRobinComplete = !hasPlayoffGames && allGamesTerminal && eventEnded;
  const finished =
    tournament.status === 'completed' ||
    (!scheduleWithheld && ((playoffsComplete && noUnplayedGames) || roundRobinComplete));

  // Not finished and started (inside its dates, or past them with games still unscored) is game day: what a family
  // needs then is the games, never a Register card. No start date yet is before.
  const started = !!startDate && today >= startDate;
  const moment: TournamentMoment = finished ? 'after' : started ? 'gameDay' : 'before';

  return {
    moment,
    finished,
    registrationOpen: input.registrationOpen && moment === 'before',
    gamesToday: games.some(g => g.date === today && g.status !== 'cancelled'),
    championCrowned: !!tournament.championsCrownedAt,
    scheduleWithheld,
  };
}
