import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  shiftWallClock,
  planBulkReschedule,
  type ReschedulableGame,
} from '../../lib/schedule-shift.ts';

// ── shiftWallClock ───────────────────────────────────────────────────────────

describe('shiftWallClock', () => {
  it('adds minutes within the same day', () => {
    assert.deepEqual(shiftWallClock('2026-07-10', '18:00', 60), { date: '2026-07-10', time: '19:00' });
    assert.deepEqual(shiftWallClock('2026-07-10', '09:15', 30), { date: '2026-07-10', time: '09:45' });
    assert.deepEqual(shiftWallClock('2026-07-10', '13:00', 120), { date: '2026-07-10', time: '15:00' });
  });

  it('rolls the date across midnight', () => {
    assert.deepEqual(shiftWallClock('2026-07-10', '23:30', 120), { date: '2026-07-11', time: '01:30' });
    assert.deepEqual(shiftWallClock('2026-07-10', '23:30', 60), { date: '2026-07-11', time: '00:30' });
  });

  it('rolls across a month boundary', () => {
    assert.deepEqual(shiftWallClock('2026-06-30', '23:30', 60), { date: '2026-07-01', time: '00:30' });
  });

  it('accepts HH:MM:SS and normalizes to HH:MM', () => {
    assert.deepEqual(shiftWallClock('2026-07-10', '18:00:00', 30), { date: '2026-07-10', time: '18:30' });
  });

  it('handles a full-day (+1440) shift as same time next day', () => {
    assert.deepEqual(shiftWallClock('2026-07-10', '10:00', 1440), { date: '2026-07-11', time: '10:00' });
  });

  it('is DST-independent (pure wall-clock): spring-forward morning still +60 on the clock face', () => {
    // 2026 DST spring-forward is 2026-03-08. A 09:00 game +60 reads 10:00 regardless of the
    // absolute-instant gap — the shift operates on the stored wall-clock, not a UTC instant.
    assert.deepEqual(shiftWallClock('2026-03-08', '09:00', 60), { date: '2026-03-08', time: '10:00' });
  });
});

// ── planBulkReschedule ───────────────────────────────────────────────────────

function g(over: Partial<ReschedulableGame> & { id: string }): ReschedulableGame {
  return {
    date: '2026-07-10', time: '10:00', status: 'scheduled',
    isPlayoff: false, bracketCode: null, homePlaceholder: null, awayPlaceholder: null,
    ...over,
  };
}

// A small playoff: two semis feed a final.
function bracketGames(overrides: Record<string, Partial<ReschedulableGame>> = {}): ReschedulableGame[] {
  return [
    g({ id: 'sf1', time: '10:00', isPlayoff: true, bracketCode: 'SF1', homePlaceholder: 'A', awayPlaceholder: 'B', ...overrides.sf1 }),
    g({ id: 'sf2', time: '12:00', isPlayoff: true, bracketCode: 'SF2', homePlaceholder: 'C', awayPlaceholder: 'D', ...overrides.sf2 }),
    g({ id: 'f1', time: '14:00', isPlayoff: true, bracketCode: 'F1', homePlaceholder: 'Winner SF1', awayPlaceholder: 'Winner SF2', ...overrides.f1 }),
  ];
}

describe('planBulkReschedule', () => {
  it('shifts every selected scheduled game and rolls the date', () => {
    const games = [g({ id: 'a', time: '18:00' }), g({ id: 'b', time: '23:30' })];
    const plan = planBulkReschedule(games, { shiftMinutes: 60, shiftIds: ['a', 'b'], cancelIds: [] });
    assert.equal(plan.shifts.length, 2);
    assert.deepEqual(plan.shifts.find(s => s.id === 'a')!.to, { date: '2026-07-10', time: '19:00' });
    assert.deepEqual(plan.shifts.find(s => s.id === 'b')!.to, { date: '2026-07-11', time: '00:30' });
    assert.equal(plan.newViolations.length, 0);
  });

  it('a uniform shift of the whole bracket introduces NO new violations', () => {
    const plan = planBulkReschedule(bracketGames(), { shiftMinutes: 60, shiftIds: ['sf1', 'sf2', 'f1'], cancelIds: [] });
    assert.equal(plan.newViolations.length, 0);
    assert.equal(plan.shifts.length, 3);
  });

  it('BLOCKS shifting a feeder past its dependent (new violation)', () => {
    // Push SF1 to 16:00, after the 14:00 final → the final would precede its feeder.
    const plan = planBulkReschedule(bracketGames(), { shiftMinutes: 360, shiftIds: ['sf1'], cancelIds: [] });
    assert.equal(plan.newViolations.length, 1);
    assert.equal(plan.newViolations[0].game, 'F1');
    assert.equal(plan.newViolations[0].feeder, 'SF1');
  });

  it('does NOT count a pre-existing violation as newly introduced', () => {
    // Final already before SF1 (bad prior scheduling). A small shift of the final keeps it bad
    // but must not be reported as caused by this change.
    const games = bracketGames({ f1: { time: '09:00' } });
    const plan = planBulkReschedule(games, { shiftMinutes: 30, shiftIds: ['f1'], cancelIds: [] });
    // Final at 09:00 precedes BOTH semis → two pre-existing violations…
    assert.equal(plan.preexistingViolations.length, 2);
    // …but this shift introduces none of them.
    assert.equal(plan.newViolations.length, 0);
  });

  it('cancelling a feeder removes it from the timing picture (no ordering violation)', () => {
    const plan = planBulkReschedule(bracketGames(), { shiftMinutes: 0, shiftIds: [], cancelIds: ['sf1'] });
    assert.deepEqual(plan.cancelIds, ['sf1']);
    assert.equal(plan.newViolations.length, 0);
  });

  it('skips already-played games in the selection and reports them', () => {
    const games = [g({ id: 'played', status: 'completed' }), g({ id: 'live', status: 'scheduled', time: '11:00' })];
    const plan = planBulkReschedule(games, { shiftMinutes: 60, shiftIds: ['played', 'live'], cancelIds: [] });
    assert.equal(plan.shifts.length, 1);
    assert.equal(plan.shifts[0].id, 'live');
    assert.deepEqual(plan.skipped, [{ id: 'played', reason: 'not-scheduled' }]);
  });

  it('skips a game with no date/time when shifting', () => {
    const games = [g({ id: 'x', time: null })];
    const plan = planBulkReschedule(games, { shiftMinutes: 60, shiftIds: ['x'], cancelIds: [] });
    assert.equal(plan.shifts.length, 0);
    assert.deepEqual(plan.skipped, [{ id: 'x', reason: 'missing-datetime' }]);
  });

  it('cancel wins when an id is in both shift and cancel sets', () => {
    const games = [g({ id: 'a', time: '10:00' })];
    const plan = planBulkReschedule(games, { shiftMinutes: 60, shiftIds: ['a'], cancelIds: ['a'] });
    assert.equal(plan.shifts.length, 0);
    assert.deepEqual(plan.cancelIds, ['a']);
  });

  it('reports a not-found id as skipped', () => {
    const plan = planBulkReschedule([g({ id: 'a' })], { shiftMinutes: 60, shiftIds: ['ghost'], cancelIds: [] });
    assert.deepEqual(plan.skipped, [{ id: 'ghost', reason: 'not-found' }]);
  });
});
