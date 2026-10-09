import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { slotsClearOfTakenGames, type ConflictGame } from '../../lib/schedule-conflict.ts';
import type { Division, Tournament } from '../../lib/types.ts';

/**
 * F69 (Tournament admin redesign, Stage 3 defects pass): the generators emitted every date × time × surface with
 * nothing subtracted, so a U13 draft could land on a U11 game sharing the diamond — and a division's OWN kept games
 * were blocked only by an exact slot-key match that a stored "10:00:00" never made with a draft's "10:00". The rule:
 * a draft is offered only the slots the Add/Edit window would accept.
 */

const U11 = { id: 'u11', tournamentId: 't1', name: 'U11' } as unknown as Division;
const U13 = { id: 'u13', tournamentId: 't1', name: 'U13' } as unknown as Division;
const DIVISIONS = [U11, U13];
// 60-minute games, 15-minute buffer.
const TOURNAMENT = { id: 't1', settings: { game_duration_minutes: 60, buffer_minutes: 15 } } as unknown as Tournament;

const DAY = '2026-10-10';
const slot = (time: string, venueFacilityId: string) => ({ date: DAY, time, venueId: 'park', venueFacilityId, venueName: `Park - ${venueFacilityId}` });
// A draft day on two diamonds, a slot every 75 minutes (60 + 15).
const SLOTS = ['09:00', '10:15', '11:30', '12:45'].flatMap(t => [slot(t, 'd1'), slot(t, 'd2')]);

function taken(over: Partial<ConflictGame> & { id: string }): ConflictGame {
  return { gameDate: DAY, status: 'completed', divisionId: 'u11', venueId: 'park', venueFacilityId: 'd1', ...over };
}

function clear(takenGames: ConflictGame[], draftLengthMinutes = 60, divisions = DIVISIONS, tournament = TOURNAMENT) {
  return slotsClearOfTakenGames(SLOTS, { takenGames, divisionId: 'u13', draftLengthMinutes, divisions, tournament })
    .map(s => `${s.time}@${s.venueFacilityId}`);
}

describe('generator slots — another division\'s game takes its diamond for its length (F69)', () => {
  it('removes only the overlapping slots, and only on that diamond', () => {
    // A U11 game on Diamond 1, 10:00–11:00 (stored with seconds, as the games route returns it).
    const result = clear([taken({ id: 'g1', startTime: '10:00:00' })]);
    // 09:00–10:00 ends as it starts (touching, not overlapping); 10:15 overlaps; 11:30 is clear.
    assert.deepEqual(result, ['09:00@d1', '09:00@d2', '10:15@d2', '11:30@d1', '11:30@d2', '12:45@d1', '12:45@d2']);
  });

  it('keeps a slot that only falls inside the buffer (a buffer warns, it never refuses)', () => {
    // U11 game 08:00–09:00; the 09:00 slot starts inside its 15-minute buffer.
    const result = clear([taken({ id: 'g1', startTime: '08:00' })]);
    assert.ok(result.includes('09:00@d1'));
  });

  it('a cancelled game holds nothing', () => {
    const result = clear([taken({ id: 'g1', startTime: '10:00', status: 'cancelled' })]);
    assert.equal(result.length, SLOTS.length);
  });

  it('times the taken game by its own length (game → division → tournament)', () => {
    // A 150-minute final, 09:00–11:30, blocks 09:00 and 10:15 on Diamond 1 but not 11:30.
    const result = clear([taken({ id: 'final', startTime: '09:00', durationMinutes: 150 })]);
    assert.ok(!result.includes('09:00@d1') && !result.includes('10:15@d1'));
    assert.ok(result.includes('11:30@d1'));
  });

  it('times the draft by the LONGER of its own length and the one its saved game will carry', () => {
    // U13 saves no per-game length; its division runs 90 minutes. A 60-minute draft at 09:00 would end 10:00 in
    // the generator's eyes but 10:30 in the Add window's — so a U11 game at 10:15 takes the 09:00 slot.
    const u13Long = { ...U13, settings: { game_duration_minutes: 90 } } as unknown as Division;
    const result = clear([taken({ id: 'g1', startTime: '10:15' })], 60, [U11, u13Long]);
    assert.ok(!result.includes('09:00@d1'));
  });

  it('a venue-only game takes every diamond of its park; a typed field name never matches a picked one', () => {
    const venueOnly = clear([taken({ id: 'g1', startTime: '10:00', venueFacilityId: null })]);
    assert.ok(!venueOnly.includes('10:15@d1') && !venueOnly.includes('10:15@d2'));
    const typed = clear([taken({ id: 'g2', startTime: '10:00', venueId: null, venueFacilityId: null, location: 'Park - d1' })]);
    assert.equal(typed.length, SLOTS.length);
  });

  it('the division\'s own kept game blocks its slot too — the "10:00:00" vs "10:00" key never matched', () => {
    const result = clear([taken({ id: 'kept', divisionId: 'u13', startTime: '10:15:00', status: 'scheduled' })]);
    assert.ok(!result.includes('10:15@d1'));
  });

  it('nothing taken → every slot is offered (the same array)', () => {
    assert.equal(slotsClearOfTakenGames(SLOTS, { takenGames: [], divisionId: 'u13', draftLengthMinutes: 60, divisions: DIVISIONS, tournament: TOURNAMENT }), SLOTS);
  });
});
