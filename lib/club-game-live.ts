/**
 * lib/club-game-live.ts — THE live rule for a club's own games (rep and house league), Club Website Stage 1 G7 (owner
 * 2026-11-25, A: "one live rule for all three, the tournament's").
 *
 * The window is the tournament's (`lib/game-status.ts` isGameLive): from the scheduled start to the scheduled end plus
 * `LIVE_GRACE_MINUTES`, ended early by the final. A game with no end time runs the platform's one booking length. The two
 * numbers are imported, never restated, so "live" cannot mean two different spans on two programs.
 *
 * A REP game's final is the coach's End game: it writes `result`. A quiet score save in Game-Day Mode writes only the
 * scores (`lib/coach-game-day.ts` QUIET_ALLOWED_FIELDS), so "a score, no result" is a running score, never a finished tie.
 * Reading it as finished was the "T 4–2" defect on the public team page and the family schedule.
 *
 * Pure and dependency-light (no server-only import): a client component renders what it decides.
 */
import { DEFAULT_GAME_DURATION_MINUTES, LIVE_GRACE_MINUTES } from './game-status.ts';

/** The one spelling of the live word on every club surface (the tournament row's word, `PublicGameRow` STATUS_WORD). */
export const LIVE_NOW = 'Live now';

/** The live window of a club game as instants, or null when its start cannot be read. */
export function clubGameWindow(g: { startsAt: string; endsAt?: string | null }): { startMs: number; endMs: number } | null {
  const startMs = Date.parse(g.startsAt);
  if (Number.isNaN(startMs)) return null;
  const endParsed = g.endsAt ? Date.parse(g.endsAt) : NaN;
  const scheduledEnd = Number.isNaN(endParsed) || endParsed < startMs
    ? startMs + DEFAULT_GAME_DURATION_MINUTES * 60_000
    : endParsed;
  return { startMs, endMs: scheduledEnd + LIVE_GRACE_MINUTES * 60_000 };
}

/** Inside the live window right now (the clock alone; the caller says whether the game is over or cancelled). */
export function isInClubGameWindow(g: { startsAt: string; endsAt?: string | null }, now: number = Date.now()): boolean {
  const w = clubGameWindow(g);
  return !!w && now >= w.startMs && now < w.endMs;
}

/**
 * Where a rep game stands, from what the coach has saved and the clock:
 *  · `cancelled` — the coach cancelled it;
 *  · `final`     — End game was pressed (a result is saved), whatever the clock says;
 *  · `live`      — inside its window and not ended: the running score, if any, shows as live;
 *  · `unended`   — past its window with a score but no result (the coach never pressed End game): it is over and reads
 *                  as its score alone, never a result letter nobody saved;
 *  · `coming`    — not started, or past its window with nothing saved (we never invent a 0–0 or call it played).
 */
export type RepGamePhase = 'cancelled' | 'final' | 'live' | 'unended' | 'coming';

export interface RepGameFacts {
  startsAt: string;
  endsAt: string | null;
  status: string;
  result: 'win' | 'loss' | 'tie' | null;
  teamScore: number | null;
  opponentScore: number | null;
}

export function repGamePhase(g: RepGameFacts, now: number = Date.now()): RepGamePhase {
  if (g.status === 'cancelled') return 'cancelled';
  if (g.result !== null) return 'final';
  const w = clubGameWindow(g);
  // Before the start a saved score is not a game under way (Game-Day Mode opens two hours early), nor a finished one.
  if (!w || now < w.startMs) return 'coming';
  if (now < w.endMs) return 'live';
  if (g.teamScore !== null || g.opponentScore !== null) return 'unended';
  return 'coming';
}

/**
 * A newer render that already shows "Final" ignores an older check still saying "Live now": the edge holds a check for up
 * to 20 seconds, so a page rendered fresh can be newer than the check it fetches next. Compares the reads' `asOf`.
 */
export function isNewerGamesRead(incoming: { asOf: string }, shown: { asOf: string }): boolean {
  return Date.parse(incoming.asOf) > Date.parse(shown.asOf);
}

/** The 30-second check opens this long before the day's first game (G6). */
export const CHECK_OPENS_BEFORE_MINUTES = 30;

/**
 * WHEN A PAGE CHECKS FOR SCORES (G6, owner 2026-11-25): from half an hour before the day's first game to the end of the
 * last game's live window — the home's games part and the house league schedule, standings and season page alike. Null
 * on a day with no timed game: nothing checks. (Paused while the tab is hidden is the page's part.)
 */
export function gameDayCheckWindow(games: readonly { startsAt: string | null; endsAt?: string | null }[]): { fromMs: number; toMs: number } | null {
  let fromMs = Infinity, toMs = -Infinity;
  for (const g of games) {
    const w = g.startsAt ? clubGameWindow({ startsAt: g.startsAt, endsAt: g.endsAt }) : null;
    if (!w) continue;
    fromMs = Math.min(fromMs, w.startMs - CHECK_OPENS_BEFORE_MINUTES * 60_000);
    toMs = Math.max(toMs, w.endMs);
  }
  return fromMs < toMs ? { fromMs, toMs } : null;
}

/** Is the check on right now? */
export function isGameDayCheckOn(window: { fromMs: number; toMs: number } | null, now: number = Date.now()): boolean {
  return !!window && now >= window.fromMs && now < window.toMs;
}

/**
 * Where a HOUSE-LEAGUE game stands (G7). House league has no running score: its score arrives as a final, so inside the
 * window the row says "Score after the game" (`live`), and once the window has passed with no score it is a result still
 * owed (`noScore`, "No score yet" under Latest results). Final is the shipped schedule's own test (`resultWords`,
 * lib/league-season-calendar.ts): completed with both scores.
 */
export type LeagueGamePhase = 'cancelled' | 'postponed' | 'final' | 'live' | 'noScore' | 'coming';

export function leagueGamePhase(g: {
  scheduledAt: string | null; endsAt: string | null; status: string; homeScore: number | null; awayScore: number | null;
}, now: number = Date.now()): LeagueGamePhase {
  if (g.status === 'cancelled') return 'cancelled';
  if (g.status === 'postponed') return 'postponed';
  if (g.status === 'completed' && g.homeScore !== null && g.awayScore !== null) return 'final';
  const w = g.scheduledAt ? clubGameWindow({ startsAt: g.scheduledAt, endsAt: g.endsAt }) : null;
  if (!w || now < w.startMs) return 'coming';
  return now < w.endMs ? 'live' : 'noScore';
}

/**
 * The two facts a rep schedule row carries (`lib/family-view.ts` FamilyScheduleEntry): is it OVER, and is it LIVE. Only the
 * team's OWN game (`ownGame`: a game the coach keeps, not one copied from a tournament) is ever live by this rule; any other
 * entry is over once something was saved against it, as before, and never live:
 *  · a practice or a multi-day tournament entry;
 *  · a game COPIED from a tournament (`source_tournament_game_id`): the tournament's own rule is its truth, and the copy
 *    carries neither the tournament's game length nor its status, and is refreshed only when a coach opens the schedule —
 *    so the club's window would call a game live that the tournament has finished. (The home drops copies outright, tab 7.)
 *    Its result is set only when the organizer finalizes, so an unconfirmed score reads as the score alone.
 * A cancelled game keeps that rule too: it is struck through, never live.
 */
export function repEntryState(g: RepGameFacts & { ownGame: boolean }, now: number = Date.now()): { completed: boolean; live: boolean } {
  const saved = g.result !== null || g.teamScore !== null || g.opponentScore !== null;
  if (!g.ownGame || g.status === 'cancelled') return { completed: saved, live: false };
  const phase = repGamePhase(g, now);
  return { completed: phase === 'final' || phase === 'unended', live: phase === 'live' };
}
