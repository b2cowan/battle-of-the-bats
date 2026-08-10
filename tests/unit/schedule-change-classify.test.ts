import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyScheduleChange, type GameScheduleSnapshot } from '../../lib/schedule-change-classify.ts';

const base: GameScheduleSnapshot = {
  date: '2026-08-15',
  time: '09:00',
  location: 'Lions Park — Diamond 2',
  status: 'scheduled',
  venueId: 'venue-1',
  venueFacilityId: 'facility-2',
};

describe('schedule-change classify — venue judged on refs, not the derived string', () => {
  it('a cosmetic rewrite of the display string (same refs) is NOT a move', () => {
    // Phase 2 canonicalizes legacy "Venue - Facility" (hyphen) labels on ordinary saves —
    // a notes-only edit must never buzz a family with "your game moved".
    const before = { ...base, location: 'Lions Park - Diamond 2' };
    assert.equal(classifyScheduleChange(before, base), null);
  });

  it('a venue rename (same refs, new derived string) is NOT a move', () => {
    const after = { ...base, location: 'Lions Community Park — Diamond 2' };
    assert.equal(classifyScheduleChange(base, after), null);
  });

  it('a real venue change IS a move, and so is a surface change within the venue', () => {
    assert.equal(classifyScheduleChange(base, { ...base, venueId: 'venue-9', location: 'Community Park' }), 'moved');
    assert.equal(classifyScheduleChange(base, { ...base, venueFacilityId: 'facility-1', location: 'Lions Park — Diamond 1' }), 'moved');
  });

  it('text-placed games (no refs on either side) still move on a text change', () => {
    const a = { ...base, venueId: null, venueFacilityId: null, location: 'Riverside Gym' };
    const b = { ...a, location: 'Central Gym' };
    assert.equal(classifyScheduleChange(a, b), 'moved');
    assert.equal(classifyScheduleChange(a, { ...a }), null);
  });

  it('gaining or losing a venue reference IS a move', () => {
    const textPlaced = { ...base, venueId: null, venueFacilityId: null, location: 'Riverside Gym' };
    assert.equal(classifyScheduleChange(textPlaced, base), 'moved');
    assert.equal(classifyScheduleChange(base, textPlaced), 'moved');
  });

  it('ref-less snapshots (the bulk shift path) keep the legacy string diff', () => {
    const a = { date: '2026-08-15', time: '09:00', location: 'Lions Park - Diamond 2', status: 'scheduled' };
    const b = { ...a, location: 'Lions Park — Diamond 2' };
    // Without refs the classifier cannot tell cosmetic from real — the string diff stands.
    assert.equal(classifyScheduleChange(a, b), 'moved');
    assert.equal(classifyScheduleChange(a, { ...a }), null);
  });

  it('date/time changes move; cancel/restore/played classifications are unchanged', () => {
    assert.equal(classifyScheduleChange(base, { ...base, time: '11:00' }), 'moved');
    assert.equal(classifyScheduleChange(base, { ...base, date: '2026-08-16' }), 'moved');
    assert.equal(classifyScheduleChange(base, { ...base, status: 'cancelled' }), 'cancelled');
    assert.equal(classifyScheduleChange({ ...base, status: 'cancelled' }, base), 'restored');
    assert.equal(classifyScheduleChange(base, { ...base, status: 'completed' }), null);
  });
});
