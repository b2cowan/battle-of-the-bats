import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOURNAMENT_FORMAT_OPTIONS,
  TOURNAMENT_FORMAT_VALUES,
  getTournamentFormat,
  hasPlayoffs,
  hasRoundRobin,
  isReadyToFinalize,
  tournamentFormatLabel,
} from '../../lib/tournament-phase.ts';

/**
 * The three tournament styles and the two questions every surface asks of them
 * (Exhibition added 2026-09-13, owner ruling).
 *
 *   round_robin_playoffs — has a round robin, ends in a bracket
 *   playoff_only         — no round robin, ends in a bracket
 *   exhibition           — has a round robin, no bracket
 *
 * Plus the one piece of dashboard logic that used to encode "ends in a bracket" as a hard-coded
 * requirement: "Ready to finalize". The guard that keeps a round robin from tripping it before
 * its bracket is built must survive for the two bracket formats and be absent for Exhibition.
 */

const of = (format: string | null | undefined) => ({ settings: { format } });

describe('the three styles answer the two questions', () => {
  test('round robin + playoffs: both', () => {
    assert.equal(hasRoundRobin(of('round_robin_playoffs')), true);
    assert.equal(hasPlayoffs(of('round_robin_playoffs')), true);
  });
  test('bracket only: no round robin', () => {
    assert.equal(hasRoundRobin(of('playoff_only')), false);
    assert.equal(hasPlayoffs(of('playoff_only')), true);
  });
  test('exhibition: no playoffs', () => {
    assert.equal(hasRoundRobin(of('exhibition')), true);
    assert.equal(hasPlayoffs(of('exhibition')), false);
  });
  test('absent, null and unknown values read as the default — never as an else-branch', () => {
    for (const raw of [undefined, null, '', 'jamboree', 'EXHIBITION']) {
      assert.equal(getTournamentFormat(of(raw)), 'round_robin_playoffs', `value ${JSON.stringify(raw)}`);
    }
    assert.equal(getTournamentFormat(undefined), 'round_robin_playoffs');
    assert.equal(getTournamentFormat({ settings: null }), 'round_robin_playoffs');
  });
});

describe('the picker list is the allow-list is the label table', () => {
  test('the three values are exactly these, in this order — pinned to ground truth, not to each other', () => {
    // Comparing TOURNAMENT_FORMAT_VALUES against a fresh TOURNAMENT_FORMAT_OPTIONS.map(...) would
    // pass by construction (TOURNAMENT_FORMAT_VALUES IS that same .map() call, evaluated once at
    // import) and catch nothing if a value were ever dropped, renamed or reordered on BOTH sides
    // at once. Pin to a literal so a real regression — not just disagreement between two mirrors
    // of the same array — is what makes this fail.
    assert.deepEqual([...TOURNAMENT_FORMAT_VALUES], ['round_robin_playoffs', 'playoff_only', 'exhibition']);
    assert.deepEqual(TOURNAMENT_FORMAT_OPTIONS.map(o => o.value), ['round_robin_playoffs', 'playoff_only', 'exhibition']);
  });
  test('every option has a title and a sentence, and the label table agrees with it', () => {
    for (const o of TOURNAMENT_FORMAT_OPTIONS) {
      assert.ok(o.title.length > 0 && o.desc.length > 0, o.value);
      assert.equal(tournamentFormatLabel(o.value), o.title);
    }
  });
  test('the third style is named Exhibition, once, and that is the whole word (one spelling rule)', () => {
    const titles = TOURNAMENT_FORMAT_OPTIONS.map(o => o.title);
    assert.deepEqual(titles, ['Round robin + playoffs', 'Bracket only', 'Exhibition']);
  });
});

describe('ready to finalize', () => {
  const base = { isActive: true, totalGames: 4, resolvedGames: 4, playoffGamesTotal: 0 };

  test('a round robin whose bracket is not built yet is NOT ready — the original guard survives', () => {
    assert.equal(isReadyToFinalize({ ...base, hasPlayoffs: true }), false);
  });
  test('a bracket format is ready once every game, including a playoff game, is resolved', () => {
    assert.equal(isReadyToFinalize({ ...base, playoffGamesTotal: 3, totalGames: 7, resolvedGames: 7, hasPlayoffs: true }), true);
    assert.equal(isReadyToFinalize({ ...base, playoffGamesTotal: 3, totalGames: 7, resolvedGames: 6, hasPlayoffs: true }), false);
  });
  test('an exhibition is ready the moment its last game is resolved — no bracket to wait for', () => {
    assert.equal(isReadyToFinalize({ ...base, hasPlayoffs: false }), true);
    assert.equal(isReadyToFinalize({ ...base, resolvedGames: 3, hasPlayoffs: false }), false);
  });
  test('never ready with no games, and never when the tournament is not active', () => {
    assert.equal(isReadyToFinalize({ ...base, totalGames: 0, resolvedGames: 0, hasPlayoffs: false }), false);
    assert.equal(isReadyToFinalize({ ...base, isActive: false, hasPlayoffs: false }), false);
  });
});
