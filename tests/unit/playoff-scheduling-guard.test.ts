import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterStartsAfterRoundRobinCompletion,
  getRoundRobinCompletion,
  startsBeforeRoundRobinCompletion,
} from '../../lib/playoff-scheduling-guard.ts';

describe('playoff scheduling guard', () => {
  it('uses the latest non-cancelled round-robin completion as the playoff minimum', () => {
    const completion = getRoundRobinCompletion([
      { date: '2026-07-17', time: '09:00', status: 'scheduled', isPlayoff: false },
      { date: '2026-07-17', time: '12:00', status: 'completed', isPlayoff: false },
      { date: '2026-07-17', time: '14:00', status: 'cancelled', isPlayoff: false },
      { date: '2026-07-17', time: '16:00', status: 'scheduled', isPlayoff: true },
    ], 90);

    assert.equal(completion?.toISOString(), new Date('2026-07-17T13:30').toISOString());
  });

  it('flags playoff starts before round robin completion', () => {
    const completion = new Date('2026-07-17T13:30');

    assert.equal(startsBeforeRoundRobinCompletion({ date: '2026-07-17', time: '13:00' }, completion), true);
    assert.equal(startsBeforeRoundRobinCompletion({ date: '2026-07-17', time: '13:30' }, completion), false);
    assert.equal(startsBeforeRoundRobinCompletion({ date: '2026-07-17', time: '14:00' }, completion), false);
  });

  it('filters generated playoff slots to starts after round robin completion', () => {
    const completion = new Date('2026-07-17T13:30');
    const slots = filterStartsAfterRoundRobinCompletion([
      { date: '2026-07-17', time: '12:00', venueId: 'v1' },
      { date: '2026-07-17', time: '13:30', venueId: 'v1' },
      { date: '2026-07-18', time: '09:00', venueId: 'v1' },
    ], completion);

    assert.deepEqual(slots.map(slot => `${slot.date} ${slot.time}`), [
      '2026-07-17 13:30',
      '2026-07-18 09:00',
    ]);
  });
});
