import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fieldPrices, heldTime, overlappingBlocks, permitAnswer, permitUse, weekdayOf,
  type PermitTime, type UseBooking, type VenueFacilities,
} from '../../lib/permit-time.ts';
import { facilityListWords, hoursWords, permitCalendarLine, permitLine, permitSeriesLine, renewedName, type PermitOutside } from '../../lib/permit-words.ts';
import { zonedWallClockToUtc } from '../../lib/timezone.ts';

/**
 * THE PERMIT'S ANSWER, CASE BY CASE (Club Tier Stage 10a, Ask 3 — the build prompt's table) and the permit's arithmetic
 * (Ask 21: the dome's $72.00 / $36.00; the use's Held − Booked = Unused, totals = Σ rows). The names are the test club's
 * (scripts/seed-club-fixture.mjs --club-permits); the dates are fixed here so the cases never drift.
 */

const LIONS = 'v-lions', KINSMEN = 'v-kinsmen', DOME = 'v-dome', WESTFIELD = 'v-westfield';
const D1 = 'f-d1', D2 = 'f-d2', D3 = 'f-d3', DA = 'f-da', DB = 'f-db';
const FIELDS = ['f-1', 'f-2', 'f-3', 'f-4', 'f-5', 'f-6'];
const venues: VenueFacilities = new Map<string, string[]>([
  [LIONS, [D1, D2, D3]], [KINSMEN, [DA, DB]], [DOME, FIELDS], [WESTFIELD, []],
]);

/** Fall diamonds 2026: Lions Park Diamond 2 Tue + Thu 5:30–9:00 p.m., Kinsmen Park Diamond B Tue 6:00–9:00 p.m. */
const fall: PermitTime = {
  id: 'p-fall', startsOn: '2026-09-08', endsOn: '2026-10-29',
  blocks: [
    { id: 'b-1', venueId: LIONS, facilityIds: [D2], weekdays: [2, 4], startTime: '17:30', endTime: '21:00', fromDate: null, untilDate: null },
    { id: 'b-2', venueId: KINSMEN, facilityIds: [DB], weekdays: [2], startTime: '18:00', endTime: '21:00', fromDate: null, untilDate: null },
  ],
  datesOff: [{ day: '2026-10-13', note: 'Thanksgiving week' }],
};
/** The winter dome: Fields 1–6, Sundays 8:00–11:00 a.m., Oct 4, 2026 – Mar 28, 2027, Dec 27 off. */
const dome: PermitTime = {
  id: 'p-dome', startsOn: '2026-10-04', endsOn: '2027-03-28',
  blocks: [{ id: 'b-dome', venueId: DOME, facilityIds: [], weekdays: [7], startTime: '08:00', endTime: '11:00', fromDate: null, untilDate: null }],
  datesOff: [{ day: '2026-12-27', note: 'the dome is closed' }],
};

const at = (day: string, from: string, to: string) => ({ startMs: Date.parse(zonedWallClockToUtc(day, from)!), endMs: Date.parse(zonedWallClockToUtc(day, to)!) });
const booking = (venueId: string | null, facilityId: string | null, day: string, from: string, to: string) => ({ venueId, facilityId, ...at(day, from, to) });

describe('the permit\'s answer (Ask 3) — case by case', () => {
  it('weekdays are Monday first: Tue Sep 8, 2026 is 2, Sun Oct 4 is 7', () => {
    assert.equal(weekdayOf('2026-09-08'), 2);
    assert.equal(weekdayOf('2026-10-04'), 7);
  });
  it('inside: a Tuesday 6:00–7:30 p.m. on Diamond 2', () => {
    assert.deepEqual(permitAnswer(booking(LIONS, D2, '2026-10-20', '18:00', '19:30'), [fall], venues), { kind: 'inside' });
  });
  it('outside by day: a Wednesday on Diamond 2 — the line says what it covers', () => {
    const a = permitAnswer(booking(LIONS, D2, '2026-10-21', '18:00', '19:30'), [fall], venues);
    assert.equal(a.kind, 'outside');
    if (a.kind !== 'outside') return;
    assert.equal(a.onFacility, true);
    assert.deepEqual(a.covers, [{ facilityIds: [D2], weekdays: [2, 4], startTime: '17:30', endTime: '21:00' }]);
    assert.equal(a.until, '2026-10-29');
    assert.equal(a.dateOff, null);
  });
  it('outside by hour: a 5:00 p.m. start on a 5:30 block', () => {
    assert.equal(permitAnswer(booking(LIONS, D2, '2026-10-20', '17:00', '18:30'), [fall], venues).kind, 'outside');
  });
  it('partly outside: 8:30–9:30 p.m. on a block to 9:00 is outside (the WHOLE time must be held)', () => {
    assert.equal(permitAnswer(booking(LIONS, D2, '2026-10-22', '20:30', '21:30'), [fall], venues).kind, 'outside');
  });
  it('touching the ends is inside: 5:30–9:00 exactly', () => {
    assert.equal(permitAnswer(booking(LIONS, D2, '2026-10-22', '17:30', '21:00'), [fall], venues).kind, 'inside');
  });
  it('a facility the permit doesn\'t hold at that venue is outside, and the line names the venue\'s blocks', () => {
    const a = permitAnswer(booking(LIONS, D1, '2026-10-20', '18:00', '19:30'), [fall], venues);
    assert.equal(a.kind, 'outside');
    if (a.kind === 'outside') assert.equal(a.onFacility, false);
  });
  it('facility not set: inside when ANY block at the venue holds the time; outside when none does', () => {
    assert.equal(permitAnswer(booking(LIONS, null, '2026-10-20', '18:00', '19:30'), [fall], venues).kind, 'inside');
    const a = permitAnswer(booking(LIONS, null, '2026-10-21', '18:00', '19:30'), [fall], venues);
    assert.equal(a.kind, 'outside');
    if (a.kind === 'outside') assert.equal(a.onFacility, false);
  });
  it('a date off is outside, and the answer names it', () => {
    const a = permitAnswer(booking(LIONS, D2, '2026-10-13', '18:00', '19:30'), [fall], venues);
    assert.equal(a.kind, 'outside');
    if (a.kind === 'outside') assert.deepEqual(a.dateOff, { day: '2026-10-13', note: 'Thanksgiving week' });
  });
  it('two permits at one venue: inside any one is inside', () => {
    const wednesdays: PermitTime = {
      id: 'p-wed', startsOn: '2026-10-01', endsOn: '2026-10-31',
      blocks: [{ id: 'b-w', venueId: LIONS, facilityIds: [D2], weekdays: [3], startTime: '17:00', endTime: '20:00', fromDate: null, untilDate: null }],
      datesOff: [],
    };
    assert.equal(permitAnswer(booking(LIONS, D2, '2026-10-21', '18:00', '19:30'), [fall, wednesdays], venues).kind, 'inside');
    assert.equal(permitAnswer(booking(LIONS, D2, '2026-10-20', '18:00', '19:30'), [fall, wednesdays], venues).kind, 'inside');
  });
  it('a venue the club holds no permit at says nothing', () => {
    assert.deepEqual(permitAnswer(booking(WESTFIELD, null, '2026-10-20', '18:00', '19:30'), [fall], venues), { kind: 'none' });
  });
  it('a date outside the permit\'s dates says nothing (the club holds no permit there THAT day)', () => {
    assert.deepEqual(permitAnswer(booking(LIONS, D2, '2026-11-03', '18:00', '19:30'), [fall], venues), { kind: 'none' });
  });
  it('a club with no permits says nothing', () => {
    assert.deepEqual(permitAnswer(booking(LIONS, D2, '2026-10-21', '18:00', '19:30'), [], venues), { kind: 'none' });
  });
  it('a place that isn\'t one of the club\'s venues says nothing', () => {
    assert.deepEqual(permitAnswer(booking(null, null, '2026-10-21', '18:00', '19:30'), [fall], venues), { kind: 'none' });
  });
  it('across a daylight-saving change: the dome\'s 8:00 a.m. is 8:00 a.m. on both sides of Nov 1 and Mar 14', () => {
    assert.equal(permitAnswer(booking(DOME, FIELDS[0], '2026-10-25', '08:00', '09:30'), [dome], venues).kind, 'inside'); // EDT
    assert.equal(permitAnswer(booking(DOME, FIELDS[0], '2026-11-01', '08:00', '09:30'), [dome], venues).kind, 'inside'); // the change's own Sunday
    assert.equal(permitAnswer(booking(DOME, FIELDS[0], '2026-11-08', '08:00', '09:30'), [dome], venues).kind, 'inside'); // EST
    assert.equal(permitAnswer(booking(DOME, FIELDS[5], '2027-03-14', '09:30', '11:00'), [dome], venues).kind, 'inside'); // back to EDT
    assert.equal(permitAnswer(booking(DOME, FIELDS[0], '2026-11-08', '07:30', '09:00'), [dome], venues).kind, 'outside');
  });
  it('the fixture\'s 11U AA Wednesday at Lions Park, no diamond set: outside, the line names Diamond 2\'s nights', () => {
    const a = permitAnswer(booking(LIONS, null, '2026-10-21', '18:00', '19:30'), [fall], venues);
    assert.equal(a.kind, 'outside');
    if (a.kind === 'outside') assert.deepEqual(a.covers.map(c => c.facilityIds), [[D2]]);
  });
});

const named = (o: Partial<PermitOutside>): PermitOutside => ({
  kind: 'outside', day: '2026-10-21', venueName: 'Lions Park', facilityName: 'Diamond 2', onFacility: true,
  covers: [{ facilities: ['Diamond 2'], weekdays: [2, 4], startTime: '17:30', endTime: '21:00' }],
  until: '2026-10-29', dateOff: null, ...o,
});

describe('the quiet line\'s words (specimen 3)', () => {
  it('says the drawing\'s sentence', () => {
    assert.equal(permitLine(named({}), 'baseball'), 'Outside the club’s permit for Diamond 2. It covers Tue and Thu, 5:30–9:00 p.m., until Oct 29.');
  });
  it('about the venue when the facility isn\'t the permit\'s, naming the facility it covers', () => {
    assert.equal(
      permitLine(named({ facilityName: null, onFacility: false }), 'baseball'),
      'Outside the club’s permit at Lions Park. It covers Diamond 2 on Tue and Thu, 5:30–9:00 p.m., until Oct 29.',
    );
  });
  it('names a date off', () => {
    assert.equal(
      permitLine(named({ dateOff: { day: '2026-10-13', note: 'Thanksgiving week' } }), 'baseball'),
      'Outside the club’s permit for Diamond 2: Oct 13 is a date off (Thanksgiving week).',
    );
  });
  it('the calendar says it once, short — "a permit the club holds" when no facility is set', () => {
    assert.equal(permitCalendarLine(named({ facilityName: null, onFacility: false }), 'baseball'), 'Outside the club’s permit at Lions Park.');
    assert.equal(permitCalendarLine(named({}), 'baseball'), 'Outside the club’s permit for Diamond 2.');
  });
  it('a series counts its dates and says what the permit covers once', () => {
    assert.equal(
      permitSeriesLine([named({}), null, named({ day: '2026-10-28' })], ['2026-10-21', '2026-10-24', '2026-10-28'], 'baseball'),
      '2 of 3 dates are outside the club’s permit for Diamond 2. It covers Tue and Thu, 5:30–9:00 p.m., until Oct 29.',
    );
  });
  it('a run of numbered fields reads as a range', () => {
    assert.equal(facilityListWords(['Field 1', 'Field 2', 'Field 3', 'Field 4', 'Field 5', 'Field 6']), 'Fields 1–6');
    assert.equal(facilityListWords(['Lane 1', 'Lane 2']), 'Lane 1 and Lane 2');
  });
});

describe('what a permit holds and what an hour costs (Ask 21)', () => {
  it('Fall diamonds: 80 h held, 10 h a week, $40.00 an hour held', () => {
    const h = heldTime(fall, venues);
    // The Thanksgiving-week Tuesday is a date off: 15 Diamond 2 nights (3.5 h) and 7 Diamond B Tuesdays (3 h).
    assert.equal(h.heldMinutes / 60, 15 * 3.5 + 7 * 3);
    const noOff = heldTime({ ...fall, datesOff: [] }, venues);
    assert.equal(noOff.heldMinutes / 60, 80);
    assert.equal(noOff.weekMinutes / 60, 10);
    const p = fieldPrices({ ...fall, datesOff: [] }, venues, new Map(), 3200);
    assert.equal(p.fullHour, 40);
    assert.equal(p.allFull, true);
  });
  it('the dome: Fields 1–4 full + 5–6 half, 25 Sundays × 3 h, $27,000.00 → $72.00 a full field, $36.00 a half', () => {
    const h = heldTime(dome, venues);
    assert.equal(h.heldMinutes / 60, 450);
    const shares = new Map([[FIELDS[4], 0.5], [FIELDS[5], 0.5]]);
    const p = fieldPrices(dome, venues, shares, 27000);
    assert.equal(p.fullFieldHours, 375);
    assert.equal(p.fullHour, 72);
    assert.equal(p.hourOf(FIELDS[0]), 72);
    assert.equal(p.hourOf(FIELDS[5]), 36);
    assert.equal(p.allFull, false);
  });
  it('no cost: no price', () => {
    assert.equal(fieldPrices(dome, venues, new Map(), null).fullHour, null);
  });
  it('two blocks holding one place at one time are refused', () => {
    const twice: PermitTime = { ...fall, blocks: [fall.blocks[0], { ...fall.blocks[0], id: 'b-x', weekdays: [4], startTime: '20:00', endTime: '22:00' }] };
    assert.deepEqual(overlappingBlocks(twice, venues), ['b-1', 'b-x']);
    assert.equal(overlappingBlocks(fall, venues), null);
  });
  it('hours read as the drawings say them', () => {
    assert.equal(hoursWords(80 * 60), '80 h');
    assert.equal(hoursWords(51.5 * 60), '51.5 h');
  });
});

describe('the use: Held − Booked = Unused per block, totals = Σ rows, a place counted once', () => {
  const ub = (key: string, owner: string, venueId: string, facilityId: string | null, day: string, from: string, to: string): UseBooking =>
    ({ key, ownerName: owner, ...booking(venueId, facilityId, day, from, to) });
  const bookings: UseBooking[] = [
    ub('a', '14U AA', LIONS, D2, '2026-10-20', '17:30', '19:30'),
    ub('b', '13U AAA', LIONS, D2, '2026-10-20', '18:00', '20:00'),     // overlaps 14U AA: the place counts once
    ub('c', '11U AA', LIONS, null, '2026-10-21', '18:00', '19:30'),    // Wednesday, no diamond: outside
    ub('d', '11U AA', KINSMEN, DB, '2026-10-20', '18:00', '19:30'),
    ub('e', 'Reds', KINSMEN, DB, '2026-10-22', '18:00', '19:30'),      // Thursday on Diamond B: outside (Tuesdays only)
    ub('f', '12U AA', LIONS, D2, '2026-10-22', '20:30', '21:30'),      // half inside, half outside
  ];
  const use = permitUse({ ...fall, datesOff: [] }, bookings, { venueFacilities: venues });

  it('booked per block: the Tuesday 5:30–8:00 once, plus Thursday 8:30–9:00', () => {
    const d2 = use.blocks.find(b => b.blockId === 'b-1')!;
    assert.equal(d2.heldMinutes / 60, 56);
    assert.equal(d2.bookedMinutes / 60, 2.5 + 0.5);
    assert.deepEqual(d2.who, ['14U AA', '13U AAA', '12U AA']);
    const db = use.blocks.find(b => b.blockId === 'b-2')!;
    assert.equal(db.heldMinutes / 60, 24);
    assert.equal(db.bookedMinutes / 60, 1.5);
  });
  it('held − booked = unused for every block, and the totals are the sum of the rows', () => {
    for (const b of use.blocks) assert.ok(b.heldMinutes - b.bookedMinutes >= 0);
    assert.equal(use.totals.heldMinutes, use.blocks.reduce((n, b) => n + b.heldMinutes, 0));
    assert.equal(use.totals.bookedMinutes, use.blocks.reduce((n, b) => n + b.bookedMinutes, 0));
    assert.equal(use.totals.unusedMinutes, use.totals.heldMinutes - use.totals.bookedMinutes);
    assert.equal(use.totals.heldMinutes, use.days.reduce((n, d) => n + d.heldMinutes, 0));
    assert.equal(use.totals.bookedMinutes, use.days.reduce((n, d) => n + d.bookedMinutes, 0));
  });
  it('a booking outside every block counts nowhere in the use, and the use lists none (owner 2026-10-11)', () => {
    // The Wednesday, the Thursday on Diamond B (Tuesdays only) and the half hour past 9:00 are outside the permit: they
    // add no Booked time and no name to a row. A permit never lists them — the booking says so where it is made.
    const db = use.blocks.find(b => b.blockId === 'b-2')!;
    assert.equal(db.who.includes('Reds'), false);
    assert.equal('outside' in use, false);
    assert.deepEqual(Object.keys(use.totals).sort(), ['bookedMinutes', 'heldMinutes', 'unusedMinutes']);
  });
  it('a booking with no diamond set inside a block counts on the block and says so, never past what it holds', () => {
    const u = permitUse({ ...fall, datesOff: [] }, [ub('n', '11U AA', LIONS, null, '2026-10-20', '18:00', '19:30')], { venueFacilities: venues });
    const d2 = u.blocks.find(b => b.blockId === 'b-1')!;
    assert.equal(d2.unplacedMinutes, 90);
    assert.equal(d2.bookedMinutes, 90);
  });
  it('a booking with no field set counts once, however many of the permit\'s blocks hold those hours', () => {
    // The dome held as two blocks at the same hours — Fields 1–3 and Fields 4–6 (/review 10a).
    const split: PermitTime = {
      ...dome, datesOff: [],
      blocks: [
        { ...dome.blocks[0], id: 'b-low', facilityIds: FIELDS.slice(0, 3) },
        { ...dome.blocks[0], id: 'b-high', facilityIds: FIELDS.slice(3) },
      ],
    };
    const u = permitUse(split, [ub('n', '13U AAA', DOME, null, '2026-10-04', '08:00', '10:00')], { venueFacilities: venues });
    assert.equal(u.blocks.reduce((n, b) => n + b.unplacedMinutes, 0), 120);
    assert.equal(u.totals.bookedMinutes, 120);
    // A booking past one block's hours into the next is counted in both parts, once each.
    const later: PermitTime = {
      ...split,
      blocks: [split.blocks[0], { ...split.blocks[1], startTime: '11:00', endTime: '13:00' }],
    };
    const v = permitUse(later, [ub('m', '13U AAA', DOME, null, '2026-10-04', '10:00', '12:00')], { venueFacilities: venues });
    assert.equal(v.totals.bookedMinutes, 120);
  });
});

describe('Renew names next year\'s copy', () => {
  it('a season span moves both ends, keeping its dash', () => {
    assert.equal(renewedName('Dome 2026–27'), 'Dome 2027–28');
    assert.equal(renewedName('Dome 2026-27 winter'), 'Dome 2027-28 winter');
    assert.equal(renewedName('Dome 2099–00'), 'Dome 2100–01');
  });
  it('a single year moves on one', () => {
    assert.equal(renewedName('Fall diamonds 2026'), 'Fall diamonds 2027');
  });
  it('a four-digit span moves both ends; a date in the name moves its year, never its month (/review 10a)', () => {
    assert.equal(renewedName('Fall 2026-2027'), 'Fall 2027-2028');
    assert.equal(renewedName('2026-10-11 dome'), '2027-10-11 dome');
    assert.equal(renewedName('Lions Park 2026-10'), 'Lions Park 2027-10');
  });
  it('a name with no year says so, never a silent duplicate', () => {
    assert.equal(renewedName('Lions Park diamonds'), 'Lions Park diamonds (next year)');
    assert.ok(renewedName('x'.repeat(130)).length <= 120);
  });
});
