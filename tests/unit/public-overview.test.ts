import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gameDayLists } from '../../lib/public-overview.ts';
import type { Game } from '../../lib/types.ts';

/**
 * WHICH GAMES THE GAME-DAY OVERVIEW LISTS (Public tournament pages Stage 2 Part 2, plan §5): Live now, the next 4, the
 * last 3 finals. The clock is pinned: Saturday 24 October 2026, 2:00 p.m. in the club's zone (Toronto, UTC−4).
 */
const TODAY = '2026-10-24';
const NOW = new Date('2026-10-24T18:00:00Z'); // 2:00 p.m. Toronto
let n = 0;
const game = (over: Partial<Game>): Game => ({
  id: `g${++n}`, divisionId: 'd1', date: TODAY, time: '16:00', status: 'scheduled', isPlayoff: false,
  homeTeamId: 'a', awayTeamId: 'b', homeScore: null, awayScore: null, durationMinutes: 90, ...over,
} as Game);
const ids = (gs: Game[]) => gs.map(g => g.id);

describe('Live now and Up next never share a game', () => {
  it('a game inside its window is live, not next', () => {
    const live = game({ time: '13:30' });
    const later = game({ time: '16:00' });
    const { live: l, upNext } = gameDayLists([later, live], TODAY, NOW);
    assert.deepEqual(ids(l), [live.id]);
    assert.deepEqual(ids(upNext), [later.id]);
  });
});

describe('Up next', () => {
  it('today: only games still to start; a past-due unreported game and a game with no time do not pin (J6-039)', () => {
    const pastDue = game({ time: '09:00' });
    const noTime = game({ time: '' });
    const later = game({ time: '17:30' });
    assert.deepEqual(ids(gameDayLists([pastDue, noTime, later], TODAY, NOW).upNext), [later.id]);
  });
  it('then the coming days, in order, 4 at most; an earlier day and a finished game never', () => {
    const yesterday = game({ date: '2026-10-23', time: '18:00' });
    const done = game({ time: '17:00', status: 'completed', homeScore: 1, awayScore: 0 });
    const a = game({ time: '15:00' });
    const b = game({ time: '18:00' });
    const c = game({ date: '2026-10-25', time: '09:00' });
    const d = game({ date: '2026-10-25', time: '' });
    const e = game({ date: '2026-10-25', time: '11:00' });
    assert.deepEqual(ids(gameDayLists([e, d, c, b, a, done, yesterday], TODAY, NOW).upNext), [a.id, b.id, d.id, c.id]);
  });
});

describe('Latest results', () => {
  it('the 3 newest finals with both scores; a submitted or scoreless game is not a result', () => {
    const r1 = game({ date: '2026-10-23', time: '09:00', status: 'completed', homeScore: 2, awayScore: 1 });
    const r2 = game({ time: '09:00', status: 'completed', homeScore: 3, awayScore: 1 });
    const r3 = game({ time: '11:00', status: 'completed', homeScore: 4, awayScore: 1 });
    const r4 = game({ time: '12:00', status: 'completed', homeScore: 5, awayScore: 1 });
    const pending = game({ time: '12:30', status: 'submitted', homeScore: 1, awayScore: 1 });
    const scoreless = game({ time: '12:45', status: 'completed' });
    assert.deepEqual(ids(gameDayLists([r1, r2, r3, r4, pending, scoreless], TODAY, NOW).latest), [r4.id, r3.id, r2.id]);
  });
});
