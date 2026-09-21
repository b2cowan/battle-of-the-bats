import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeLineup, deriveLineupBadge, canMarkLineupReady, inningsNeedingDecision, BENCH_POSITION } from '../../lib/lineup-analysis.ts';

describe('lineup readiness analysis', () => {
  const positions = ['P', 'C'];

  it('keeps an untouched grid quiet while retaining the factual coverage data', () => {
    const analysis = analyzeLineup([
      { playerId: 'A', inningPositions: {} },
      { playerId: 'B', inningPositions: {} },
    ], 1, positions);

    assert.equal(analysis.readiness, 'not_started');
    assert.equal(analysis.hasAssignments, false);
    assert.deepEqual(analysis.missingFieldPositions, [{ inning: 1, positions: ['P', 'C'] }]);
    assert.deepEqual(analysis.unfilledFieldPositions, [{ inning: 1, positions: ['P', 'C'] }]);
  });

  it('reports the open roles as a coverage fact without inferring a cause', () => {
    const analysis = analyzeLineup([
      { playerId: 'A', inningPositions: { '1': 'P' } },
      { playerId: 'B', inningPositions: { '1': BENCH_POSITION } },
      { playerId: 'C', inningPositions: {} },
    ], 1, positions);

    assert.equal(analysis.readiness, 'draft');
    assert.deepEqual(analysis.missingFieldPositions, [{ inning: 1, positions: ['C'] }]);
    assert.equal(analysis.inningFill[0].unassigned, 1);
  });

  it('calls a duplicate singular role Needs review and identifies the exact role', () => {
    const analysis = analyzeLineup([
      { playerId: 'A', inningPositions: { '1': 'P' } },
      { playerId: 'B', inningPositions: { '1': 'P' } },
    ], 1, positions);

    assert.equal(analysis.readiness, 'needs_review');
    assert.deepEqual(analysis.conflicts, [{ inning: 1, position: 'P', count: 2 }]);
  });

  it('is ready only when each player has a decision and all required roles are covered', () => {
    const analysis = analyzeLineup([
      { playerId: 'A', inningPositions: { '1': 'P', '2': BENCH_POSITION } },
      { playerId: 'B', inningPositions: { '1': 'C', '2': 'P' } },
      { playerId: 'C', inningPositions: { '1': BENCH_POSITION, '2': 'C' } },
    ], 2, positions);

    assert.equal(analysis.readiness, 'ready');
    assert.deepEqual(analysis.missingFieldPositions, []);
  });
});

describe('deriveLineupBadge (Phase 2, D1 — the persisted Draft/Ready handoff)', () => {
  const positions = ['P', 'C'];

  it('is not_started with no assignments, regardless of persisted status', () => {
    const analysis = analyzeLineup([{ playerId: 'A', inningPositions: {} }], 1, positions);
    assert.equal(deriveLineupBadge(analysis, 'draft'), 'not_started');
    assert.equal(deriveLineupBadge(analysis, 'ready'), 'not_started');
  });

  it('coverage-complete but not yet marked ready reads as draft, not ready', () => {
    const analysis = analyzeLineup([
      { playerId: 'A', inningPositions: { '1': 'P' } },
      { playerId: 'B', inningPositions: { '1': 'C' } },
    ], 1, positions);
    assert.equal(analysis.readiness, 'ready'); // coverage-complete (eligibility signal)
    assert.equal(deriveLineupBadge(analysis, 'draft'), 'draft'); // not yet marked ready
  });

  it('reads ready only once persisted status says so', () => {
    const analysis = analyzeLineup([
      { playerId: 'A', inningPositions: { '1': 'P' } },
      { playerId: 'B', inningPositions: { '1': 'C' } },
    ], 1, positions);
    assert.equal(deriveLineupBadge(analysis, 'ready'), 'ready');
  });

  it('a proven conflict always reads needs_review, even over a persisted ready status', () => {
    const analysis = analyzeLineup([
      { playerId: 'A', inningPositions: { '1': 'P' } },
      { playerId: 'B', inningPositions: { '1': 'P' } },
    ], 1, positions);
    // A stale 'ready' from before the conflicting edit must never outrank a proven clash — this is
    // the case the server-side re-check (the PATCH mark-ready route) and this derivation both guard.
    assert.equal(deriveLineupBadge(analysis, 'ready'), 'needs_review');
    assert.equal(deriveLineupBadge(analysis, 'draft'), 'needs_review');
  });
});

describe('canMarkLineupReady (D11 — the gate is wrongness, never emptiness)', () => {
  const positions = ['P', 'C', '1B'];

  it('an empty grid has nothing to mark', () => {
    const analysis = analyzeLineup([{ playerId: 'A', inningPositions: {} }], 3, positions);
    assert.equal(canMarkLineupReady(analysis), false);
  });

  it('a proven clash blocks', () => {
    const analysis = analyzeLineup([
      { playerId: 'A', inningPositions: { '1': 'P' } },
      { playerId: 'B', inningPositions: { '1': 'P' } },
    ], 1, positions);
    assert.equal(canMarkLineupReady(analysis), false);
  });

  it('open roles, undecided players and untouched innings never block — the coach fills them at the field', () => {
    // Innings 1–2 done, 3 pencilled (one player), 4 untouched: the owner's own lineup shape.
    const analysis = analyzeLineup([
      { playerId: 'A', inningPositions: { '1': 'P', '2': 'C', '3': 'P' } },
      { playerId: 'B', inningPositions: { '1': 'C', '2': 'P' } },
      { playerId: 'C', inningPositions: { '1': '1B', '2': '1B' } },
    ], 4, positions);
    assert.equal(analysis.readiness, 'draft'); // still incomplete as a coverage fact …
    assert.equal(canMarkLineupReady(analysis), true); // … and still the coach's to mark
  });

  it('a covered lineup can be marked, as before', () => {
    const analysis = analyzeLineup([
      { playerId: 'A', inningPositions: { '1': 'P' } },
      { playerId: 'B', inningPositions: { '1': 'C' } },
      { playerId: 'C', inningPositions: { '1': '1B' } },
    ], 1, positions);
    assert.equal(canMarkLineupReady(analysis), true);
  });
});

describe('inningsNeedingDecision (D11 — the count Ready carries with it)', () => {
  const positions = ['P', 'C'];

  it('counts a started inning with an open role, one with an undecided player, and the untouched innings — each once', () => {
    const analysis = analyzeLineup([
      { playerId: 'A', inningPositions: { '1': 'P', '2': 'P', '3': 'P' } },
      { playerId: 'B', inningPositions: { '1': 'C', '2': BENCH_POSITION } },   // inning 2: C open, 3: undecided
    ], 5, positions);
    // 1 whole · 2 open role · 3 undecided (B blank) + C open · 4–5 untouched
    assert.deepEqual(inningsNeedingDecision(analysis), [2, 3, 4, 5]);
  });

  it('a clash inning counts even when every player is decided and every role held', () => {
    const analysis = analyzeLineup([
      { playerId: 'A', inningPositions: { '1': 'P', '2': 'P' } },
      { playerId: 'B', inningPositions: { '1': 'P', '2': 'C' } },
      { playerId: 'C', inningPositions: { '1': 'C', '2': BENCH_POSITION } },
    ], 2, positions);
    assert.deepEqual(inningsNeedingDecision(analysis), [1]);
  });

  it('is empty for a fully decided lineup', () => {
    const analysis = analyzeLineup([
      { playerId: 'A', inningPositions: { '1': 'P', '2': BENCH_POSITION } },
      { playerId: 'B', inningPositions: { '1': 'C', '2': 'P' } },
      { playerId: 'C', inningPositions: { '1': BENCH_POSITION, '2': 'C' } },
    ], 2, positions);
    assert.deepEqual(inningsNeedingDecision(analysis), []);
  });
});
