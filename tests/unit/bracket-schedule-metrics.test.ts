import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBracketScheduleMetrics, type BracketGameInput } from '../../lib/bracket-schedule-metrics.ts';

const D = '2026-07-01';
const g = (code: string, home: string, away: string, time: string | null, pool?: string): BracketGameInput =>
  ({ code, home, away, date: time ? D : null, time, pool: pool ?? null });

describe('buildBracketScheduleMetrics — single elim, well spread', () => {
  const games = [
    g('SF1', '1st Seed', '4th Seed', '09:00'),
    g('SF2', '2nd Seed', '3rd Seed', '09:00'),
    g('FIN', 'Winner SF1', 'Winner SF2', '12:00'),
  ];
  const m = buildBracketScheduleMetrics(games, { gameDurationMinutes: 90, minRestMinutes: 60 });

  it('finds the two winner edges', () => assert.equal(m.edgeCount, 2));
  it('tightest turnaround = 90 min (10:30 end → 12:00 start)', () => assert.equal(m.tightestTurnaroundMinutes, 90));
  it('no violations', () => { assert.equal(m.infeasibleCount, 0); assert.equal(m.tooTightCount, 0); });
  it('longest run = 2 games (SF → FIN)', () => assert.equal(m.longestPathGames, 2));
  it('worst-case games/day = 2', () => assert.equal(m.worstCaseGamesPerDay, 2));
  it('healthy', () => assert.equal(m.healthTone, 'good'));
});

describe('buildBracketScheduleMetrics — overlapping dependent game is infeasible', () => {
  const games = [
    g('SF1', '1st Seed', '4th Seed', '09:00'),
    g('SF2', '2nd Seed', '3rd Seed', '09:00'),
    g('FIN', 'Winner SF1', 'Winner SF2', '09:00'), // same time as its feeders
  ];
  const m = buildBracketScheduleMetrics(games, { gameDurationMinutes: 90, minRestMinutes: 60 });

  it('turnaround is negative', () => assert.equal(m.tightestTurnaroundMinutes, -90));
  it('counts 2 infeasible edges', () => assert.equal(m.infeasibleCount, 2));
  it('infeasible edges are also too-tight', () => assert.equal(m.tooTightCount, 2));
  it('raises an error issue', () => assert.ok(m.issues.some(i => i.code === 'bracket_infeasible' && i.severity === 'error')));
  it('health is danger', () => assert.equal(m.healthTone, 'danger'));
});

describe('buildBracketScheduleMetrics — split-pool codes are scoped by pool', () => {
  const games = [
    g('SF1', '1st Pool A', '4th Pool A', '09:00', 'Pool A'),
    g('SF2', '2nd Pool A', '3rd Pool A', '09:00', 'Pool A'),
    g('FIN', 'Winner SF1', 'Winner SF2', '12:00', 'Pool A'),
    g('SF1', '1st Pool B', '4th Pool B', '09:00', 'Pool B'),
    g('SF2', '2nd Pool B', '3rd Pool B', '09:00', 'Pool B'),
    g('FIN', 'Winner SF1', 'Winner SF2', '12:00', 'Pool B'),
  ];
  const m = buildBracketScheduleMetrics(games, { gameDurationMinutes: 90, minRestMinutes: 60 });

  it('edges resolve WITHIN each pool only (4 total, not 8)', () => assert.equal(m.edgeCount, 4));
  it('longest run stays 2 (paths do not cross pools)', () => assert.equal(m.longestPathGames, 2));
  it('no phantom violations from cross-pool merge', () => assert.equal(m.infeasibleCount, 0));
});

describe('buildBracketScheduleMetrics — double elim longest run is the losers grind', () => {
  const games = [
    g('WB1-1', '1st Seed', '4th Seed', null),
    g('WB1-2', '2nd Seed', '3rd Seed', null),
    g('WB2-1', 'Winner WB1-1', 'Winner WB1-2', null),
    g('LB1-1', 'Loser WB1-1', 'Loser WB1-2', null),
    g('LB2-1', 'Winner LB1-1', 'Loser WB2-1', null),
    g('GF', 'Winner WB2-1', 'Winner LB2-1', null),
    g('GF2', 'Winner GF', 'Loser GF', null),
  ];
  const m = buildBracketScheduleMetrics(games, { gameDurationMinutes: 90 });

  // WB1-1 → LB1-1 → LB2-1 → GF → GF2 = 5 games (a team that loses round 1 and runs the table)
  it('longest run = 5 games', () => assert.equal(m.longestPathGames, 5));
  it('structural metrics compute with no times set', () => {
    assert.equal(m.scheduledGames, 0);
    assert.equal(m.tightestTurnaroundMinutes, null);
    assert.equal(m.worstCaseGamesPerDay, 0);
    assert.equal(m.longestPathDays, null);
  });
});
