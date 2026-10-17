import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchesScheduleTeamFilter, orderScheduleAsks, scheduleOverview } from '../../lib/club-schedule-overview.ts';
import type { ScheduleAsk, SlotView } from '../../lib/club-schedule-view.ts';

const days = ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25'];
const places = [{ key: 'dome|f1', venueId: 'dome', facilityId: 'f1', name: 'Field 1', venueName: 'Lakeshore Dome' }];
const slot = (day: string, teamIds: string[], over: Partial<SlotView> = {}): SlotView => ({
  id: day, key: `dome|f1|${day}`, venueId: 'dome', facilityId: 'f1', startsAt: `${day}T12:00:00Z`, endsAt: `${day}T13:30:00Z`,
  day, weekday: 7, week: day, startClock: '08:00', endClock: '09:30', prime: false, weight: 1,
  teamIds, locked: false, movedByHand: false, handedBack: null, heldBy: null, clash: false, ...over,
});
const ask = (id: string, affected: string, askedOn: string, late = false): ScheduleAsk => ({
  id, teamId: id, teamName: id, late, askedOn, handedBackOn: late ? affected : null, askedBy: null,
  cents: null, count: 1, weekday: 7,
  sundays: [{ slotId: id, startsAt: `${affected}T12:00:00Z`, venueId: 'dome', facilityId: 'f1' }],
});

describe('club schedule overview', () => {
  it('shows one usual assignment and names every different or missing date', () => {
    const reads = [slot(days[0], ['a']), slot(days[1], ['a']), slot(days[2], ['b'])];
    const [pattern] = scheduleOverview(places, days, reads, new Set());
    assert.deepEqual(pattern.usualDays, days.slice(0, 2));
    assert.equal(pattern.usual[0].teamIds[0], 'a');
    assert.deepEqual(pattern.different.map(x => [x.day, x.slots[0]?.teamIds[0] ?? 'no time']), [
      [days[2], 'b'], [days[3], 'no time'],
    ]);
  });

  it('does not hide a locked, clashing or asked Sunday inside an identical team run', () => {
    const reads = [slot(days[0], ['a']), slot(days[1], ['a']), slot(days[2], ['a'], { locked: true }), slot(days[3], ['a'], { clash: true })];
    const [pattern] = scheduleOverview(places, days, reads, new Set([days[1]]));
    assert.deepEqual(pattern.usualDays, [days[0]]);
    assert.deepEqual(pattern.different.map(x => x.day), days.slice(1));
  });

  it('orders requests by the affected club day, then by request age', () => {
    const requests = [ask('later', '2027-01-10', '2026-10-12'), ask('soon-old', '2026-11-22', '2026-10-10'), ask('soon-new', '2026-11-22', '2026-10-15')];
    assert.deepEqual(orderScheduleAsks(requests, []).map(x => x.id), ['soon-old', 'soon-new', 'later']);
  });

  it('uses the live slot day for a waiting ask and the hand-back day for a late ask', () => {
    const waiting = ask('live', '2026-11-29', '2026-10-10');
    const late = ask('late', '2026-11-15', '2026-10-17', true);
    assert.deepEqual(orderScheduleAsks([waiting, late], [{ id: 'live', day: '2026-11-08' }]).map(x => x.id), ['live', 'late']);
  });

  it('requires the same team to meet Group and Team in shared time', () => {
    const groupOf = (id: string) => ({ senior: 'senior', junior: 'junior' })[id as 'senior' | 'junior'];
    assert.equal(matchesScheduleTeamFilter(['senior', 'junior'], new Set(['senior']), new Set(), groupOf), true);
    assert.equal(matchesScheduleTeamFilter(['senior', 'junior'], new Set(['senior']), new Set(['junior']), groupOf), false);
    assert.equal(matchesScheduleTeamFilter(['senior', 'junior'], new Set(['senior']), new Set(['senior']), groupOf), true);
    assert.equal(matchesScheduleTeamFilter([], new Set(['senior']), new Set(), groupOf), false);
    assert.equal(matchesScheduleTeamFilter([], new Set(), new Set(), groupOf), true);
  });
});
