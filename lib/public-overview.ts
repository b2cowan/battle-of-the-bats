/**
 * lib/public-overview.ts — WHICH GAMES THE GAME-DAY OVERVIEW LISTS (Public tournament pages Stage 2 Part 2; plan
 * docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md §5). Pure, so tests/unit/public-overview.test.ts pins it.
 *
 *   · LIVE NOW — every game inside its live window (`isGameLive`), one card each; never also in Up next.
 *   · UP NEXT — the next 4 games still to start: today's only once their start time is still ahead (a past-due game
 *     nobody has reported does not pin as next all day, J6-039; a game today with no time has no honest place in a
 *     time-ordered list, and the Schedule still lists it), then the coming days'.
 *   · LATEST RESULTS — the 3 newest finals with both scores.
 *
 * The caller passes the games families can see (`readPublicGames`): a division whose schedule is held back is never in
 * them, so it cannot reach any of the three lists (Stage 0 · D1).
 */
import { isGameLive, gameStartMs, DEFAULT_GAME_DURATION_MINUTES } from './game-status';
import type { Game } from './types';

const UP_NEXT_ROWS = 4;
const LATEST_RESULT_ROWS = 3;

const byStart = (a: Game, b: Game) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || '');

export function gameDayLists(games: Game[], today: string, now: Date = new Date()): { live: Game[]; upNext: Game[]; latest: Game[] } {
  const sorted = [...games].sort(byStart);
  const live = sorted.filter(g => isGameLive(g, g.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES, now));
  const liveIds = new Set(live.map(g => g.id));
  const upNext = sorted
    .filter(g => {
      if (g.status !== 'scheduled' || liveIds.has(g.id) || !g.date || g.date < today) return false;
      if (g.date > today) return true;
      const start = gameStartMs(g);
      return start != null && start > now.getTime();
    })
    .slice(0, UP_NEXT_ROWS);
  const latest = sorted
    .filter(g => g.status === 'completed' && g.homeScore != null && g.awayScore != null)
    .reverse()
    .slice(0, LATEST_RESULT_ROWS);
  return { live, upNext, latest };
}
