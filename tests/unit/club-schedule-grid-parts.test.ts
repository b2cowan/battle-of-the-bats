import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  engineSlotsOf, partKinds, partRowKey, placeKey, placeRows, slotPlaceName, slotRowKey, slotsByCell, cellKey, type SchedulePlace, type SlotView,
} from '../../lib/club-schedule-view.ts';
import { scheduleOverview } from '../../lib/club-schedule-overview.ts';
import { SCHEDULE_SCREEN_WORDS as W } from '../../lib/club-schedule-words.ts';

/**
 * THE GRID AND THE BILL WITH A FIELD IN PARTS (Club schedules Stage 2, Session 2B — round 1 Ask 8 B, round 2 tabs 4 and 5):
 * a row per part the schedule uses, indented under its field, in the field's order; a whole-field slot stays on the
 * field's own row; a field used only in parts is a label over its parts. The bill names a quarter by price, and the Split
 * hint says "or one side" and "a quarter" only when the time has them. A schedule with no part draws exactly as before.
 */

const V = 'v-dome';
const PLACES: SchedulePlace[] = [{
  venueId: V, venueName: 'Milton Sports Dome',
  facilities: [{ id: 'f1', name: 'Field 1', sections: 4 }, { id: 'f2', name: 'Field 2', sections: 2 }, { id: 'f3', name: 'Field 3' }],
}];

const slot = (key: string, facilityId: string, sectionMask: number, startClock = '09:00', day = '2027-01-03', over: Partial<SlotView> = {}): SlotView => ({
  id: key, key, venueId: V, facilityId, sectionMask, startsAt: `${day}T14:00:00Z`, endsAt: `${day}T15:30:00Z`, day, weekday: 7, week: '2026-12-28',
  startClock, endClock: '10:30', prime: false, weight: 1, teamIds: [], locked: false, movedByHand: false, pricePermitId: null,
  handedBack: null, heldBy: null, clash: false, ...over,
});

describe('placeRows: a row per part, under its field', () => {
  it('Field 1 used whole and as quarters A–B, C and D: the field row, then A–B, C, D in the field’s order', () => {
    const rows = placeRows(PLACES, [slot('a', 'f1', 8), slot('b', 'f1', 3), slot('c', 'f1', 4), slot('d', 'f1', 0, '12:00')]);
    assert.deepEqual(rows.map(r => [r.name, r.sub, r.sectionMask, !!r.labelOnly]), [
      ['Field 1', 'Milton Sports Dome', 0, false],
      ['Quarters A–B', 'Field 1 · Milton Sports Dome', 3, false],
      ['Quarter C', 'Field 1 · Milton Sports Dome', 4, false],
      ['Quarter D', 'Field 1 · Milton Sports Dome', 8, false],
    ]);
    assert.ok(rows.every(r => r.fieldKey === placeKey(V, 'f1')));
    assert.deepEqual(rows.map(r => r.fullName), ['Field 1', 'Field 1 quarters A–B', 'Field 1 quarter C', 'Field 1 quarter D']);
  });
  it('a field used only in parts: its own row is a label over its sides', () => {
    const rows = placeRows(PLACES, [slot('a', 'f2', 3), slot('b', 'f2', 12)]);
    assert.deepEqual(rows.map(r => [r.name, !!r.labelOnly]), [['Field 2', true], ['Side A', false], ['Side B', false]]);
  });
  it('a slot is drawn on its own row: a whole-field slot on the field’s, a part on its part’s', () => {
    const slots = [slot('w', 'f1', 0), slot('q', 'f1', 1)];
    const byCell = slotsByCell(slots);
    assert.deepEqual(byCell.get(cellKey(placeKey(V, 'f1'), '2027-01-03'))?.map(s => s.key), ['w']);
    assert.deepEqual(byCell.get(cellKey(partRowKey(V, 'f1', 1), '2027-01-03'))?.map(s => s.key), ['q']);
    assert.equal(slotRowKey(slots[1]), `${V}|f1|1`);
  });
  it('a schedule with no part: exactly the rows and keys it always had', () => {
    const slots = [slot('a', 'f3', 0), { ...slot('b', 'f1', 0), sectionMask: undefined }];
    const rows = placeRows(PLACES, slots);
    assert.deepEqual(rows.map(r => [r.key, r.name, r.venueName]), [[placeKey(V, 'f1'), 'Field 1', 'Milton Sports Dome'], [placeKey(V, 'f3'), 'Field 3', 'Milton Sports Dome']]);
    assert.ok(rows.every(r => !r.labelOnly && r.key === r.fieldKey && r.sectionMask === 0));
    assert.deepEqual([...slotsByCell(slots).keys()], [cellKey(placeKey(V, 'f3'), '2027-01-03'), cellKey(placeKey(V, 'f1'), '2027-01-03')]);
  });
  it('the overview groups a part’s slots on its own row', () => {
    const slots = [slot('w', 'f1', 0), slot('q', 'f1', 1)];
    const patterns = scheduleOverview(placeRows(PLACES, slots), ['2027-01-03'], slots, new Set());
    assert.deepEqual(patterns.map(p => p.place.name), ['Field 1', 'Quarter A']);
  });
});

describe('a slot’s place in words, and the engine’s view of it', () => {
  it('"Field 1 quarter C", "Field 2 side A", "Field 3"', () => {
    assert.equal(slotPlaceName(PLACES, slot('a', 'f1', 4)), 'Field 1 quarter C');
    assert.equal(slotPlaceName(PLACES, slot('a', 'f2', 3)), 'Field 2 side A');
    assert.equal(slotPlaceName(PLACES, slot('a', 'f3', 0)), 'Field 3');
  });
  it('a part’s place in the week carries the part, so a move "every week" stays on that part', () => {
    const [p, w] = engineSlotsOf([slot('a', 'f2', 12), slot('b', 'f3', 0)]);
    assert.equal(p.pos, `7|09:00|${V}|f2|12`);
    assert.equal(p.sectionMask, 12);
    assert.equal(w.pos, `7|09:00|${V}|f3`);
    assert.equal(w.sectionMask, undefined);
  });
});

describe('the bill: a quarter by price, and the Split hint', () => {
  it('one kind says it whole: "10 quarter-field slots"', () => {
    assert.equal(W.billTeamCaption(0, 0, 10, 0, 0, 3.75), '10 quarter-field slots · 3.8 full-field hours');
  });
  it('two kinds, the shipped pattern: "6 half + 4 quarter"', () => {
    assert.equal(W.billTeamCaption(0, 6, 4, 0, 0, 6), '6 half + 4 quarter · 6 full-field hours');
  });
  it('"more" stays for any other price (an eighth)', () => {
    assert.equal(W.billTeamCaption(0, 0, 0, 0, 3, 0.5), '3 more · 0.5 full-field hours');
    assert.equal(W.billTeamCaption(25, 25, 0, 0, 0, 56.25), '25 full + 25 half · 56.3 full-field hours', 'unchanged without a quarter');
  });
  it('the Split hint: exactly today’s without parts; "or one side" and "a quarter" when the time has them', () => {
    assert.equal(W.billSplitHint('$80.00', null), 'Each field at the permit’s price: a full field $80.00 an hour');
    assert.equal(W.billSplitHint('$80.00', '$40.00'), 'Each field at the permit’s price: a full field $80.00 an hour, a half field $40.00');
    assert.equal(W.billSplitHint('$80.00', '$40.00', true, '$20.00'),
      'Each field at the permit’s price: a full field $80.00 an hour, a half field or one side $40.00, a quarter $20.00');
  });
  it('which kinds the time has: a side or half (3, 12), a quarter (1, 2, 4, 8)', () => {
    assert.deepEqual(partKinds([slot('a', 'f1', 0)]), { half: false, quarter: false });
    assert.deepEqual(partKinds([slot('a', 'f2', 3)]), { half: true, quarter: false });
    assert.deepEqual(partKinds([slot('a', 'f1', 4), slot('b', 'f1', 12)]), { half: true, quarter: true });
  });
});
