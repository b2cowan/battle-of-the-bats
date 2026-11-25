import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fieldsLeftOff, permitPlaces, permitRowDates, rowOffItsPermit, savedPermitPlaces } from '../../lib/club-schedule-permit-rows.ts';
import { cutSlots } from '../../lib/club-schedule-engine.ts';
import { billShares, pricedMinutes, type BillSlot } from '../../lib/club-schedule-bill.ts';
import { PART_WORDS, SCHEDULE_SCREEN_WORDS as W } from '../../lib/club-schedule-words.ts';
import { fieldPrices } from '../../lib/permit-time.ts';
import { facilityListWords } from '../../lib/permit-words.ts';
import { formatShortWeekdayDate } from '../../lib/timezone.ts';

/**
 * PICK THE FIELDS — a schedule on some of a permit's fields (SCHEDULE_FIELDS_SAME_TIME_TRADES_PLAN.md Stage 1; owner
 * rulings 2026-11-25, Asks 1–6 all A). The drawing's own fixture: "Dome, winter 2027" holds Milton Sports Dome's six
 * fields, Sundays 9:00 a.m. – 1:30 p.m., Jan 3 – Mar 7, 2027. The schedule "Winter dome, January" uses Fields 1 and 2.
 */
const DOME = 'v-dome', PARK = 'v-park', DIAMOND = 'v-diamond';
const F = ['f-1', 'f-2', 'f-3', 'f-4', 'f-5', 'f-6'];
const VF = new Map<string, string[]>([[DOME, F], [PARK, ['p-a', 'p-b']], [DIAMOND, []]]);
const DOME_PERMIT = 'dome-winter-2027';
const domeBlock = { id: 'b1', venueId: DOME, facilityIds: F, weekdays: [7], startTime: '09:00', endTime: '13:30', fromDate: null, untilDate: null };
const permit = { id: DOME_PERMIT, startsOn: '2027-01-03', endsOn: '2027-03-07', blocks: [domeBlock], datesOff: [] };

describe('permitPlaces — what a permit holds, by venue', () => {
  it('the union of its blocks, in the venue\'s order; a block with none listed holds every facility', () => {
    const held = permitPlaces([
      { id: 'two-parks', blocks: [
        { venueId: PARK, facilityIds: ['p-b'] }, { venueId: DOME, facilityIds: ['f-4', 'f-2'] }, { venueId: PARK, facilityIds: [] },
        { venueId: DIAMOND, facilityIds: [] },
      ] },
    ], VF);
    assert.deepEqual(held.get('two-parks')?.get(DOME), ['f-2', 'f-4']);
    assert.deepEqual(held.get('two-parks')?.get(PARK), ['p-a', 'p-b']);
    assert.deepEqual(held.get('two-parks')?.get(DIAMOND), [null], 'a venue with no facilities is held as itself');
  });
});

describe('rowOffItsPermit — the save refuses a field the row\'s permit does not hold', () => {
  const held = permitPlaces([permit, { id: 'half', blocks: [{ venueId: DOME, facilityIds: ['f-1', 'f-2'] }] }], VF);
  it('Fields 1 and 2 of the dome\'s six go through', () => {
    assert.equal(rowOffItsPermit([{ venueId: DOME, facilityIds: ['f-1', 'f-2'], permitId: DOME_PERMIT }], held, VF), false);
  });
  it('a field the permit holds no time on is refused, and so is a venue it has no time at', () => {
    assert.equal(rowOffItsPermit([{ venueId: DOME, facilityIds: ['f-1', 'f-5'], permitId: 'half' }], held, VF), true);
    assert.equal(rowOffItsPermit([{ venueId: PARK, facilityIds: ['p-a'], permitId: DOME_PERMIT }], held, VF), true);
  });
  it('a row naming no facility means every one at its venue: refused where the permit holds only some', () => {
    assert.equal(rowOffItsPermit([{ venueId: DOME, facilityIds: [], permitId: DOME_PERMIT }], held, VF), false);
    assert.equal(rowOffItsPermit([{ venueId: DOME, facilityIds: [], permitId: 'half' }], held, VF), true);
  });
  it('typed time (no permit) is never checked; a permit not read is the "permit gone" refusal\'s, not this one\'s', () => {
    assert.equal(rowOffItsPermit([{ venueId: PARK, facilityIds: ['p-a'], permitId: null }], held, VF), false);
    assert.equal(rowOffItsPermit([{ venueId: DOME, facilityIds: ['f-1'], permitId: 'not-read' }], held, VF), false);
  });
  it('a place the schedule\'s own saved rows held on that permit stays allowed, after the permit was edited (/review 2026-11-25)', () => {
    // The permit now holds Fields 1 and 2; the schedule was saved on all six, its row naming none (= every field).
    const saved = savedPermitPlaces([{ venueId: DOME, facilityIds: [], permitId: 'half' }], VF);
    assert.equal(rowOffItsPermit([{ venueId: DOME, facilityIds: ['f-5'], permitId: 'half' }], held, VF, saved), false);
    assert.equal(rowOffItsPermit([{ venueId: DOME, facilityIds: [], permitId: 'half' }], held, VF, saved), false);
    // A place neither the permit nor the saved rows held is still refused.
    const narrow = savedPermitPlaces([{ venueId: DOME, facilityIds: ['f-1'], permitId: 'half' }], VF);
    assert.equal(rowOffItsPermit([{ venueId: DOME, facilityIds: ['f-6'], permitId: 'half' }], held, VF, narrow), true);
  });
  it('the routes check only the rows the admin asked (never rows the keep rule brought back), against the saved rows', () => {
    const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
    const server = read('../../lib/club-schedule-server.ts');
    assert.match(server, /rowOffItsPermit\(check\?\.asked \?\? blocks, prices\.held, prices\.venueFacilities, alsoHeld\) \? refusal\(409, 'permit_facility', R\.permitFacilityOff\)/);
    assert.match(server, /gone: permitGone\(prices, blocks, check\)/);
    assert.match(read('../../app/api/admin/schedules/generate/route.ts'), /readRequestPrices\(orgId, permitId, time\.blocks, loaded \? \{ asked: askedTime\.blocks, saved: loaded\.time\.blocks \} : undefined\)/);
    assert.match(read('../../app/api/admin/schedules/[scheduleId]/route.ts'), /readRequestPrices\(orgId, pricePermitOf\(loaded\.row\), req\.time\.blocks, \{ asked: asked\.time\.blocks, saved: loaded\.time\.blocks \}\)/);
  });
});

describe('fieldsLeftOff — the card says what is left (Ask 3 A)', () => {
  const held = permitPlaces([permit], VF).get(DOME_PERMIT);
  it('Fields 3–6 are left off a schedule on Fields 1 and 2', () => {
    const left = fieldsLeftOff(held, [{ venueId: DOME, facilityIds: ['f-1', 'f-2'] }]);
    assert.deepEqual(left, [{ venueId: DOME, facilityIds: ['f-3', 'f-4', 'f-5', 'f-6'] }]);
    const words = W.notOnSchedule(facilityListWords(['Field 3', 'Field 4', 'Field 5', 'Field 6']), true, null);
    assert.equal(words, 'Fields 3–6 are not on this schedule.');
  });
  it('no line when every field is on a row: Fields 1–2 all morning, Fields 3–6 for the last slot', () => {
    assert.deepEqual(fieldsLeftOff(held, [{ venueId: DOME, facilityIds: ['f-1', 'f-2'] }, { venueId: DOME, facilityIds: ['f-3', 'f-4', 'f-5', 'f-6'] }]), []);
  });
  it('one field reads in the singular; on Add time the line names the added time', () => {
    assert.equal(W.notOnSchedule('Field 3', false, null), 'Field 3 is not on this schedule.');
    assert.equal(PART_WORDS.notOnAddedTime('Fields 5–6', true, null), 'Fields 5–6 are not on this added time.');
  });
});

describe('permitRowDates — a permit\'s time stops at the permit\'s dates (Ask 6 A)', () => {
  const own = { fromDate: '2027-01-03', untilDate: '2027-03-07' };
  it('one permit, From and To inside it: the row follows the schedule\'s dates, as before', () => {
    assert.deepEqual(permitRowDates({}, own, false, { startsOn: '2027-01-03', endsOn: '2027-01-31' }), { fromDate: null, untilDate: null });
  });
  it('one permit, To typed past its last day: the row stops at the permit\'s dates', () => {
    assert.deepEqual(permitRowDates({}, own, false, { startsOn: '2027-01-03', endsOn: '2027-03-28' }), own);
    assert.equal(W.toStopsAt('Dome, winter 2027', formatShortWeekdayDate('2027-03-07')), 'Dome, winter 2027 ends Sun, Mar 7. Its time stops there.');
    assert.deepEqual(permitRowDates({}, own, false, { startsOn: '2026-12-27', endsOn: '2027-01-31' }), own, 'From before the permit: the same rule');
    assert.equal(W.fromStartsAt('Dome, winter 2027', formatShortWeekdayDate('2027-01-03')), 'Dome, winter 2027 starts Sun, Jan 3. Its time starts there.');
  });
  it('several permits keep each row to its permit\'s dates, as they already did; a row\'s own dates win', () => {
    assert.deepEqual(permitRowDates({}, own, true, { startsOn: '2027-01-03', endsOn: '2027-01-31' }), own);
    const found = { dates: { fromDate: '2027-01-10', untilDate: '2027-02-14' } };
    assert.deepEqual(permitRowDates(found, own, false, { startsOn: '2027-01-03', endsOn: '2027-03-28' }), found.dates);
  });
  it('a From or To not yet typed reaches past nothing; typed time (no permit) is held to no permit\'s dates', () => {
    assert.deepEqual(permitRowDates({}, own, false, { startsOn: '', endsOn: '' }), { fromDate: null, untilDate: null });
    assert.deepEqual(permitRowDates({}, own, false, { startsOn: '2027-01-03', endsOn: '2027-1' }), { fromDate: null, untilDate: null }, 'a half-typed To');
    assert.deepEqual(permitRowDates({}, null, false, { startsOn: '2027-01-03', endsOn: '2027-03-28' }), { fromDate: null, untilDate: null });
  });
  it('the cut: To on Mar 28 makes no Sunday past Mar 7 once the row carries the permit\'s dates', () => {
    const range = { startsOn: '2027-01-03', endsOn: '2027-03-28' };
    const row = { ...domeBlock, facilityIds: ['f-1', 'f-2'], ...permitRowDates({}, own, false, range), permitId: DOME_PERMIT };
    const slots = cutSlots({ ...range, blocks: [row], datesOff: [] }, { slotMinutes: 90, changeoverMinutes: 0, prime: null, venueFacilities: VF });
    assert.equal(slots.reduce((m, s) => (s.day > m ? s.day : m), ''), '2027-03-07');
  });
});

describe('the bill: two of six fields bills those hours only', () => {
  it('2 fields × 3 slots × 5 Sundays = 30 slots; at the permit\'s own hour, less than the permit costs', () => {
    const range = { startsOn: '2027-01-03', endsOn: '2027-01-31' };
    const row = { ...domeBlock, facilityIds: ['f-1', 'f-2'], permitId: DOME_PERMIT };
    const slots = cutSlots({ ...range, blocks: [row], datesOff: [] }, { slotMinutes: 90, changeoverMinutes: 0, prime: null, venueFacilities: VF });
    assert.equal(slots.length, 30, 'the drawing\'s foot: "30 slots"');
    assert.ok(slots.every(s => s.facilityId === 'f-1' || s.facilityId === 'f-2'));
    // The permit's hour is its cost over every field it holds: 6 fields × 4.5 h × 10 Sundays = 270 h; $27,000.00 → $100.00.
    const prices = fieldPrices(permit, VF, new Map(), 27000);
    assert.equal(prices.fullHour, 100);
    const billSlots: BillSlot[] = slots.map(s => ({ day: s.day, startMs: s.startMs, endMs: s.endMs, weight: s.weight, teamIds: ['t1'] }));
    const bill = billShares(pricedMinutes(billSlots), { fullHour: prices.fullHour, amount: null, teamOrder: ['t1'] })!;
    // 30 slots × 1.5 h × $100.00 = $4,500.00 — the hours held, never the permit's $27,000.00.
    assert.equal(bill.totalCents, 450000);
  });
});
