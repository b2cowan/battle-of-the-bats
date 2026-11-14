import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { permitsSpan, settleOverlaps, type PermitRowBlock } from '../../lib/club-schedule-permit-rows.ts';
import { cutSlots } from '../../lib/club-schedule-engine.ts';
import { overlappingBlocks } from '../../lib/permit-time.ts';

/**
 * A schedule on several permits, Session A: where two ticked permits hold the same park at the same hour, the permit
 * ticked first keeps the evenings (owner ruling P4 A, 2026-11-14), on the drawing's own fixture (tab 3): Milton spring
 * 2027 (Mar 2 – May 29) and Milton June 2027 (May 25 – Jun 30) both hold Kinsmen Park's two diamonds Tue/Thu 6–8 p.m.
 */
const KINSMEN = 'kinsmen', LIONS = 'lions', A = 'diamond-a', B = 'diamond-b', F1 = 'field-1';
const SPRING = 'milton-spring', JUNE = 'milton-june';
const row = (o: Partial<PermitRowBlock> & Pick<PermitRowBlock, 'permitId'>): PermitRowBlock => ({
  venueId: KINSMEN, facilityIds: [A, B], weekdays: [2, 4], startTime: '18:00', endTime: '20:00', fromDate: null, untilDate: null, ...o,
});
const RANGE = { startsOn: '2027-03-02', endsOn: '2027-06-30' };
const spring = row({ permitId: SPRING, fromDate: '2027-03-02', untilDate: '2027-05-29' });
const june = row({ permitId: JUNE, fromDate: '2027-05-25', untilDate: '2027-06-30' });
const juneLions = row({ permitId: JUNE, venueId: LIONS, facilityIds: [F1], weekdays: [2], fromDate: '2027-05-25', untilDate: '2027-06-30' });
const venueFacilities = new Map([[KINSMEN, [A, B]], [LIONS, [F1]]]);

describe('settleOverlaps — the permit ticked first keeps the evenings', () => {
  it('Milton June loses Tue May 25 and Thu May 27 at Kinsmen; its time starts Tue Jun 1; Lions Park is untouched', () => {
    const { blocks, overlaps } = settleOverlaps([spring, june, juneLions], [SPRING, JUNE], RANGE);
    assert.deepEqual(blocks[0], spring, 'the first permit\'s row is as it was');
    assert.deepEqual(blocks.slice(1), [
      { ...june, fromDate: '2027-05-30', untilDate: '2027-06-30' },
      juneLions,
    ]);
    assert.deepEqual(overlaps, [{ permitId: JUNE, keptBy: SPRING, venueId: KINSMEN, days: ['2027-05-25', '2027-05-27'], startsOn: '2027-06-01' }]);
    // What is sent is never refused as overlapping, and holds each evening once.
    const time = { ...RANGE, blocks: blocks.map((b, i) => ({ ...b, id: `b${i}` })), datesOff: [] };
    assert.equal(overlappingBlocks(time, venueFacilities), null);
    const slots = cutSlots(time, { slotMinutes: 120, changeoverMinutes: 0, prime: null, venueFacilities });
    const may25 = slots.filter(s => s.day === '2027-05-25' && s.venueId === KINSMEN);
    assert.equal(may25.length, 2, 'two diamonds, once each');
    assert.ok(may25.every(s => s.permitId === SPRING), 'priced by the permit ticked first');
  });

  it('ticked the other way round, Milton June keeps them and spring ends before May 25', () => {
    const { blocks, overlaps } = settleOverlaps([spring, june], [JUNE, SPRING], RANGE);
    assert.deepEqual(blocks, [{ ...spring, fromDate: '2027-03-02', untilDate: '2027-05-24' }, june]);
    assert.equal(overlaps[0].keptBy, JUNE);
    assert.equal(overlaps[0].startsOn, null, 'spring still starts Mar 2: no "new time starts" line');
  });

  it('a facility or a weekday the first permit doesn\'t hold stays whole; only the shared ones lose the days', () => {
    const springA = row({ permitId: SPRING, facilityIds: [A], weekdays: [2], fromDate: '2027-03-02', untilDate: '2027-05-29' });
    const { blocks, overlaps } = settleOverlaps([springA, june], [SPRING, JUNE], RANGE);
    assert.deepEqual(blocks, [
      springA,
      { ...june, facilityIds: [B] },
      { ...june, facilityIds: [A], weekdays: [4] },
      { ...june, facilityIds: [A], weekdays: [2], fromDate: '2027-05-30', untilDate: '2027-06-30' },
    ]);
    assert.deepEqual(overlaps[0].days, ['2027-05-25']);
  });

  it('no overlap, nothing changes — and a typed row (no permit) never takes part', () => {
    const typed = row({ permitId: null, venueId: KINSMEN });
    const lions = row({ permitId: JUNE, venueId: LIONS, facilityIds: [F1] });
    const r = settleOverlaps([spring, typed, lions], [SPRING, JUNE], RANGE);
    assert.deepEqual(r.blocks, [spring, typed, lions]);
    assert.deepEqual(r.overlaps, []);
    assert.deepEqual(settleOverlaps([spring], [SPRING], RANGE), { blocks: [spring], overlaps: [] }, 'one permit: as before');
  });

  it('different hours at the same park never clash', () => {
    const late = row({ permitId: JUNE, startTime: '20:00', endTime: '22:00', fromDate: '2027-05-25', untilDate: '2027-06-30' });
    assert.deepEqual(settleOverlaps([spring, late], [SPRING, JUNE], RANGE).overlaps, []);
  });

  it('a permit wholly inside another loses every day it shares, and its row goes', () => {
    const inside = row({ permitId: JUNE, fromDate: '2027-04-06', untilDate: '2027-04-08' });
    const { blocks, overlaps } = settleOverlaps([spring, inside], [SPRING, JUNE], RANGE);
    assert.deepEqual(blocks, [spring]);
    assert.deepEqual(overlaps[0].days, ['2027-04-06', '2027-04-08']);
  });
});

describe('permitsSpan — From and To widen to cover every permit', () => {
  it('the first permit\'s first day to the last one\'s last', () => {
    assert.deepEqual(permitsSpan([{ startsOn: '2027-04-05', endsOn: '2027-06-25' }, { startsOn: '2027-03-02', endsOn: '2027-05-29' }]),
      { startsOn: '2027-03-02', endsOn: '2027-06-25' });
    assert.equal(permitsSpan([]), null);
  });
});
