import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  billCorrections, billShares, closingRow, correctionInstallments, paymentPeriods, pricedMinutes, sharesAtRate, teamInstallments,
  timeSplits, valuesAfterChanges, type BillSlot,
} from '../../lib/club-schedule-bill.ts';
import { ageOf, cutSlots, makeDraft, type EngineTeam } from '../../lib/club-schedule-engine.ts';
import { defaultSettings } from '../../lib/club-schedule-settings.ts';
import { fieldPrices } from '../../lib/permit-time.ts';

/**
 * BILL THE TEAMS FROM THE SCHEDULE — the dome's own check (Club Tier Stage 11a part A, Ask 23; plan §6a; hub specimen 14
 * step 4). The permit is 10a's seeded Winter dome 2026–27: Fields 1–4 full + 5–6 half, Sundays 8:00–11:00 a.m.,
 * Oct 4, 2026 – Mar 28, 2027, Dec 27 off, $27,000.00 → $72.00 an hour of a full field, $36.00 a half. Senior gets one
 * full field a week (25 slots), Junior one full and one half (50).
 */

const DOME = 'v-dome';
const F = ['f-1', 'f-2', 'f-3', 'f-4', 'f-5', 'f-6'];
const SHARES = new Map([['f-5', 0.5], ['f-6', 0.5]]);
const weightOf = (f: string | null) => (f ? SHARES.get(f) ?? 1 : 1);
const block = { id: 'b1', venueId: DOME, facilityIds: F, weekdays: [7], startTime: '08:00', endTime: '11:00', fromDate: null, untilDate: null };
const permit = { id: 'p', startsOn: '2026-10-04', endsOn: '2027-03-28', blocks: [block], datesOff: [{ day: '2026-12-27', note: 'The dome is closed' }] };
const VF = new Map([[DOME, F]]);

const team = (id: string, name: string, groupId: string): EngineTeam => ({ id, name, groupId, age: ageOf(name) });
const TEAMS = [
  team('t15aaa', '15U AAA', 'S'), team('t15aa', '15U AA', 'S'), team('t16aa', '16U AA', 'S'), team('t14aa', '14U AA', 'S'),
  team('t13aaa', '13U AAA', 'J'), team('t12aa', '12U AA', 'J'), team('t11aa', '11U AA', 'J'), team('t9aa', '9U AA', 'J'),
];
const SENIORS = TEAMS.slice(0, 4).map(t => t.id), JUNIORS = TEAMS.slice(4).map(t => t.id);

const slots = cutSlots(permit, { slotMinutes: 90, changeoverMinutes: 0, prime: null, venueFacilities: VF, weightOf });
const settings = {
  ...defaultSettings(), slotMinutes: 90, teamIds: TEAMS.map(t => t.id),
  split: { method: 'weekly' as const, values: { ...Object.fromEntries(SENIORS.map(t => [t, 1])), ...Object.fromEntries(JUNIORS.map(t => [t, 2])) } },
  rules: { ...defaultSettings().rules, avoidGameDays: false, fieldsBy: [{ facilityIds: ['f-5', 'f-6'], groupIds: ['J'], teamIds: [] }] },
};
const draft = makeDraft({ slots, teams: TEAMS, settings, held: new Map(), teamBookings: new Map(), fixed: new Map() }, 'best');
const billSlots: BillSlot[] = slots.map(s => ({ day: s.day, startMs: s.startMs, endMs: s.endMs, weight: s.weight, teamIds: draft.assignments.get(s.key) ?? [] }));
const prices = fieldPrices(permit, VF, SHARES, 27000);

describe('the dome: the permit prices its fields (10a\'s fieldPrices)', () => {
  it('$27,000.00 over 375 full-field hours: $72.00 a full field, $36.00 a half', () => {
    assert.equal(prices.fullFieldHours, 375);
    assert.equal(prices.fullHour, 72);
    assert.equal(prices.hourOf('f-5'), 36);
  });
});

describe('the dome: by the time each team got (Ask 23)', () => {
  const priced = pricedMinutes(billSlots);
  const bill = billShares(priced, { fullHour: prices.fullHour, amount: null, teamOrder: TEAMS.map(t => t.id) })!;
  it('Senior $2,700.00 each, Junior $4,050.00 each; 4 × 2,700 + 4 × 4,050 = 27,000', () => {
    for (const id of SENIORS) assert.equal(bill.shares.get(id), 270000, id);
    for (const id of JUNIORS) assert.equal(bill.shares.get(id), 405000, id);
    assert.equal(bill.totalCents, 2700000);
    assert.equal(bill.timePriceCents, 2700000);
    assert.equal([...bill.shares.values()].reduce((a, b) => a + b, 0), bill.totalCents, 'the closing row is the bill, to the cent');
  });
  it('the closing row matches the permit\'s $27,000.00: nothing left for the club to cover', () => {
    assert.deepEqual(closingRow(bill.totalCents, 27000), { kind: 'matches', permitCents: 2700000 });
  });
  it('the rate it was billed at: $72.00 an hour of a full field = 120 cents a minute', () => {
    assert.equal(bill.rate, 120);
  });
  it('a part of the cost (the club covers $2,000.00) scales every team alike, to the cent', () => {
    const part = billShares(priced, { fullHour: prices.fullHour, amount: 25000, teamOrder: TEAMS.map(t => t.id) })!;
    assert.equal(part.totalCents, 2500000);
    assert.equal([...part.shares.values()].reduce((a, b) => a + b, 0), 2500000);
    const senior = part.shares.get('t15aaa')!, junior = part.shares.get('t13aaa')!;
    assert.ok(Math.abs(senior / junior - 2 / 3) < 0.0001, 'a Senior share stays two-thirds of a Junior one');
    assert.deepEqual(closingRow(part.totalCents, 27000), { kind: 'club_covers', permitCents: 2700000, differenceCents: 200000 });
  });
  it('without a permit to price it, the amount typed is shared by priced time', () => {
    const typed = billShares(priced, { fullHour: null, amount: 900, teamOrder: TEAMS.map(t => t.id) })!;
    assert.equal(typed.timePriceCents, null);
    assert.equal(typed.totalCents, 90000);
    assert.equal(billShares(priced, { fullHour: null, amount: null }), null, 'nothing to bill without a price or an amount');
  });
});

describe('the dome: payments that follow the time (Ask 23)', () => {
  const periods = paymentPeriods('two_months', { firstDue: '2026-10-01', dates: null, lastDay: '2027-03-28' });
  const priced = pricedMinutes(billSlots);
  const bill = billShares(priced, { fullHour: prices.fullHour, amount: null, teamOrder: TEAMS.map(t => t.id) })!;
  it('every two months from Oct 1: Oct 1, Dec 1, Feb 1', () => {
    assert.deepEqual(periods.map(p => p.due), ['2026-10-01', '2026-12-01', '2027-02-01']);
  });
  it('9 / 8 / 8 Sundays → Senior $972.00 / $864.00 / $864.00', () => {
    assert.deepEqual(teamInstallments('t15aaa', bill.shares.get('t15aaa')!, billSlots, periods), [
      { installmentNumber: 1, amount: 972, dueDate: '2026-10-01' },
      { installmentNumber: 2, amount: 864, dueDate: '2026-12-01' },
      { installmentNumber: 3, amount: 864, dueDate: '2027-02-01' },
    ]);
  });
  it('… and Junior $1,458.00 / $1,296.00 / $1,296.00', () => {
    assert.deepEqual(teamInstallments('t13aaa', bill.shares.get('t13aaa')!, billSlots, periods).map(i => i.amount), [1458, 1296, 1296]);
  });
  it('the splits for the one step: split value = priced hours, each team its own payments, every figure adds up', () => {
    const seasons = new Map(TEAMS.map(t => [t.id, `season-${t.id}`]));
    const splits = timeSplits({ slots: billSlots, shares: bill, periods, seasons, priced });
    assert.equal(splits.length, 8);
    const senior = splits.find(s => s.teamId === 't15aaa')!;
    assert.equal(senior.splitValue, 37.5);
    assert.equal(senior.programYearId, 'season-t15aaa');
    assert.equal(senior.paymentSchedule, 'custom');
    assert.equal(splits.find(s => s.teamId === 't13aaa')!.splitValue, 56.25, '25 full + 25 half × 1.5 h');
    for (const s of splits) {
      const sum = s.installments.reduce((n, i) => n + Math.round(i.amount * 100), 0);
      assert.equal(sum, Math.round(s.amount * 100), s.teamId);
    }
    assert.equal(splits.reduce((n, s) => n + Math.round(s.amount * 100), 0), 2700000);
  });
  it('monthly from Oct 1 runs to March; one payment is one; dates the club chooses', () => {
    assert.equal(paymentPeriods('monthly', { firstDue: '2026-10-01', dates: null, lastDay: '2027-03-28' }).length, 6);
    assert.deepEqual(paymentPeriods('one', { firstDue: '2026-09-15', dates: null, lastDay: '2027-03-28' }).map(p => p.due), ['2026-09-15']);
    const chosen = paymentPeriods('dates', { firstDue: null, dates: ['2027-01-15', '2026-10-01'], lastDay: '2027-03-28' });
    assert.deepEqual(chosen.map(p => [p.due, p.from, p.until]), [['2026-10-01', '0000-01-01', '2027-01-15'], ['2027-01-15', '2027-01-15', null]]);
    const two = teamInstallments('t15aaa', bill.shares.get('t15aaa')!, billSlots, chosen);
    assert.deepEqual(two.map(i => i.amount), [1512, 1188], '14 Sundays before Jan 15 (Dec 27 off), 11 after');
  });
});

describe('a change after Finalize (build question B)', () => {
  const priced = pricedMinutes(billSlots);
  const before = Object.fromEntries(sharesAtRate(priced, 120));
  it('at the first bill\'s rate, nothing changed is no correction', () => {
    const now = sharesAtRate(priced, 120);
    const c = billCorrections(before, now);
    assert.equal(c.gains.size + c.losses.size, 0);
    assert.equal(now.get('t15aaa'), 270000);
  });
  it('13U AAA hands back a full-field Sunday and 16U AA gains it: $108.00 billed to one, $108.00 owed to the other', () => {
    const gained = billSlots.find(s => s.teamIds.includes('t13aaa') && s.weight === 1)!;
    const moved = billSlots.map(s => (s === gained ? { ...s, teamIds: ['t16aa'] } : s));
    // 16U AA plays 8:00; the gained slot is 9:30 — not twice at once.
    const now = sharesAtRate(pricedMinutes(moved), 120);
    const c = billCorrections(before, now);
    assert.deepEqual([...c.gains], [['t16aa', 10800]]);
    assert.deepEqual([...c.losses], [['t13aaa', 10800]]);
  });
  it('a hand-back left open: the team is owed back, nobody gains, the club carries the slot', () => {
    const open = billSlots.find(s => s.teamIds.includes('t15aaa'))!;
    const now = sharesAtRate(pricedMinutes(billSlots.map(s => (s === open ? { ...s, teamIds: [] } : s))), 120);
    const c = billCorrections(before, now);
    assert.deepEqual([...c.losses], [['t15aaa', 10800]]);
    assert.equal(c.gains.size, 0);
  });
  it('a rounding cent never bills a team whose time didn\'t change (/review 2026-10-11)', () => {
    // Three teams with the same time and $100.00 between them: the first bill (club order C, A, B) gives C the extra cent.
    const three: BillSlot[] = ['A', 'B', 'C'].map((t, i) => ({ day: '2026-10-04', startMs: i * 5_400_000, endMs: (i + 1) * 5_400_000, weight: 1, teamIds: [t] }));
    const first = billShares(pricedMinutes(three), { fullHour: null, amount: 100, teamOrder: ['C', 'A', 'B'] })!;
    assert.deepEqual([...first.shares], [['C', 3334], ['A', 3333], ['B', 3333]]);
    const baseline = Object.fromEntries(first.shares);
    // Shared again in the slots' order the cent moves to A — billing A a cent and owing C one, though nothing changed.
    const reshared = sharesAtRate(pricedMinutes(three), first.rate);
    assert.equal(billCorrections(baseline, reshared).gains.get('A'), 1);
    // In the club's order, and measuring only the teams the changes touch: nothing.
    const atRate = sharesAtRate(pricedMinutes(three), first.rate, ['C', 'A', 'B']);
    const none = billCorrections(baseline, valuesAfterChanges(baseline, atRate, new Set()));
    assert.equal(none.gains.size + none.losses.size, 0);
    // A gains a slot: only A is billed; B and C keep their values to the cent.
    const more = [...three, { day: '2026-10-11', startMs: 9e9, endMs: 9e9 + 5_400_000, weight: 1, teamIds: ['A'] }];
    const after = valuesAfterChanges(baseline, sharesAtRate(pricedMinutes(more), first.rate, ['C', 'A', 'B']), new Set(['A']));
    const c = billCorrections(baseline, after);
    assert.deepEqual([...c.gains.keys()], ['A']);
    assert.equal(c.losses.size, 0);
    assert.equal(after.get('B'), 3333);
    assert.equal(after.get('C'), 3334);
  });
  it('a correction\'s payments follow the gained slots; one already due is due today', () => {
    const periods = paymentPeriods('two_months', { firstDue: '2026-10-01', dates: null, lastDay: '2027-03-28' });
    const feb = billSlots.find(s => s.day === '2027-02-07' && s.teamIds.length)!;
    const gained = [{ ...feb, teamIds: ['t16aa'] }];
    assert.deepEqual(correctionInstallments(10800, 't16aa', gained, periods, '2026-11-20'), [{ installmentNumber: 1, amount: 108, dueDate: '2027-02-01' }]);
    const nov = { ...billSlots.find(s => s.day === '2026-11-22' && s.teamIds.length)!, teamIds: ['t16aa'] };
    assert.deepEqual(correctionInstallments(10800, 't16aa', [nov], periods, '2026-11-20'), [{ installmentNumber: 1, amount: 108, dueDate: '2026-11-20' }], 'its period is already due: today');
    assert.deepEqual(correctionInstallments(10800, 't16aa', [], periods, '2026-11-20'), [{ installmentNumber: 1, amount: 108, dueDate: '2026-12-01' }], 'nothing to place it by: the next payment day');
  });
});
