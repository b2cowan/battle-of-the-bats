/**
 * "The numbers vs them" (Scouting Book P2, plan §4.6) — the honesty rule as tests.
 * Every line is provable from the meetings/lineups given, and every line is ABSENT below
 * its confidence floor (≥3 counted meetings; ≥2 saved lineups for the lineup joins) —
 * boundary cases are exercised on both sides.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeOpponentInsights, type InsightLineupEntry } from '../../lib/coach-opponent-insights.ts';
import type { OpponentMeeting } from '../../lib/coach-opponents.ts';

let seq = 0;
function meeting(over: Partial<OpponentMeeting>): OpponentMeeting {
  seq += 1;
  return {
    eventId: over.eventId ?? `m${seq}`,
    name: 'League Game',
    eventType: 'league_game',
    startsAt: '2026-06-01T22:00:00Z',
    programYearId: 'py-2026',
    homeAway: 'home',
    teamScore: 5,
    opponentScore: 3,
    result: 'win',
    counted: true,
    ...over,
  };
}

const DIAMOND = {
  activeYearId: 'py-2026',
  unitPlural: 'Runs',
  pitcherPosition: 'P',
  pitcherPositionLabel: 'pitcher',
  fieldPositions: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'],
  lineups: {} as Record<string, InsightLineupEntry[]>,
  playerNames: {} as Record<string, string>,
};

function ids(lines: { id: string }[]): string[] {
  return lines.map(l => l.id);
}

describe('computeOpponentInsights — record-derived lines', () => {
  it('two meetings is below the floor: NOTHING renders', () => {
    const lines = computeOpponentInsights({
      ...DIAMOND,
      meetings: [meeting({ homeAway: 'home' }), meeting({ homeAway: 'away', result: 'loss', teamScore: 2, opponentScore: 4 })],
    });
    assert.deepEqual(lines, []);
  });

  it('three meetings clears the floor; each line carries its provenance', () => {
    const lines = computeOpponentInsights({
      ...DIAMOND,
      meetings: [
        meeting({ homeAway: 'home', teamScore: 6, opponentScore: 1 }),
        meeting({ homeAway: 'home', teamScore: 4, opponentScore: 3 }),
        meeting({ homeAway: 'away', result: 'loss', teamScore: 2, opponentScore: 4 }),
      ],
    });
    const homeAway = lines.find(l => l.id === 'home_away');
    assert.equal(homeAway?.text, '2–0 at home · 0–1 away');
    assert.equal(homeAway?.fromGames, 3);
    const averages = lines.find(l => l.id === 'averages');
    assert.equal(averages?.text, 'Averages 4.0 runs for, 2.7 against');
    assert.ok(!ids(lines).includes('closeness')); // the 6–1 blowout kills the closeness flag
    const extremes = lines.find(l => l.id === 'extremes');
    assert.equal(extremes?.text, 'Biggest win 6–1 · worst loss 2–4');
  });

  it('the closeness flag when every meeting is within 2', () => {
    const lines = computeOpponentInsights({
      ...DIAMOND,
      meetings: [
        meeting({ teamScore: 5, opponentScore: 3 }),
        meeting({ teamScore: 4, opponentScore: 2 }),
        meeting({ result: 'loss', teamScore: 2, opponentScore: 4 }),
      ],
    });
    assert.equal(lines.find(l => l.id === 'closeness')?.text, 'All 3 meetings decided by 2 runs or fewer');
  });

  it('scrimmages and undecided games never feed a number', () => {
    const lines = computeOpponentInsights({
      ...DIAMOND,
      meetings: [
        meeting({}), meeting({}),
        meeting({ eventType: 'scrimmage', counted: false, teamScore: 0, opponentScore: 9 }),
        meeting({ result: null, teamScore: null, opponentScore: null, counted: false }),
      ],
    });
    assert.deepEqual(lines, []); // only 2 COUNTED meetings — below the floor
  });

  it('the home/away split needs both sides to exist', () => {
    const lines = computeOpponentInsights({
      ...DIAMOND,
      meetings: [meeting({}), meeting({}), meeting({})], // all home
    });
    assert.ok(!ids(lines).includes('home_away'));
  });

  it('this-season vs all-time appears only when there IS history beyond this season', () => {
    const withHistory = computeOpponentInsights({
      ...DIAMOND,
      meetings: [
        meeting({ programYearId: 'py-2026' }),
        meeting({ programYearId: 'py-2025', result: 'loss', teamScore: 1, opponentScore: 3 }),
        meeting({ programYearId: 'py-2025' }),
      ],
    });
    assert.equal(withHistory.find(l => l.id === 'season_split')?.text, '1–0 this season · 2–1 all-time');

    const allThisSeason = computeOpponentInsights({
      ...DIAMOND,
      meetings: [meeting({}), meeting({}), meeting({})],
    });
    assert.ok(!ids(allThisSeason).includes('season_split'));
  });

  it('a 3-run margin kills the closeness flag', () => {
    const lines = computeOpponentInsights({
      ...DIAMOND,
      meetings: [
        meeting({ teamScore: 5, opponentScore: 2 }), // margin 3
        meeting({ teamScore: 4, opponentScore: 3 }),
        meeting({ result: 'loss', teamScore: 2, opponentScore: 4 }),
      ],
    });
    assert.ok(!ids(lines).includes('closeness'));
  });
});

describe('computeOpponentInsights — "what worked" (lineup joins)', () => {
  const P = (playerId: string, pos: string): InsightLineupEntry =>
    ({ playerId, starter: true, inningPositions: { '1': pos, '2': pos } });

  const threeMeetings = [
    meeting({ eventId: 'w1' }),
    meeting({ eventId: 'w2', teamScore: 6, opponentScore: 1 }),
    meeting({ eventId: 'l1', result: 'loss', teamScore: 2, opponentScore: 4 }),
  ];

  it('one saved lineup is below the lineup floor: no lineup lines', () => {
    const lines = computeOpponentInsights({
      ...DIAMOND,
      meetings: threeMeetings,
      lineups: { w1: [P('sam', 'P')] },
      playerNames: { sam: 'Sam Rivera' },
    });
    assert.ok(!ids(lines).includes('pitcher_pattern'));
    assert.ok(!ids(lines).includes('fielded_every_win'));
  });

  it('the pitcher pattern: started every win at P, never a loss', () => {
    const lines = computeOpponentInsights({
      ...DIAMOND,
      meetings: threeMeetings,
      lineups: {
        w1: [P('sam', 'P'), P('alex', 'C')],
        w2: [P('sam', 'P'), P('alex', '1B')],
        l1: [P('alex', 'P'), P('sam', 'RF')],
      },
      playerNames: { sam: 'Sam Rivera', alex: 'Alex Chen' },
    });
    const pitcher = lines.find(l => l.id === 'pitcher_pattern');
    assert.equal(pitcher?.text, 'In both wins, Sam Rivera started at pitcher; in the loss they didn’t');
    assert.equal(pitcher?.fromGames, 3);
    const fielded = lines.find(l => l.id === 'fielded_every_win');
    assert.equal(fielded?.text, '2 players saw the field in every win');
    assert.equal(fielded?.fromGames, 2);
  });

  it('no pitcher line when the same player pitched wins AND the loss (no contrast)', () => {
    const lines = computeOpponentInsights({
      ...DIAMOND,
      meetings: threeMeetings,
      lineups: { w1: [P('sam', 'P')], w2: [P('sam', 'P')], l1: [P('sam', 'P')] },
      playerNames: { sam: 'Sam Rivera' },
    });
    assert.ok(!ids(lines).includes('pitcher_pattern'));
  });

  it('sports without a pitcher position never get the pitcher line', () => {
    const lines = computeOpponentInsights({
      ...DIAMOND,
      pitcherPosition: null,
      pitcherPositionLabel: null,
      meetings: threeMeetings,
      lineups: { w1: [P('sam', 'P')], w2: [P('sam', 'P')], l1: [P('alex', 'P')] },
      playerNames: { sam: 'Sam Rivera', alex: 'Alex Chen' },
    });
    assert.ok(!ids(lines).includes('pitcher_pattern'));
  });

  it('bench-only players do not count as seeing the field', () => {
    const bench: InsightLineupEntry = { playerId: 'benchkid', starter: false, inningPositions: { '1': 'Bench' } };
    const lines = computeOpponentInsights({
      ...DIAMOND,
      meetings: [meeting({ eventId: 'w1' }), meeting({ eventId: 'w2' }), threeMeetings[2]],
      lineups: { w1: [P('sam', 'P'), bench], w2: [P('sam', 'C'), bench] },
      playerNames: { sam: 'Sam Rivera' },
    });
    assert.equal(lines.find(l => l.id === 'fielded_every_win')?.text, '1 player saw the field in every win');
  });
});
