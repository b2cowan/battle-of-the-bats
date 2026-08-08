import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkVenueConflict,
  buildConflictMap,
  resolveGameTiming,
  timeToMinutes,
  minutesToTime,
  type ConflictGame,
} from '../../lib/schedule-conflict.ts';
import type { Division, Tournament } from '../../lib/types.ts';

/**
 * Regression cover for the defect this suite was created for: the save-time blocker and the
 * schedule-health panel used to disagree about typed field names. Health counted those clashes;
 * the editor saved them in silence and showed no badge.
 */

const DIV: Division = { id: 'd1', tournamentId: 't1', name: 'U11', minAge: null, maxAge: null } as unknown as Division;
const DIV2: Division = { id: 'd2', tournamentId: 't1', name: 'U13', minAge: null, maxAge: null } as unknown as Division;
const DIVISIONS = [DIV, DIV2];

// 60-minute games, 15-minute buffer, so slot arithmetic in these tests is easy to read.
const TOURNAMENT = { id: 't1', settings: { game_duration_minutes: 60, buffer_minutes: 15 } } as unknown as Tournament;

function game(over: Partial<ConflictGame> & { id: string }): ConflictGame {
  return { gameDate: '2026-08-08', status: 'scheduled', divisionId: 'd1', ...over };
}

function check(proposed: ConflictGame, all: ConflictGame[]) {
  return checkVenueConflict({ proposedGame: proposed, allGames: all, divisions: DIVISIONS, tournament: TOURNAMENT });
}

describe('schedule-conflict — typed field names are checked (the bug this fixes)', () => {
  it('flags two games at the same time on the same typed field name', () => {
    const existing = game({ id: 'a', startTime: '10:00', location: 'Diamond 1', divisionId: 'd2' });
    const proposed = game({ id: 'b', startTime: '10:30', location: 'Diamond 1' });
    const result = check(proposed, [existing]);
    assert.ok(result, 'a typed-field double-booking must be detected');
    assert.equal(result.kind, 'overlap');
    assert.equal(result.conflictingGame.id, 'a');
    assert.equal(result.matchedOn, 'text');
    assert.equal(result.conflictingDivisionName, 'U13');
  });

  it('matches typed names case- and whitespace-insensitively', () => {
    const existing = game({ id: 'a', startTime: '10:00', location: '  DIAMOND   1 ' });
    const proposed = game({ id: 'b', startTime: '10:30', location: 'diamond 1' });
    assert.ok(check(proposed, [existing]));
  });

  it('does not flag different typed field names', () => {
    const existing = game({ id: 'a', startTime: '10:00', location: 'Diamond 1' });
    const proposed = game({ id: 'b', startTime: '10:30', location: 'Diamond 2' });
    assert.equal(check(proposed, [existing]), null);
  });

  it('does not flag the same typed field name on a different day', () => {
    const existing = game({ id: 'a', startTime: '10:00', location: 'Diamond 1', gameDate: '2026-08-09' });
    const proposed = game({ id: 'b', startTime: '10:30', location: 'Diamond 1' });
    assert.equal(check(proposed, [existing]), null);
  });

  it('reports a buffer warning, not an overlap, when a typed-field game starts too soon after', () => {
    const existing = game({ id: 'a', startTime: '10:00', location: 'Diamond 1' });
    const proposed = game({ id: 'b', startTime: '11:05', location: 'Diamond 1' });
    const result = check(proposed, [existing]);
    assert.ok(result);
    assert.equal(result.kind, 'buffer');
  });

  it('leaves a clean gap alone', () => {
    const existing = game({ id: 'a', startTime: '10:00', location: 'Diamond 1' });
    const proposed = game({ id: 'b', startTime: '11:15', location: 'Diamond 1' });
    assert.equal(check(proposed, [existing]), null);
  });
});

describe('schedule-conflict — placeholder text is not a field (owner ruling R2)', () => {
  it('never clashes two TBD games', () => {
    const existing = game({ id: 'a', startTime: '10:00', location: 'TBD' });
    const proposed = game({ id: 'b', startTime: '10:00', location: 'TBD' });
    assert.equal(check(proposed, [existing]), null);
  });

  it('treats TBA the same way', () => {
    const existing = game({ id: 'a', startTime: '10:00', location: 'TBA' });
    const proposed = game({ id: 'b', startTime: '10:00', location: 'tba' });
    assert.equal(check(proposed, [existing]), null);
  });
});

describe('schedule-conflict — mixed granularity (the blind spot)', () => {
  it('flags a surface-pinned game against a venue-only game at that venue', () => {
    const existing = game({ id: 'a', startTime: '10:00', venueId: 'v1' });
    const proposed = game({ id: 'b', startTime: '10:30', venueId: 'v1', venueFacilityId: 'f1' });
    const result = check(proposed, [existing]);
    assert.ok(result, 'a facility game and a venue-only game at that venue must compare');
    assert.equal(result.kind, 'overlap');
  });

  it('flags it in the other direction too', () => {
    const existing = game({ id: 'a', startTime: '10:00', venueId: 'v1', venueFacilityId: 'f1' });
    const proposed = game({ id: 'b', startTime: '10:30', venueId: 'v1' });
    assert.ok(check(proposed, [existing]));
  });

  it('still does not flag two different surfaces in the same park', () => {
    const existing = game({ id: 'a', startTime: '10:00', venueId: 'v1', venueFacilityId: 'f1' });
    const proposed = game({ id: 'b', startTime: '10:30', venueId: 'v1', venueFacilityId: 'f2' });
    assert.equal(check(proposed, [existing]), null);
  });

  it('does not flag a venue-only game at a different venue', () => {
    const existing = game({ id: 'a', startTime: '10:00', venueId: 'v2' });
    const proposed = game({ id: 'b', startTime: '10:30', venueId: 'v1', venueFacilityId: 'f1' });
    assert.equal(check(proposed, [existing]), null);
  });
});

describe('schedule-conflict — typed text never matches a picked field', () => {
  it('does not clash a typed name against a facility record, even a plausible one', () => {
    // Deciding that "Diamond 1" names facility f1 is Phase 3's reviewed job, not a silent guess.
    const existing = game({ id: 'a', startTime: '10:00', venueId: 'v1', venueFacilityId: 'f1' });
    const proposed = game({ id: 'b', startTime: '10:00', location: 'Diamond 1' });
    assert.equal(check(proposed, [existing]), null);
  });
});

describe('schedule-conflict — unchanged guarantees', () => {
  it('ignores cancelled games', () => {
    const existing = game({ id: 'a', startTime: '10:00', location: 'Diamond 1', status: 'cancelled' });
    const proposed = game({ id: 'b', startTime: '10:00', location: 'Diamond 1' });
    assert.equal(check(proposed, [existing]), null);
  });

  it('never conflicts a game with itself', () => {
    const existing = game({ id: 'a', startTime: '10:00', location: 'Diamond 1' });
    assert.equal(check(existing, [existing]), null);
  });

  it('returns null when the proposed game has nowhere to be', () => {
    const existing = game({ id: 'a', startTime: '10:00', location: 'Diamond 1' });
    assert.equal(check(game({ id: 'b', startTime: '10:00' }), [existing]), null);
  });

  it('returns null without a date or a time', () => {
    const existing = game({ id: 'a', startTime: '10:00', location: 'Diamond 1' });
    assert.equal(check(game({ id: 'b', location: 'Diamond 1' }), [existing]), null);
    assert.equal(check(game({ id: 'b', startTime: '10:00', location: 'Diamond 1', gameDate: null }), [existing]), null);
  });

  it('offers the earliest clean start after the existing games', () => {
    const existing = game({ id: 'a', startTime: '10:00', location: 'Diamond 1' });
    const result = check(game({ id: 'b', startTime: '10:30', location: 'Diamond 1' }), [existing]);
    assert.equal(result?.availableAt, '11:15'); // 10:00 + 60m game + 15m buffer
  });

  it("honours a game's own duration override", () => {
    const existing = game({ id: 'a', startTime: '10:00', location: 'Diamond 1', durationMinutes: 180 });
    const proposed = game({ id: 'b', startTime: '12:00', location: 'Diamond 1' });
    assert.equal(check(proposed, [existing])?.kind, 'overlap');
  });

  it("honours the PROPOSED game's own duration override, not just the existing game's", () => {
    // A 3-hour final in a 90-minute division: measured at the division default its back half is
    // invisible and the clash saves in silence. The editor must pass its own length through.
    const existing = game({ id: 'a', startTime: '12:00', location: 'Diamond 1' });
    const longProposed = game({ id: 'b', startTime: '10:00', location: 'Diamond 1', durationMinutes: 180 });
    assert.equal(check(longProposed, [existing])?.kind, 'overlap', 'the long game runs straight through 12:00');

    // Same slot at the default length genuinely does not reach it.
    const shortProposed = game({ id: 'b', startTime: '10:00', location: 'Diamond 1' });
    assert.equal(check(shortProposed, [existing]), null);
  });
});

describe('schedule-conflict — buildConflictMap', () => {
  it('badges both sides of a typed-field double-booking', () => {
    const games = [
      game({ id: 'a', startTime: '10:00', location: 'Diamond 1' }),
      game({ id: 'b', startTime: '10:30', location: 'Diamond 1' }),
    ];
    const map = buildConflictMap(games, DIVISIONS, TOURNAMENT);
    assert.equal(map.size, 2, 'both games must carry a badge');
    assert.equal(map.get('a')?.kind, 'overlap');
    assert.equal(map.get('b')?.kind, 'overlap');
    assert.equal(map.get('a')?.matchedOn, 'text');
  });

  it('leaves a clean schedule unbadged', () => {
    const games = [
      game({ id: 'a', startTime: '10:00', location: 'Diamond 1' }),
      game({ id: 'b', startTime: '10:00', location: 'Diamond 2' }),
      game({ id: 'c', startTime: '11:15', location: 'Diamond 1' }),
    ];
    assert.equal(buildConflictMap(games, DIVISIONS, TOURNAMENT).size, 0);
  });

  it('skips games with nowhere to be rather than grouping them together', () => {
    const games = [
      game({ id: 'a', startTime: '10:00' }),
      game({ id: 'b', startTime: '10:00' }),
      game({ id: 'c', startTime: '10:00', location: 'TBD' }),
    ];
    assert.equal(buildConflictMap(games, DIVISIONS, TOURNAMENT).size, 0);
  });

  it('escalates a buffer badge to an overlap when both apply', () => {
    const games = [
      game({ id: 'a', startTime: '10:00', location: 'Diamond 1' }),
      game({ id: 'b', startTime: '11:05', location: 'Diamond 1' }), // buffer vs a
      game({ id: 'c', startTime: '11:30', location: 'Diamond 1' }), // overlaps b
    ];
    const map = buildConflictMap(games, DIVISIONS, TOURNAMENT);
    assert.equal(map.get('b')?.kind, 'overlap');
  });
});

describe('schedule-conflict — timing helpers', () => {
  it('cascades duration from game override to division to tournament to default', () => {
    assert.equal(resolveGameTiming(null, TOURNAMENT, 45).durationMinutes, 45);
    assert.equal(resolveGameTiming(null, TOURNAMENT).durationMinutes, 60);
    assert.equal(resolveGameTiming(null, null).durationMinutes, 90);
    assert.equal(resolveGameTiming(null, null).bufferMinutes, 15);
  });

  it('round-trips times', () => {
    assert.equal(timeToMinutes('10:30'), 630);
    assert.equal(minutesToTime(630), '10:30');
    assert.ok(Number.isNaN(timeToMinutes('nonsense')));
  });
});
