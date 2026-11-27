/**
 * Club schedules Stage 2, Session 2C: a field in parts on paper — the PDF's columns and the split rule, the workbook's
 * Facility cell and By field rows (round 2 tab 5, Asks 2 A and 8 A). The drawing's day: Field 1 in four quarters, Field 2
 * in two sides, Fields 3–4 whole, Fields 5–6 whole and priced at half.
 * The no-split case is held to the shipped output by tests/unit/club-schedule-view.test.ts (unchanged).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clubScheduleDocument, scheduleSheets, slotPlaceWords, type DocPlace, type DocSlot, type ScheduleDocInput } from '../../lib/club-schedule-document.ts';
import { partFactor } from '../../lib/field-parts.ts';
import { clubPlaceWords } from '../../lib/club-schedule-words.ts';
import { whereWords } from '../../lib/club-calendar-view.ts';
import { askSundayLine } from '../../lib/club-schedule-view.ts';

const V = 'dome';
const places: DocPlace[] = [{
  venueId: V, venueName: 'Milton Sports Dome',
  facilities: [
    { id: 'f1', name: 'Field 1', sections: 4 }, { id: 'f2', name: 'Field 2', sections: 2 },
    { id: 'f3', name: 'Field 3' }, { id: 'f4', name: 'Field 4' }, { id: 'f5', name: 'Field 5' }, { id: 'f6', name: 'Field 6' },
  ],
}];
const SHARE: Record<string, number> = { f1: 1, f2: 1, f3: 1, f4: 1, f5: 0.5, f6: 0.5 };
const teams = ['7U AA', '7U A', '7U B', '7U C', '9U AA', '9U A', '11U AA', '13U A', '11U B', '15U A', '13U AA', '15U AA']
  .map(name => ({ id: name, name, groupName: null }));

let n = 0;
function slot(day: string, start: string, end: string, facilityId: string, mask: number, teamIds: string[]): DocSlot {
  n++;
  return {
    key: `k${n}`, venueId: V, facilityId, day, weekday: 7, startClock: start, endClock: end,
    startsAt: `${day}T${start}:00Z`, endsAt: `${day}T${end}:00Z`, teamIds, weight: SHARE[facilityId] * partFactor(mask), prime: false,
    heldBy: null, ...(mask ? { sectionMask: mask } : {}),
  };
}

const D1 = '2027-01-17', D2 = '2027-01-24';
const slots: DocSlot[] = [
  // Jan 17: the quarters at 9, Field 1 whole at noon; Field 2's sides at 9, whole at noon; the other four whole.
  slot(D1, '09:00', '10:30', 'f1', 1, ['7U AA']), slot(D1, '09:00', '10:30', 'f1', 2, ['7U A']),
  slot(D1, '09:00', '10:30', 'f1', 4, ['7U B']), slot(D1, '09:00', '10:30', 'f1', 8, ['7U C']),
  slot(D1, '09:00', '10:30', 'f2', 3, ['9U AA']), slot(D1, '09:00', '10:30', 'f2', 12, ['9U A']),
  slot(D1, '09:00', '10:30', 'f3', 0, ['11U AA']), slot(D1, '09:00', '10:30', 'f4', 0, ['13U A']),
  slot(D1, '09:00', '10:30', 'f5', 0, ['11U B']), slot(D1, '09:00', '10:30', 'f6', 0, ['15U A']),
  slot(D1, '12:00', '13:30', 'f1', 0, ['13U AA']), slot(D1, '12:00', '13:30', 'f2', 0, ['15U AA']),
  // Jan 24: the quarters only — Field 1 has no whole-field slot that day.
  slot(D2, '09:00', '10:30', 'f1', 1, ['7U AA']), slot(D2, '09:00', '10:30', 'f1', 2, []),
  slot(D2, '09:00', '10:30', 'f3', 0, ['11U AA']),
];
const input: ScheduleDocInput = {
  name: 'Winter dome', startsOn: '2027-01-03', endsOn: '2027-03-07', places, teams, slots, datesOff: [],
};

describe('the PDF: a column per part, the part on the heading’s second line, no price word (round 2 tab 5)', () => {
  const doc = clubScheduleDocument(input);
  const jan17 = doc.groups[0];
  it('Jan 17 reads every field and every part, the whole field beside its parts', () => {
    assert.deepEqual(jan17.headers, [
      'Time', 'Field 1', 'Field 1\nquarter A', 'Field 1\nquarter B', 'Field 1\nquarter C', 'Field 1\nquarter D',
      'Field 2', 'Field 2\nside A', 'Field 2\nside B', 'Field 3', 'Field 4', 'Field 5 · half', 'Field 6 · half',
    ]);
    assert.ok(!jan17.headers!.some(h => h.includes('%')), 'a quarter never reads "· 25%"');
  });
  it('one side never overwrites the other: each part has its own cell', () => {
    assert.deepEqual(jan17.rows[0], ['9:00–10:30 a.m.', '', '7U AA', '7U A', '7U B', '7U C', '', '9U AA', '9U A', '11U AA', '13U A', '11U B', '15U A']);
    assert.deepEqual(jan17.rows[1], ['12:00–1:30 p.m.', '13U AA', '', '', '', '', '15U AA', '', '', '', '', '', '']);
  });
  it('no whole-field slot on a split field: its whole column is left out; a split field with nothing keeps its plain column; an open part reads Open', () => {
    const jan24 = doc.groups[1];
    assert.deepEqual(jan24.headers, ['Time', 'Field 1\nquarter A', 'Field 1\nquarter B', 'Field 2', 'Field 3', 'Field 4', 'Field 5 · half', 'Field 6 · half']);
    assert.deepEqual(jan24.rows[0], ['9:00–10:30 a.m.', '7U AA', 'Open', '', '11U AA', '', '', '']);
  });
  it('the notes name only the fields priced at half, never a side', () => {
    assert.ok(doc.notes.includes('Field 5 and Field 6 are half fields.'));
    assert.ok(!doc.notes.some(x => /Field [12]/.test(x)));
  });
  it('each field and its parts are one block for the split, the Time column repeated', () => {
    const split = jan17.split!;
    assert.equal(split.lead, 1);
    assert.deepEqual(split.blocks, [[1, 2, 3, 4, 5], [6, 7, 8], [9], [10], [11], [12]]);
    assert.equal(split.labelOf([0, 1]), 'Sun, Jan 17, 2027   ·   8 slots   ·   Milton Sports Dome   ·   Field 1 and Field 2');
    assert.equal(split.labelOf([2, 3, 4, 5]), 'Sun, Jan 17, 2027   ·   4 slots   ·   Milton Sports Dome   ·   Fields 3–6');
  });
});

describe('the workbook: "Field 1, quarter A", priced at its size; By field a row per part', () => {
  const sheets = scheduleSheets({ ...input, pricing: { fullHour: 80, permitCost: null, permitName: 'Winter dome' } });
  it('the Facility cell names the part and no price word; a half-priced field keeps "(half)"', () => {
    const cells = sheets.rows.slice(0, -1).map(r => String(r[4]));
    assert.ok(cells.includes('Field 1, quarter A'));
    assert.ok(cells.includes('Field 2, side B'));
    assert.ok(cells.includes('Field 5 (half)'));
    assert.ok(!cells.some(c => /quarter|side/.test(c) && /\(/.test(c)));
  });
  it('a quarter costs a quarter of the field’s hour and a half: $30.00; a side $60.00; a half field $60.00', () => {
    const cost = (place: string) => sheets.rows.find(r => r[4] === place)![8];
    assert.equal(cost('Field 1, quarter A'), 30);
    assert.equal(cost('Field 2, side A'), 60);
    assert.equal(cost('Field 5 (half)'), 60);
    assert.equal(cost('Field 1'), 120);
  });
  it('By field: Field 1 whole and each quarter, Field 2 whole and each side, four whole fields — 12 rows', () => {
    const byField = sheets.extraSheets.find(s => s.name === 'By field')!;
    assert.equal(byField.rows.length, 12);
    assert.deepEqual(byField.rows.find(r => r[0] === 'Field 1, quarter A')?.slice(1, 3), [2, 3]);
  });
});

describe('a coach’s lines (the review card, a hand-back’s Sundays) and the club calendar say the part', () => {
  const names = {
    venueName: new Map([[V, 'Milton Sports Dome']]),
    facilityName: new Map([['f1', 'Field 1'], ['f2', 'Field 2'], ['f3', 'Field 3']]),
    sectionsOf: new Map([['f1', 4 as const], ['f2', 2 as const]]),
  };
  it('"Field 1, quarter C", "Field 2, side B"; a whole field and a venue with no field exactly as before', () => {
    assert.equal(clubPlaceWords(names, V, 'f1', 4), 'Field 1, quarter C');
    assert.equal(clubPlaceWords(names, V, 'f2', 12), 'Field 2, side B');
    assert.equal(clubPlaceWords(names, V, 'f3', 0), 'Field 3');
    assert.equal(clubPlaceWords(names, V, 'f3'), 'Field 3');
    assert.equal(clubPlaceWords(names, V, null), 'Milton Sports Dome');
  });
  it('the schedule page’s hand-back callout names the side, in the screen’s form', () => {
    const p2 = [{ venueId: V, venueName: 'Dome', facilities: [{ id: 'f1', name: 'Field 1', sections: 2 as const }] }];
    const sunday = { slotId: 's', startsAt: '2027-03-07T14:30:00Z', venueId: V, facilityId: 'f1' };
    assert.ok(askSundayLine({ ...sunday, sectionMask: 12 }, p2).endsWith(' · Field 1, side B'));
    assert.ok(askSundayLine(sunday, p2).endsWith(' · Field 1'));
  });
  it('the calendar: "Lions Park · Diamond 2, side A", never a second " · "; no part, as before', () => {
    const where = { venueId: 'v', venueName: 'Lions Park', facility: 'Diamond 2', address: null, text: null };
    assert.equal(whereWords({ sport: 'baseball', where: { ...where, part: 'side A' } }), 'Lions Park · Diamond 2, side A');
    assert.equal(whereWords({ sport: 'baseball', where }), 'Lions Park · Diamond 2');
  });
});

describe('the calendar file and every place line: the part joins with a comma', () => {
  it('"Field 1, side A"; the whole field and a venue with no field as before', () => {
    const p2: DocPlace[] = [{ venueId: V, venueName: 'Dome', facilities: [{ id: 'f1', name: 'Field 1', sections: 2 }] }];
    assert.equal(slotPlaceWords(p2, { venueId: V, facilityId: 'f1', sectionMask: 3 }), 'Field 1, side A');
    assert.equal(slotPlaceWords(p2, { venueId: V, facilityId: 'f1' }), 'Field 1');
    assert.equal(slotPlaceWords(p2, { venueId: V, facilityId: null }), 'Dome');
  });
});
