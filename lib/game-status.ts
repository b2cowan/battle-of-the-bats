/**
 * lib/game-status.ts
 * THE single source of truth for "is this game live?" and "what public state is
 * it in?" on fan-facing tournament surfaces (J6-013). Before this, every surface
 * decided "live" differently — the schedule/dock/game-detail/OG keyed on
 * `status === 'submitted' && date === today` (score-submission state: lit late,
 * never turned off), while the team profile used the OPPOSITE time-window slice,
 * so one game could read LIVE on one screen and a finished tie on another.
 *
 * The model here is time-window driven, not score driven: a game is LIVE when the
 * clock is inside its scheduled window (start … start + duration + grace) and it
 * hasn't been finalized/cancelled — regardless of whether a score has been entered
 * yet. That makes it light on time (even before the first run) and turn OFF when the
 * window passes. Day-boundary math uses the tournament timezone (lib/timezone.ts),
 * not the server's UTC, so it doesn't flip at 8 PM Eastern (J6-056).
 *
 * Public status precedence: cancelled → live → final (completed, or submitted when
 * the org doesn't require finalization) → unofficial (submitted, finalization
 * required, not live) → upcoming.
 */
import { zonedWallClockToUtc } from './timezone';
import type { Game, PublicTeam } from './types';

/** Minutes after a game's scheduled end during which it still reads LIVE — covers
 *  extra innings / clock overruns before it settles into its score state. */
export const LIVE_GRACE_MINUTES = 30;

/** Live-window length used when a game carries no per-game duration override —
 *  matches `SYSTEM_TIMING_DEFAULTS.durationMinutes` in lib/schedule-conflict.ts.
 *  Callers pass `game.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES`. */
export const DEFAULT_GAME_DURATION_MINUTES = 90;

export type LiveGameInput = {
  status: string;
  date?: string | null;
  time?: string | null;
};

/**
 * Is this game happening right now? Time-window based (tournament-timezone aware),
 * never true for a finalized (`completed`) or `cancelled` game.
 *
 * @param durationMinutes resolved per-game length (caller passes the game's own
 *                        duration, falling back to the tournament default).
 * @param now             injectable for tests; defaults to the current instant.
 */
export function isGameLive(
  game: LiveGameInput,
  durationMinutes: number,
  now: Date = new Date(),
): boolean {
  // Finalized, forfeited, or cancelled games are never live — a terminal result
  // beats the time window (forfeit is a terminal app-level status, lib/types.ts).
  if (game.status === 'completed' || game.status === 'forfeit' || game.status === 'cancelled') return false;
  const startIso = zonedWallClockToUtc(game.date, game.time);
  if (!startIso) return false;
  const startMs = Date.parse(startIso);
  if (Number.isNaN(startMs)) return false;
  const endMs = startMs + (durationMinutes + LIVE_GRACE_MINUTES) * 60_000;
  const nowMs = now.getTime();
  return nowMs >= startMs && nowMs < endMs;
}

/** The game's scheduled kickoff as epoch milliseconds (tournament-timezone aware),
 *  or null if date/time are missing/malformed. Use for time-aware "next game"
 *  selection so a past-due unscored game stops pinning as NEXT all day (J6-039). */
export function gameStartMs(game: Pick<LiveGameInput, 'date' | 'time'>): number | null {
  const iso = zonedWallClockToUtc(game.date, game.time);
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** True if the game's scheduled start is still in the future (tournament-timezone
 *  aware). Hides the "now" read inside the helper so it stays pure at React render
 *  call sites — pair with a status check for "next game" selection (J6-039). */
export function isGameUpcoming(game: Pick<LiveGameInput, 'date' | 'time'>, now: Date = new Date()): boolean {
  const startMs = gameStartMs(game);
  return startMs != null && startMs > now.getTime();
}

export type PublicGameState = 'upcoming' | 'live' | 'unofficial' | 'final' | 'cancelled';

/**
 * The one public state a game should render in, consistently, on every fan surface.
 * Pass the org's `requireScoreFinalization` so a submitted-but-unconfirmed score
 * reads "Unofficial" rather than "Final" only where the organizer asked for that
 * extra step.
 */
export function publicGameStatus(
  game: LiveGameInput,
  durationMinutes: number,
  requireFinalization: boolean,
  now: Date = new Date(),
): PublicGameState {
  if (game.status === 'cancelled') return 'cancelled';
  if (isGameLive(game, durationMinutes, now)) return 'live';
  if (game.status === 'completed' || game.status === 'forfeit') return 'final';
  if (game.status === 'submitted') return requireFinalization ? 'unofficial' : 'final';
  return 'upcoming';
}

/** Fan-language label for a public game state — no organizer workflow vocabulary
 *  ("pending", "awaiting finals", "score review") ever reaches a fan (J6-007). */
export function publicGameStatusLabel(state: PublicGameState): string {
  switch (state) {
    case 'live': return 'Live';
    case 'unofficial': return 'Unofficial';
    case 'final': return 'Final';
    case 'cancelled': return 'Cancelled';
    default: return 'Upcoming';
  }
}

export interface TeamGameSelection {
  live: Game | null;
  next: Game | null;
  lastResult: Game | null;
}

/**
 * For one team's games in a tournament, pick the single most relevant game per
 * bucket — live now, next scheduled, most recent result — mirroring the "my
 * team" precedence (live > next > final) already used on the Schedule/Standings
 * pages, so a followed team never reads a different state on one surface than
 * another (J6-013 in cross-tournament form). `lastResult` includes forfeited
 * games (any terminal, scored state), not just `completed`/`submitted`.
 */
export function selectTeamGames(
  games: Game[],
  teamId: string,
  today: string,
  now: Date = new Date(),
): TeamGameSelection {
  const teamGames = games
    .filter(g => g.status !== 'cancelled' && (g.homeTeamId === teamId || g.awayTeamId === teamId))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time || '').localeCompare(b.time || '');
    });

  const live = teamGames.find(
    g => isGameLive(g, g.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES, now),
  ) ?? null;

  const next = teamGames.find(
    g => g.status === 'scheduled' && (gameStartMs(g) == null ? g.date >= today : isGameUpcoming(g, now)),
  ) ?? null;

  // teamGames is already sorted ascending — the last match in filtered order
  // is the most recent result, no second (descending) sort needed.
  const lastResult = teamGames
    .filter(g =>
      g.status !== 'scheduled' &&
      g.homeScore != null &&
      g.awayScore != null &&
      !isGameLive(g, g.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES, now),
    )
    .at(-1) ?? null;

  return { live, next, lastResult };
}

/** The opposing team's display name for a game from `teamId`'s perspective — resolved from
 *  the tournament's public team list, falling back to the placeholder slot (e.g.
 *  "Winner of QF1") or null. Shared by every cross-tournament team feed (Following + Scores). */
export function opponentNameFor(game: Game, teamId: string, teams: PublicTeam[]): string | null {
  const isHome = game.homeTeamId === teamId;
  const oppId = isHome ? game.awayTeamId : game.homeTeamId;
  return teams.find(t => t.id === oppId)?.name
    ?? (isHome ? game.awayPlaceholder : game.homePlaceholder)
    ?? null;
}

/** A game's score from `teamId`'s perspective — `my` is teamId's score, `opp` the other side. */
export function teamScoreFor(game: Game, teamId: string): { my: number | null; opp: number | null } {
  const isHome = game.homeTeamId === teamId;
  return {
    my: (isHome ? game.homeScore : game.awayScore) ?? null,
    opp: (isHome ? game.awayScore : game.homeScore) ?? null,
  };
}
