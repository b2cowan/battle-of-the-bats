import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeSeasonLineupAnalytics,
  type SeasonLineupInput,
  type SeasonPlayer,
} from '../../lib/lineup-season-analytics.ts';

const FIELD = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

function player(id: string, name: string, extra: Partial<SeasonPlayer> = {}): SeasonPlayer {
  return { id, name, isPitcher: false, pitcherCap: null, ...extra };
}
function run(lineups: SeasonLineupInput[], opts: Partial<Parameters<typeof computeSeasonLineupAnalytics>[0]> = {}) {
  return computeSeasonLineupAnalytics({
    lineups, scores: [], players: [], pitcherPosition: 'P', seasonPitcherCap: null, templates: [], fieldPositions: FIELD, ...opts,
  });
}

describe('computeSeasonLineupAnalytics — honesty / empty', () => {
  it('returns all-empty for no lineups', () => {
    const a = run([]);
    assert.equal(a.gamesWithLineup, 0);
    assert.deepEqual(a.fairPlay, []);
    assert.deepEqual(a.reusedLineups, []);
  });

  it('does not count a lineup that places nobody (all cells blank)', () => {
    const a = run([{ eventId: 'e1', lineupMode: 'everyone_bats', inningCount: 3, entries: [{ playerId: 'A', battingOrder: 1, inningPositions: {} }] }]);
    assert.equal(a.gamesWithLineup, 0);
    assert.equal(a.fairPlay.length, 0);
  });
});

describe('fair play + bench balance roll-up', () => {
  const lineups: SeasonLineupInput[] = [
    { eventId: 'e1', lineupMode: 'everyone_bats', inningCount: 2, entries: [
      { playerId: 'A', battingOrder: 1, inningPositions: { '1': 'SS', '2': '2B' } },
      { playerId: 'B', battingOrder: 2, inningPositions: { '1': 'Bench', '2': 'Bench' } },
    ] },
    { eventId: 'e2', lineupMode: 'everyone_bats', inningCount: 2, entries: [
      { playerId: 'A', battingOrder: 1, inningPositions: { '1': 'SS', '2': 'Bench' } },
      { playerId: 'B', battingOrder: 2, inningPositions: { '1': 'CF', '2': 'CF' } },
    ] },
  ];
  const players = [player('A', '#7 Ana'), player('B', '#9 Ben')];

  it('sums field vs bench innings across games', () => {
    const a = run(lineups, { players });
    assert.equal(a.gamesWithLineup, 2);
    const A = a.fairPlay.find(r => r.playerId === 'A')!;
    const B = a.fairPlay.find(r => r.playerId === 'B')!;
    assert.equal(A.fieldInnings, 3); // SS,2B + SS
    assert.equal(A.benchInnings, 1);
    assert.equal(B.fieldInnings, 2); // CF,CF
    assert.equal(B.benchInnings, 2); // Bench,Bench game 1
  });

  it('bench balance sorts most-benched first and counts back-to-back sits', () => {
    const a = run(lineups, { players });
    assert.equal(a.benchBalance[0].playerId, 'B'); // 2 bench innings
    const B = a.benchBalance.find(r => r.playerId === 'B')!;
    assert.equal(B.backToBackGames, 1); // game 1 sat both innings in a row
  });

  it('position variety = distinct field positions (excludes Bench), most versatile first', () => {
    const a = run(lineups, { players });
    const A = a.positionVariety.find(r => r.playerId === 'A')!;
    assert.deepEqual(A.positions, ['2B', 'SS']);
    assert.equal(A.count, 2);
    const B = a.positionVariety.find(r => r.playerId === 'B')!;
    assert.deepEqual(B.positions, ['CF']);
  });
});

describe('arm-care / pitching load', () => {
  it('sums innings pitched and flags games over the per-game cap', () => {
    const lineups: SeasonLineupInput[] = [
      { eventId: 'e1', lineupMode: 'everyone_bats', inningCount: 3, entries: [
        { playerId: 'P1', battingOrder: 1, inningPositions: { '1': 'P', '2': 'P', '3': 'P' } }, // 3 IP, cap 2 → over
      ] },
      { eventId: 'e2', lineupMode: 'everyone_bats', inningCount: 3, entries: [
        { playerId: 'P1', battingOrder: 1, inningPositions: { '1': 'P', '2': 'SS', '3': 'SS' } }, // 1 IP → ok
      ] },
    ];
    const players = [player('P1', 'Pat', { isPitcher: true, pitcherCap: 2 })];
    const a = run(lineups, { players });
    const P = a.armCare.find(r => r.playerId === 'P1')!;
    assert.equal(P.inningsPitched, 4);
    assert.equal(P.gamesPitched, 2);
    assert.equal(P.perGameCap, 2);
    assert.equal(P.overCapGames, 1);
  });

  it('excludes a flagged pitcher who appeared but never actually pitched (no zero-inning filler)', () => {
    const lineups: SeasonLineupInput[] = [
      { eventId: 'e1', lineupMode: 'everyone_bats', inningCount: 2, entries: [
        { playerId: 'P1', battingOrder: 1, inningPositions: { '1': 'Bench', '2': 'Bench' } }, // flagged pitcher, only benched
        { playerId: 'A', battingOrder: 2, inningPositions: { '1': 'SS', '2': 'SS' } },
      ] },
    ];
    const players = [player('P1', 'Pat', { isPitcher: true, pitcherCap: 2 }), player('A', 'Ana')];
    const a = run(lineups, { players });
    assert.equal(a.armCare.find(r => r.playerId === 'P1'), undefined);
    assert.equal(a.armCare.length, 0);
  });

  it('falls back to the season pitcher cap when the player has none', () => {
    const lineups: SeasonLineupInput[] = [
      { eventId: 'e1', lineupMode: 'everyone_bats', inningCount: 2, entries: [
        { playerId: 'P1', battingOrder: 1, inningPositions: { '1': 'P', '2': 'P' } }, // 2 IP, season cap 1 → over
      ] },
    ];
    const players = [player('P1', 'Pat', { isPitcher: true, pitcherCap: null })];
    const a = run(lineups, { players, seasonPitcherCap: 1 });
    assert.equal(a.armCare[0].overCapGames, 1);
    assert.equal(a.armCare[0].perGameCap, 1);
  });
});

describe('records by reused lineup', () => {
  const order = (ids: string[]): SeasonLineupInput['entries'] =>
    ids.map((id, i) => ({ playerId: id, battingOrder: i + 1, inningPositions: { '1': 'SS' } }));

  it('groups identical batting orders run >=2 times and records only scored games', () => {
    const lineups: SeasonLineupInput[] = [
      { eventId: 'e1', lineupMode: 'everyone_bats', inningCount: 1, entries: order(['A', 'B', 'C']) },
      { eventId: 'e2', lineupMode: 'everyone_bats', inningCount: 1, entries: order(['A', 'B', 'C']) },
      { eventId: 'e3', lineupMode: 'everyone_bats', inningCount: 1, entries: order(['A', 'B', 'C']) }, // no score
      { eventId: 'e4', lineupMode: 'everyone_bats', inningCount: 1, entries: order(['C', 'B', 'A']) }, // different order, single use
    ];
    const scores = [
      { eventId: 'e1', teamScore: 5, opponentScore: 3 }, // win
      { eventId: 'e2', teamScore: 2, opponentScore: 4 }, // loss
      { eventId: 'e3', teamScore: null, opponentScore: null }, // not scored
    ];
    const players = [player('A', '#1 Amy'), player('B', '#2 Bo'), player('C', '#3 Cy')];
    const a = run(lineups, { players, scores, templates: [{ name: 'Gold order', battingOrderPlayerIds: ['A', 'B', 'C'] }] });

    assert.equal(a.reusedLineups.length, 1); // only A|B|C is reused (3 games); C|B|A used once
    const r = a.reusedLineups[0];
    assert.equal(r.label, 'Gold order'); // matched a template name
    assert.equal(r.games, 3);
    assert.equal(r.scoredGames, 2); // e3 has no score
    assert.equal(r.wins, 1);
    assert.equal(r.losses, 1);
    assert.equal(r.ties, 0);
  });

  it('falls back to a name-based label when no template matches', () => {
    const lineups: SeasonLineupInput[] = [
      { eventId: 'e1', lineupMode: 'everyone_bats', inningCount: 1, entries: order(['A', 'B', 'C']) },
      { eventId: 'e2', lineupMode: 'everyone_bats', inningCount: 1, entries: order(['A', 'B', 'C']) },
    ];
    const players = [player('A', '#1 Amy'), player('B', '#2 Bo'), player('C', '#3 Cy')];
    const a = run(lineups, { players });
    assert.equal(a.reusedLineups[0].label, 'Amy, Bo, Cy'); // strips jersey #, first three
  });
});
