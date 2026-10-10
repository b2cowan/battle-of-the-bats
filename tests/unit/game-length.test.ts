import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_BOOKING_MINUTES, gameLengthMinutes } from '../../lib/booking-length.ts';
import { resolveGameTiming } from '../../lib/schedule-conflict.ts';
import { tournamentGameMinutes } from '../../lib/venue-clash.ts';
import { buildScheduleMetrics, type ScheduleMetricGame } from '../../lib/schedule-metrics.ts';
import { gameWindowState, scheduledWindowState } from '../../lib/game-live-state.ts';
import type { Division, Tournament } from '../../lib/types.ts';

/**
 * Tournament admin redesign Stage 3, Part 1 — ONE game length (ask A39, F76; shared with Club Tier Stage 6a).
 *
 * A game's length is the game's own, else its division's, else its tournament's, else the one booking length (90).
 * Before: the board read game → tournament → 60 (Playing now turned to Needs a score after an hour), the scorekeeper
 * read every game as 90 (its read sent no length and no setting), the board's health measured every game at the
 * tournament's length, and the round-robin generator saved none. Every reader now asks the one chain.
 */

const GAME = 120, DIVISION = 75, TOURNAMENT = 100;
/** Every combination of the three links, set or unset, with the answer the chain owes. */
const CASES: Array<{ name: string; game?: number; division?: number; tournament?: number; want: number }> = [
  { name: 'all three set: the game', game: GAME, division: DIVISION, tournament: TOURNAMENT, want: GAME },
  { name: 'game and division: the game', game: GAME, division: DIVISION, want: GAME },
  { name: 'game and tournament: the game', game: GAME, tournament: TOURNAMENT, want: GAME },
  { name: 'only the game', game: GAME, want: GAME },
  { name: 'division and tournament: the division', division: DIVISION, tournament: TOURNAMENT, want: DIVISION },
  { name: 'only the division', division: DIVISION, want: DIVISION },
  { name: 'only the tournament', tournament: TOURNAMENT, want: TOURNAMENT },
  { name: 'nothing set: the one booking length', want: DEFAULT_BOOKING_MINUTES },
];

const division = (minutes?: number) => ({ id: 'd1', settings: minutes === undefined ? {} : { game_duration_minutes: minutes } }) as unknown as Division;
const tournament = (minutes?: number) => ({ id: 't1', settings: minutes === undefined ? {} : { game_duration_minutes: minutes } }) as unknown as Tournament;

/** Two games on one diamond: the second starts `gapMinutes` after the first. The health engine calls them overlapping
 *  only while the first is still being played — so the overlap flips exactly at the first game's length. */
function overlaps(gapMinutes: number, c: (typeof CASES)[number]): boolean {
  const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const g = (id: string, start: number, own?: number): ScheduleMetricGame => ({
    id, divisionId: 'd1', homeTeamId: `${id}h`, awayTeamId: `${id}a`, date: '2026-06-13', time: hh(start),
    venueId: 'v1', venueFacilityId: 'f1', location: 'Park — Diamond 1', status: 'scheduled', durationMinutes: own ?? null,
  });
  const metrics = buildScheduleMetrics({
    games: [g('a', 9 * 60, c.game), g('b', 9 * 60 + gapMinutes, c.game)],
    teams: [],
    divisions: [division(c.division)],
    venues: [],
    tournament: tournament(c.tournament),
    bufferMinutes: 0,
  });
  return metrics.venueConflictCount > 0;
}

describe('the one chain', () => {
  for (const c of CASES) {
    test(c.name, () => {
      assert.equal(gameLengthMinutes(c.game, c.division, c.tournament), c.want);
    });
  }
  test('a length nobody set — zero, negative, not a number, Infinity — is skipped, not used', () => {
    for (const bad of [0, -30, Number.NaN, Number.POSITIVE_INFINITY, '90', null, undefined]) {
      assert.equal(gameLengthMinutes(bad, DIVISION), DIVISION, String(bad));
    }
  });
});

describe('every reader gives the same length', () => {
  for (const c of CASES) {
    test(c.name, () => {
      // the clash check, the timeline, Results and the schedule's list read it through resolveGameTiming
      assert.equal(resolveGameTiming(division(c.division), tournament(c.tournament), c.game).durationMinutes, c.want, 'resolveGameTiming');
      // the club calendar's cross-program check (Club 6a's lookup) keeps its own copy of the chain — held to the same answer
      assert.equal(tournamentGameMinutes({ duration_minutes: c.game ?? null }, c.division, c.tournament), c.want, 'tournamentGameMinutes');
      // the schedule's health (and the board's, which hands each game its chain length): overlapping until the length
      assert.equal(overlaps(c.want - 5, c), true, `health: still playing ${c.want - 5} min in`);
      assert.equal(overlaps(c.want, c), false, `health: done at ${c.want} min`);
    });
  }
  test("a preview's length box stands in for the division and tournament, never over a game's own", () => {
    const own = (minutes: number | null) => ({ id: 'x', divisionId: 'd1', homeTeamId: 'h', awayTeamId: 'a', date: '2026-06-13', time: '09:00', venueId: 'v1', venueFacilityId: 'f1', location: 'Park — Diamond 1', status: 'scheduled', durationMinutes: minutes }) as ScheduleMetricGame;
    const second = { ...own(null), id: 'y', homeTeamId: 'h2', awayTeamId: 'a2', time: '10:50' };
    const run = (first: ScheduleMetricGame) => buildScheduleMetrics({ games: [first, second], teams: [], divisions: [division(DIVISION)], venues: [], tournament: tournament(TOURNAMENT), gameDurationMinutes: 60, bufferMinutes: 0 }).venueConflictCount;
    assert.equal(run(own(120)), 1, "the game's own 120 overlaps a game 110 minutes later");
    assert.equal(run(own(null)), 0, 'a game with no length of its own is spaced by the box (60)');
  });
});

describe("the board's Playing now ends at the chain's length", () => {
  const START = Date.parse('2026-06-13T13:00:00Z');
  const min = 60_000;
  for (const c of CASES) {
    test(c.name, () => {
      const len = gameLengthMinutes(c.game, c.division, c.tournament);
      assert.equal(scheduledWindowState(START, len, START + (len - 1) * min), 'live');
      assert.equal(scheduledWindowState(START, len, START + len * min), 'overdue');
    });
  }
  test('a game whose length is set nowhere reads Playing now for 90 minutes, not 60', () => {
    const len = gameLengthMinutes(undefined, undefined, undefined);
    assert.equal(scheduledWindowState(START, len, START + 61 * min), 'live');
    assert.equal(scheduledWindowState(START, len, START + 90 * min), 'overdue');
  });
  test('a nonsense length falls back to the one booking length, not 60', () => {
    assert.equal(scheduledWindowState(START, 0, START + 61 * min), 'live');
    assert.equal(scheduledWindowState(START, Number.NaN, START + 90 * min), 'overdue');
  });
  test('the wall-clock wrapper reads the same window', () => {
    // 9:00 a.m. in the org's zone; a 75-minute division game is live at 10:14 and needs a score at 10:15.
    const at = (hhmm: string) => Date.parse(`2026-06-13T${hhmm}:00-04:00`);
    const len = gameLengthMinutes(null, DIVISION, TOURNAMENT);
    assert.equal(gameWindowState({ date: '2026-06-13', time: '09:00', durationMinutes: len, nowMs: at('10:14'), today: '2026-06-13' }), 'live');
    assert.equal(gameWindowState({ date: '2026-06-13', time: '09:00', durationMinutes: len, nowMs: at('10:15'), today: '2026-06-13' }), 'overdue');
  });
});

describe('the readers ask the chain (source guard — a new hard-coded length fails here)', () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  test("the board's route reads each game's length by the chain, for Playing now and for health", () => {
    const src = read('app/api/admin/tournament-dashboard/route.ts');
    assert.match(src, /gameLengthMinutes\(g\.duration_minutes, g\.division_id \? divisionMinutesById\.get\(g\.division_id\)/);
    assert.match(src, /durationMinutes: lengthOf\(g\)/);
    assert.match(src, /durationMinutes: lengthOf\(game\)/);
    assert.doesNotMatch(src, /\?\? 60\b/);
    assert.doesNotMatch(src, /gameDurationMinutes: positiveNumber\(tSettings\.game_duration_minutes\)/);
  });
  test("the scorekeeper's read resolves the chain where the settings are", () => {
    const src = read('app/api/official/[orgSlug]/score/get-score.ts');
    assert.match(src, /duration_minutes/);
    assert.match(src, /game\.durationMinutes = gameLengthMinutes\(game\.durationMinutes, divisionMinutesById\.get\(game\.divisionId\), tournamentMinutesById\.get\(game\.tournamentId\)\)/);
  });
  test('the window classifier keeps no length of its own', () => {
    assert.doesNotMatch(read('lib/game-live-state.ts'), /=\s*60\b/);
  });
  test('both generators save the length they spaced by', () => {
    assert.match(read('app/[orgSlug]/admin/tournaments/schedule/Generator.tsx'), /games: games\.map\(g => \(\{ \.\.\.g, durationMinutes: gameLength \}\)\)/);
    assert.match(read('app/[orgSlug]/admin/tournaments/schedule/PlayoffWizard.tsx'), /durationMinutes: gameLength,/);
  });
});
