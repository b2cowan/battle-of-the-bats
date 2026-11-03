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

/** The most runs a side can be given: a bound the database's integer never reaches, so a typo is a sentence, not a 500. */
export const MAX_SCORE = 999;
const wholeScore = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_SCORE;

/**
 * ⚖ THE SCORE RULE (House League 9e-1): a game counts once both scores are in — the standings' one definition
 * (`gameCounts`). Read on the game as it will be (stored row + patch), because a status-only patch needs the stored
 * scores. Both in with no status: played (`completed`). Both cleared on a played game with no status: on again
 * (`scheduled`, the window's rule, now for a direct call too). A save that would leave a game completed without both
 * scores is refused; a patch that touches neither status nor score (a note on an old row) is not. Cancelled and
 * postponed are untouched. Call after `invalidGamePatch` (one score alone never reaches here).
 */
export function scoreRuleStatus(
  stored: { status: string; homeScore: number | null; awayScore: number | null },
  patch: { status?: string; homeScore?: number | null; awayScore?: number | null },
): { status: string | undefined } | 'refused' {
  const scoring = patch.homeScore !== undefined;
  const home = scoring ? patch.homeScore : stored.homeScore, away = scoring ? patch.awayScore : stored.awayScore;
  const bothIn = home != null && away != null;
  let status = patch.status;
  if (scoring && status === undefined) {
    if (bothIn) status = 'completed';
    else if (stored.status === 'completed') status = 'scheduled';
  }
  if ((scoring || status !== undefined) && (status ?? stored.status) === 'completed' && !bothIn) return 'refused';
  return { status };
}

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
    if (!wholeScore(home) || !wholeScore(away)) return `A score must be a whole number from 0 to ${MAX_SCORE}. Enter both scores, or neither.`;
  }
  return null;
}
