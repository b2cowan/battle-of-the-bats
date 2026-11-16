import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { freeTime, type FreeFilters, type FreeInput, type FreePermit, type TakenTime } from '../../lib/permit-free-time.ts';
import { rowsFromFound } from '../../lib/club-schedule-permit-rows.ts';
import { windowOn, type BookingPlace, type TimeBlock } from '../../lib/permit-time.ts';

/**
 * FIND THE TIME (a schedule on several permits, Session D; drawing tab 2): free = held − booked − held by a draft, as
 * ARITHMETIC. The fixture, spring 2027 (Mar 1 is a Monday):
 *   Kinsmen Park — Diamonds A and B. Lions Park — Field 1. The gym — a venue with no facilities.
 *   Milton spring (Town of Milton, recorded Dec 1): Mar 1 – Apr 30, Kinsmen (every facility) Tue & Thu 6–8 p.m., Diamond A
 *     Sat 9 a.m.–1 p.m.; Thu Apr 1 off.
 *   Milton June (Town of Milton, recorded May 10 — the newer): Apr 20 – Jun 30, Diamond A Tue & Thu 6–8 p.m.
 *   Lions (Halton Hills): Mar 1 – Apr 30, Field 1 Tue 6–9 p.m. and Thu 8–10 p.m.
 *   Booked: tryouts on Diamond A Tue Mar 2, 6–8 p.m.; a booking at Kinsmen with no facility set Thu Mar 4, 6:00–7:30 p.m.
 *   Held by a draft: Diamond B's Thursdays Apr 8 – Apr 29, 6–8 p.m. ("Spring house league 2027").
 */
const KIN = 'kinsmen', LIONS = 'lions', GYM = 'gym', KA = 'diamond-a', KB = 'diamond-b', F1 = 'field-1';
const SPRING = 'milton-spring', JUNE = 'milton-june', HH = 'halton-lions';
const HL = 'Spring house league 2027';

const block = (o: Partial<TimeBlock> & Pick<TimeBlock, 'id' | 'venueId'>): TimeBlock => ({
  facilityIds: [], weekdays: [2, 4], startTime: '18:00', endTime: '20:00', fromDate: null, untilDate: null, ...o,
});
const permits: FreePermit[] = [
  {
    id: SPRING, name: 'Milton spring 2027', issuer: 'Town of Milton', createdAt: '2026-12-01T00:00:00Z', startsOn: '2027-03-01', endsOn: '2027-04-30',
    blocks: [block({ id: 's1', venueId: KIN }), block({ id: 's2', venueId: KIN, facilityIds: [KA], weekdays: [6], startTime: '09:00', endTime: '13:00' })],
    datesOff: [{ day: '2027-04-01', note: 'Easter' }],
  },
  {
    id: JUNE, name: 'Milton June 2027', issuer: 'Town of Milton', createdAt: '2027-05-10T00:00:00Z', startsOn: '2027-04-20', endsOn: '2027-06-30',
    blocks: [block({ id: 'j1', venueId: KIN, facilityIds: [KA] })], datesOff: [],
  },
  {
    id: HH, name: 'Halton Hills spring', issuer: 'Town of Halton Hills', createdAt: '2026-12-02T00:00:00Z', startsOn: '2027-03-01', endsOn: '2027-04-30',
    blocks: [
      block({ id: 'h1', venueId: LIONS, facilityIds: [F1], weekdays: [2], startTime: '18:00', endTime: '21:00' }),
      block({ id: 'h2', venueId: LIONS, facilityIds: [F1], weekdays: [4], startTime: '20:00', endTime: '22:00' }),
    ],
    datesOff: [],
  },
];
const at = (day: string, startTime: string, endTime: string) => windowOn(day, { startTime, endTime });
const booking = (venueId: string, facilityId: string | null, day: string, s: string, e: string): BookingPlace => ({ venueId, facilityId, ...at(day, s, e) });
const thursdaysApr = ['2027-04-08', '2027-04-15', '2027-04-22', '2027-04-29'];
const input = (extra: Partial<FreeInput> = {}): FreeInput => ({
  permits,
  venueFacilities: new Map([[KIN, [KA, KB]], [LIONS, [F1]], [GYM, []]]),
  kindOf: u => (u === KA || u === KB ? 'diamond' : u === F1 ? 'field' : null),
  booked: [booking(KIN, KA, '2027-03-02', '18:00', '20:00'), booking(KIN, null, '2027-03-04', '18:00', '19:30')],
  drafts: thursdaysApr.map((d): TakenTime => ({ ...booking(KIN, KB, d, '18:00', '20:00'), by: HL })),
  ...extra,
});
const filters = (o: Partial<FreeFilters> = {}): FreeFilters => ({
  from: '2027-03-01', to: '2027-04-30', weekdays: [], hours: [], kinds: [], venueIds: [], issuers: [], minMinutes: 60, ...o,
});
const owner = { weekdays: [2, 4], hours: [{ start: '18:00', end: '20:00' }] };
const rowOf = (r: ReturnType<typeof freeTime>, unit: string | null, venueId?: string) =>
  r.rows.find(x => x.unit === unit && (!venueId || x.venueId === venueId));

describe('freeTime — held minus taken', () => {
  it('counts each place’s evenings: the permit’s days, less its date off, less what is booked (the owner’s example)', () => {
    const r = freeTime(input(), filters({ ...owner, kinds: ['diamond'] }));
    assert.deepEqual(r.rows.map(x => x.unit), [KA, KB], 'diamonds only, in the club’s order');
    const a = rowOf(r, KA)!;
    // Tue & Thu Mar 2 – Apr 29 are 18 evenings; Thu Apr 1 is off → 17 held. Mar 2 is the tryout; Mar 4 has 30 minutes left.
    assert.equal(a.heldDays, 17);
    assert.equal(a.freeDays, 15);
    assert.equal(a.draftDays, 0);
    assert.equal(a.freeMinutes, 15 * 120);
    assert.equal(a.evening, true);
    assert.deepEqual(a.patterns, [{ weekdays: [2, 4], startTime: '18:00', endTime: '20:00' }]);
  });

  it('a booking with no facility set takes the whole venue that hour — never offered as free', () => {
    const b = rowOf(freeTime(input(), filters({ ...owner, kinds: ['diamond'] })), KB)!;
    assert.equal(b.heldDays, 17);
    // Mar 2's tryout is on Diamond A only, so B is free that evening; Mar 4 is not.
    assert.equal(b.freeDays + b.draftDays, 16);
  });

  it('time a draft holds is not free, and says whose (P7 A)', () => {
    const b = rowOf(freeTime(input(), filters({ ...owner, kinds: ['diamond'] })), KB)!;
    assert.equal(b.draftDays, 4);
    assert.equal(b.freeDays, 12);
    assert.deepEqual(b.draftBy, [HL]);
    assert.equal(b.freeMinutes, 12 * 120, 'a draft’s evenings add no free minutes');
  });

  it('the same day on two permits is listed once, under both, priced to start by the newer (P4 A)', () => {
    const a = rowOf(freeTime(input(), filters({ ...owner, kinds: ['diamond'] })), KA)!;
    assert.deepEqual(a.permitIds, [SPRING, JUNE]);
    assert.deepEqual(a.shared, ['2027-04-20', '2027-04-22', '2027-04-27', '2027-04-29']);
    assert.equal(a.pricedBy, JUNE);
    assert.equal(a.heldDays, 17, 'held once, not twice');
  });

  it('hours cut a block to the range asked for; a block outside it goes', () => {
    const f = rowOf(freeTime(input(), filters(owner)), F1)!;
    // Tuesdays 6–9 p.m. cut to 6–8; Thursdays 8–10 p.m. are outside 6–8 and go.
    assert.deepEqual(f.patterns, [{ weekdays: [2], startTime: '18:00', endTime: '20:00' }]);
    assert.equal(f.heldDays, 9);
    assert.equal(f.freeMinutes, 9 * 120);
  });

  it('several hour ranges are any of them', () => {
    const f = rowOf(freeTime(input(), filters({ weekdays: [2, 4], hours: [{ start: '18:00', end: '20:00' }, { start: '20:00', end: '22:00' }] })), F1)!;
    assert.deepEqual(f.patterns.map(p => [p.weekdays, p.startTime, p.endTime]), [[[2], '18:00', '20:00'], [[2], '20:00', '21:00'], [[4], '20:00', '22:00']]);
    assert.equal(f.heldDays, 9 + 9, 'each Tuesday once (two pieces, one day), and the Thursdays Mar 4 – Apr 29');
  });

  it('the shortest useful block decides whether a day counts, and which minutes are free', () => {
    const extra = { booked: [booking(KIN, KA, '2027-03-09', '18:00', '19:00')] };
    const sixty = rowOf(freeTime(input(extra), filters({ ...owner, kinds: ['diamond'] })), KA)!;
    const ninety = rowOf(freeTime(input(extra), filters({ ...owner, kinds: ['diamond'], minMinutes: 90 })), KA)!;
    // Only Mar 9's booking here (an hour of the evening): it keeps an hour, so it counts at 60 and not at 90.
    assert.equal(sixty.freeDays, 17);
    assert.equal(sixty.freeMinutes, 16 * 120 + 60);
    assert.equal(ninety.freeDays, 16);
    assert.equal(ninety.freeMinutes, 16 * 120);
  });

  it('a day off on the permit is never held; days, kinds, venues and towns narrow the list', () => {
    // Thu Apr 1 is Milton spring's day off (and Milton June starts Apr 20): only Lions' Thursday is held that day.
    assert.deepEqual(freeTime(input(), filters({ from: '2027-04-01', to: '2027-04-01' })).rows.map(x => x.unit), [F1]);
    const a = rowOf(freeTime(input(), filters()), KA)!;
    assert.deepEqual(a.patterns.map(p => p.weekdays), [[2, 4], [6]]);
    assert.equal(a.evening, false, 'Saturday mornings are days, not evenings');
    assert.deepEqual(freeTime(input(), filters({ venueIds: [LIONS] })).rows.map(x => x.unit), [F1]);
    assert.deepEqual(freeTime(input(), filters({ issuers: ['Town of Halton Hills'] })).rows.map(x => x.unit), [F1]);
    assert.deepEqual(freeTime(input(), filters({ weekdays: [6] })).rows.map(x => x.unit), [KA]);
  });

  it('nothing found says why: the days the permits do hold, or that no permit meets the dates', () => {
    const none = freeTime(input(), filters({ weekdays: [5, 7] }));
    assert.equal(none.rows.length, 0);
    assert.deepEqual(none.heldWeekdays, [2, 4, 6]);
    assert.equal(none.permitsInDates, 3);
    assert.equal(freeTime(input(), filters({ from: '2028-01-01', to: '2028-03-31' })).permitsInDates, 0);
    assert.deepEqual(none.kinds, ['diamond', 'field']);
    assert.deepEqual(none.issuers, ['Town of Halton Hills', 'Town of Milton']);
  });

  it('a venue with no facilities is one place, taken by any booking there', () => {
    const gym: FreePermit = {
      id: 'gym-permit', name: 'School gym', issuer: null, createdAt: null, startsOn: '2027-03-01', endsOn: '2027-03-31',
      blocks: [block({ id: 'g1', venueId: GYM, weekdays: [1], startTime: '19:00', endTime: '21:00' })], datesOff: [],
    };
    const r = freeTime(input({ permits: [...permits, gym], booked: [booking(GYM, null, '2027-03-01', '19:00', '21:00')] }), filters({ venueIds: [GYM] }));
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].unit, null);
    assert.equal(r.rows[0].heldDays, 5);
    assert.equal(r.rows[0].freeDays, 4);
  });
});

describe('rowsFromFound — picked places become rows that remember their permit', () => {
  it('the chosen permit prices the shared days; the other permit’s row loses exactly those (P4 A)', () => {
    const r = freeTime(input(), filters({ ...owner, kinds: ['diamond'] }));
    const a = rowOf(r, KA)!;
    const june = rowsFromFound([a], () => JUNE);
    const springRow = june.find(x => x.permitId === SPRING)!;
    const juneRow = june.find(x => x.permitId === JUNE)!;
    assert.equal(springRow.fromDate, '2027-03-09', 'the first evening that counts: Mar 2 and Mar 4 are booked');
    assert.equal(springRow.untilDate, '2027-04-19');
    assert.deepEqual([juneRow.fromDate, juneRow.untilDate], ['2027-04-20', '2027-04-29']);
    const spring = rowsFromFound([a], () => SPRING);
    assert.equal(spring.find(x => x.permitId === SPRING)!.untilDate, '2027-04-29');
    assert.ok(!spring.some(x => x.permitId === JUNE), 'June held only the shared days here, so nothing of it is left');
  });

  it('the days a draft holds come in, said per facility (P7b A)', () => {
    const r = freeTime(input(), filters({ ...owner, kinds: ['diamond'] }));
    const b = rowsFromFound([rowOf(r, KB)!], () => null);
    assert.equal(b.length, 1);
    assert.deepEqual(b[0].draftDays, thursdaysApr.map(day => ({ facilityId: KB, day })));
    assert.deepEqual(b[0].draftBy, [HL]);
  });

  it('one stretch on one permit and the same dates at two facilities is one row over both', () => {
    const r = freeTime(input({ booked: [] }), filters({ ...owner, kinds: ['diamond'], from: '2027-03-08', to: '2027-04-16' }));
    const rows = rowsFromFound([rowOf(r, KA)!, rowOf(r, KB)!], () => null);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].facilityIds, [KA, KB]);
    assert.deepEqual([rows[0].fromDate, rows[0].untilDate, rows[0].permitId], ['2027-03-09', '2027-04-15', SPRING]);
    assert.deepEqual(rows[0].draftDays, [{ facilityId: KB, day: '2027-04-08' }, { facilityId: KB, day: '2027-04-15' }]);
  });
});

describe('freeTime — hour ranges that overlap', () => {
  it('two overlapping ranges are one range: the pieces a pick brings never overlap', () => {
    const r = freeTime(input(), filters({ weekdays: [2], kinds: ['diamond'], hours: [{ start: '18:00', end: '19:30' }, { start: '19:00', end: '20:00' }] }));
    const a = rowOf(r, KA)!;
    assert.deepEqual(a.patterns, [{ weekdays: [2], startTime: '18:00', endTime: '20:00' }], 'one stretch, not 6–7:30 and 7–8');
    const times = a.pieces.map(p => `${p.startTime}-${p.endTime}`);
    assert.deepEqual([...new Set(times)], ['18:00-20:00']);
  });
});

describe('the free-time module stands on its own (plan §8 Phase 4; P12: the Permits page’s later view is a door on it)', () => {
  it('imports only the pure permit-time rule — no component, no React, no database, nothing of New schedule', () => {
    const src = readFileSync(new URL('../../lib/permit-free-time.ts', import.meta.url), 'utf8');
    // Every way to bring code in — any quote, a side-effect import, a dynamic import(), a require() — not only `from '…'`.
    const brought = [...src.matchAll(/(?:from\s+|import\s*\(?\s*|require\s*\(\s*)(['"`])([^'"`]+)\1/g)].map(m => m[2]);
    assert.deepEqual(brought, ['./permit-time']);
  });
});
