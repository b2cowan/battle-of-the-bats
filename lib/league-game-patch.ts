/**
 * league-game-patch.ts — WHAT A HOUSE-LEAGUE GAME'S PATCH MAY CARRY FOR STATUS AND SCORE (9d-2a /review call 7, owner
 * 2026-10-28). A status outside the four a game can hold, or a score that is not a whole number of runs, used to reach the
 * database and come back as a 500; the window's person saw "something went wrong". Refused here with a plain sentence instead.
 *
 * Pure and client-safe. A score is both or neither: one side alone is a half-entered result (the game window says "Enter
 * both scores, or neither."), and a clear sends both as null.
 */

/** The four states a `league_games` row can hold (its check constraint). */
export const LEAGUE_GAME_STATUSES = ['scheduled', 'completed', 'cancelled', 'postponed'] as const;

const wholeScore = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** The sentence to send back with a 400, or null when the status and score are fine. */
export function invalidGamePatch(body: Record<string, unknown>): string | null {
  if ('status' in body && !(LEAGUE_GAME_STATUSES as readonly unknown[]).includes(body.status)) {
    return 'A game’s status must be scheduled, completed, cancelled or postponed.';
  }
  const hasHome = 'homeScore' in body, hasAway = 'awayScore' in body;
  if (hasHome !== hasAway) return 'Enter both scores, or neither.';
  if (hasHome && hasAway) {
    const home = body.homeScore ?? null, away = body.awayScore ?? null;
    if (home === null && away === null) return null;
    if (!wholeScore(home) || !wholeScore(away)) return 'A score must be a whole number, 0 or more. Enter both scores, or neither.';
  }
  return null;
}
