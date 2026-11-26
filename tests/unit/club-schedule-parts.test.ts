import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ageOf, cutSlots, generateDrafts, heldSlots, makeDraft, planMove, seatCounts, shareTargets, slotKeyOf, slotWeight, teamSlotSize, teamTwice,
  type EngineInput, type EngineTeam, type PoolBooking, type ScheduleBlock, type Slot,
} from '../../lib/club-schedule-engine.ts';
import { defaultSettings, type ScheduleSettings } from '../../lib/club-schedule-settings.ts';
import { billShares, pricedMinutes } from '../../lib/club-schedule-bill.ts';
import { partsOverlap } from '../../lib/field-parts.ts';
import { zonedWallClockToUtc } from '../../lib/timezone.ts';

/**
 * A FIELD IN PARTS, THROUGH THE BUILDER (Club schedules Stage 2, Session 2B — plan SCHEDULE_FIELDS_SAME_TIME_TRADES_PLAN.md;
 * drawing SCHEDULE_HALVES_SAME_TIME_DRAWINGS.html). The two pictures the owner ruled on, by their own numbers:
 *   · round 1 Ask 2 A — Field 1 in two sides for two 9U teams, Field 2 whole for two 15U teams, 30 starts each, Evenly,
 *     $120.00 a whole-field slot: every team $1,800.00, nothing open, $7,200.00 billed;
 *   · round 2 Ask 3 A — Field 1 in four quarters for four 7U teams, Field 2 whole for two 15U teams: under Evenly each 7U
 *     team is 10 quarters short ("30 of 40") and 10 Field 2 slots stay open, $6,000.00 of $7,200.00; By percentage fills it.
 * Then the guards: the cut never puts two slots on overlapping ground, a hand move never does either, and a schedule with
 * no split field cuts and keys exactly as before.
 */

const DOME = 'v-dome', F1 = 'f-1', F2 = 'f-2';
const VF = new Map([[DOME, [F1, F2]]]);
const team = (id: string, name: string): EngineTeam => ({ id, name, groupId: null, age: ageOf(name) });
const instant = (day: string, time: string) => Date.parse(zonedWallClockToUtc(day, time)!);

/** 3 starts (9:00, 10:30, 12:00) × 10 Sundays, Jan 3 – Mar 7, 2027 — the drawing's dome. */
const sundays = (parts: Record<string, number[]>): { startsOn: string; endsOn: string; blocks: ScheduleBlock[]; datesOff: [] } => ({
  startsOn: '2027-01-03', endsOn: '2027-03-07', datesOff: [],
  blocks: [{ id: 'b1', venueId: DOME, facilityIds: [F1, F2], parts, weekdays: [7], startTime: '09:00', endTime: '13:30', fromDate: null, untilDate: null }],
});

function settingsFor(teamIds: string[], fieldsBy: ScheduleSettings['rules']['fieldsBy'], split: ScheduleSettings['split']): ScheduleSettings {
  const base = defaultSettings();
  return { ...base, slotMinutes: 90, teamIds, split, rules: { ...base.rules, avoidGameDays: false, maxPerDay: null, fieldsBy } };
}

function inputFor(parts: Record<string, number[]>, teams: EngineTeam[], fieldsBy: ScheduleSettings['rules']['fieldsBy'], split: ScheduleSettings['split']): EngineInput {
  const s = settingsFor(teams.map(t => t.id), fieldsBy, split);
  const slots = cutSlots(sundays(parts), { slotMinutes: 90, changeoverMinutes: 0, prime: null, venueFacilities: VF });
  return { slots, teams, settings: s, held: new Map(), teamBookings: new Map(), fixed: new Map() };
}

/** The bill at $80.00 a full-field hour ($120.00 a 90-minute whole-field slot), each team's cents. */
function billOf(input: EngineInput, assignments: ReadonlyMap<string, readonly string[]>) {
  const billSlots = input.slots.map(s => ({ day: s.day, startMs: s.startMs, endMs: s.endMs, weight: s.weight, teamIds: assignments.get(s.key) ?? [] }));
  return billShares(pricedMinutes(billSlots), { fullHour: 80, amount: null })!;
}

function noOverlappingGround(slots: readonly Slot[]): void {
  for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
    const a = slots[i], b = slots[j];
    if (a.venueId !== b.venueId || a.facilityId !== b.facilityId || !(a.startMs < b.endMs && b.startMs < a.endMs)) continue;
    assert.ok(!partsOverlap(a.sectionMask, b.sectionMask), `${a.key} and ${b.key} stand on the same ground at once`);
  }
}

describe('the cut: a field named in parts is cut once per part', () => {
  it('two sides and a whole field: 3 places × 3 starts × 10 Sundays = 90 slots', () => {
    const slots = cutSlots(sundays({ [F1]: [3, 12] }), { slotMinutes: 90, changeoverMinutes: 0, prime: null, venueFacilities: VF });
    assert.equal(slots.length, 90);
    assert.equal(slots.filter(s => s.facilityId === F1).length, 60);
    assert.deepEqual([...new Set(slots.filter(s => s.facilityId === F1).map(s => s.sectionMask))].sort(), [12, 3].sort());
    // A part's key and place in the week carry the part; the whole field's keep the shape they always had.
    const side = slots.find(s => s.sectionMask === 3)!;
    assert.equal(side.key, `${DOME}|${F1}|${side.startMs}|3`);
    const whole = slots.find(s => s.facilityId === F2)!;
    assert.equal(whole.key, `${DOME}|${F2}|${whole.startMs}`);
    assert.equal(whole.key, slotKeyOf(DOME, F2, whole.startMs));
    assert.equal(side.weight, 0.5, 'a side of a full field weighs half');
    assert.equal(whole.weight, 1);
    noOverlappingGround(slots);
  });
  it('quarters A–B, C and D: three places on the field at each start, never on overlapping ground', () => {
    const slots = cutSlots(sundays({ [F1]: [3, 4, 8] }), { slotMinutes: 90, changeoverMinutes: 0, prime: null, venueFacilities: VF });
    assert.equal(slots.filter(s => s.facilityId === F1).length, 90);
    assert.deepEqual(slots.filter(s => s.facilityId === F1 && s.day === '2027-01-03' && s.startClock === '09:00').map(s => s.sectionMask), [3, 4, 8]);
    noOverlappingGround(slots);
  });
  it('a row that names a field whole and in parts at once is cut whole first, and the part over it is never cut', () => {
    // The tick list and the database both refuse this row; the cut still never puts two slots on one piece of ground.
    const slots = cutSlots(sundays({ [F1]: [0, 3] }), { slotMinutes: 90, changeoverMinutes: 0, prime: null, venueFacilities: VF });
    assert.equal(slots.filter(s => s.facilityId === F1).length, 30);
    noOverlappingGround(slots);
  });
  it('two rows over one field at once (a whole and a side): the second row’s overlapping parts are never cut', () => {
    const time = sundays({});
    time.blocks.push({ ...time.blocks[0], id: 'b2', facilityIds: [F1], parts: { [F1]: [12] } });
    const slots = cutSlots(time, { slotMinutes: 90, changeoverMinutes: 0, prime: null, venueFacilities: VF });
    noOverlappingGround(slots);
  });
  it('the weight: the field’s share × how much of it the part holds', () => {
    const half = (f: string | null) => (f === F1 ? 0.5 : 1);
    assert.equal(slotWeight(half, F1, 0, null), 0.5, '"Half cost", whole');
    assert.equal(slotWeight(half, F1, 1, null), 0.125, 'a quarter of a "Half cost" field');
    assert.equal(slotWeight(half, F2, 12, null), 0.5, 'a side of a full field');
    assert.equal(slotWeight(half, F2, 4, null), 0.25, 'a quarter of a full field');
  });
});

describe('what the books already hold: a booking on a part holds that part and the whole field, not the other side', () => {
  const slots = cutSlots(sundays({ [F1]: [3, 12] }), { slotMinutes: 90, changeoverMinutes: 0, prime: null, venueFacilities: VF });
  const at = instant('2027-01-03', '09:00');
  const booking = (sectionMask: number): PoolBooking => ({ key: 'e', venueId: DOME, facilityId: F1, sectionMask, startMs: at, endMs: at + 90 * 60_000, ownerName: '11U AA', kind: 'practice' });
  it('side A booked: side A’s slot is held, side B’s is free', () => {
    const held = heldSlots(slots, [booking(3)]);
    assert.deepEqual([...held.keys()].map(k => slots.find(s => s.key === k)!.sectionMask), [3]);
  });
  it('the whole field booked: both sides are held', () => {
    assert.equal(heldSlots(slots, [booking(0)]).size, 2);
  });
});

describe('round 1 Ask 2 A: sides beside a whole field, Evenly — every team $1,800.00, nothing open, $7,200.00', () => {
  const teams = [team('t9a', '9U AA'), team('t9b', '9U A'), team('t15a', '15U AA'), team('t15b', '15U A')];
  const fieldsBy = [{ facilityIds: [F1], groupIds: [], teamIds: ['t9a', 't9b'] }, { facilityIds: [F2], groupIds: [], teamIds: ['t15a', 't15b'] }];
  const input = inputFor({ [F1]: [3, 12] }, teams, fieldsBy, { method: 'even', values: {} });
  it('the shares divide 60 units: a side counts half', () => {
    const counted = seatCounts(input.slots, input.settings, input.held);
    assert.equal(counted.capacity, 90);
    assert.equal(counted.units, 60);
    const targets = shareTargets(teams, input.settings, counted, { sizeOf: id => teamSlotSize(input.slots, teams.find(t => t.id === id)!, input.settings.rules) });
    for (const t of teams) assert.equal(targets.slots.get(t.id), 15, t.id);
    assert.equal(targets.practices.get('t9a'), 30, 'a 9U team on sides: 30 practices');
    assert.equal(targets.practices.get('t15a'), 15);
  });
  for (const d of generateDrafts(input)) {
    it(`${d.strategy}: 9U 30 sides each, 15U 15 each, nothing open, every team $1,800.00`, () => {
      const got = new Map(d.teams.map(r => [r.teamId, r.got]));
      assert.deepEqual([got.get('t9a'), got.get('t9b'), got.get('t15a'), got.get('t15b')], [30, 30, 15, 15]);
      assert.equal(d.totals.open, 0);
      assert.ok(d.teams.every(r => r.short === 0), JSON.stringify(d.teams.map(r => [r.teamId, r.short])));
      const bill = billOf(input, d.assignments);
      assert.equal(bill.totalCents, 720_000);
      for (const t of teams) assert.equal(bill.shares.get(t.id), 180_000, t.id);
      assert.equal(teamTwice(input.slots, d.assignments), null);
      // A part is never shared.
      for (const s of input.slots) if (s.sectionMask) assert.ok((d.assignments.get(s.key) ?? []).length <= 1);
    });
  }
});

describe('"A set number a week" counts practices whatever their size (/review 2026-11-26)', () => {
  const teams = [team('t9a', '9U AA'), team('t9b', '9U A'), team('t15a', '15U AA'), team('t15b', '15U A')];
  const fieldsBy = [{ facilityIds: [F1], groupIds: [], teamIds: ['t9a', 't9b'] }, { facilityIds: [F2], groupIds: [], teamIds: ['t15a', 't15b'] }];
  const input = inputFor({ [F1]: [3, 12] }, teams, fieldsBy, { method: 'weekly', values: { t9a: 2, t9b: 2, t15a: 1, t15b: 1 } });
  for (const d of generateDrafts(input)) {
    it(`${d.strategy}: a 9U team on sides gets its 2 a week, never 4`, () => {
      const perWeek = new Map<string, number>();
      for (const s of input.slots) for (const t of d.assignments.get(s.key) ?? []) perWeek.set(`${t}|${s.week}`, (perWeek.get(`${t}|${s.week}`) ?? 0) + 1);
      for (const [k, n] of perWeek) assert.ok(n <= input.settings.split.values[k.split('|')[0]], `${k}: ${n}`);
      assert.equal(perWeek.get(`t9a|${input.slots[0].week}`), 2);
    });
  }
});

describe('round 2 Ask 3 A: quarters beside a whole field', () => {
  const teams = [team('t7aa', '7U AA'), team('t7a', '7U A'), team('t7b', '7U B'), team('t7c', '7U C'), team('t15aa', '15U AA'), team('t15a', '15U A')];
  const sevens = teams.slice(0, 4).map(t => t.id), fifteens = teams.slice(4).map(t => t.id);
  const fieldsBy = [{ facilityIds: [F1], groupIds: [], teamIds: sevens }, { facilityIds: [F2], groupIds: [], teamIds: fifteens }];
  it('Evenly: each 7U team 30 on a quarter, 10 short ("30 of 40"); each 15U team 10; 10 open on Field 2; $6,000.00 of $7,200.00', () => {
    const input = inputFor({ [F1]: [1, 2, 4, 8] }, teams, fieldsBy, { method: 'even', values: {} });
    const d = makeDraft(input, 'best');
    const by = new Map(d.teams.map(r => [r.teamId, r]));
    for (const id of sevens) {
      assert.equal(by.get(id)!.got, 30, id);
      assert.equal(by.get(id)!.short, 10, `${id}: 2.5 units short is 10 quarters`);
    }
    for (const id of fifteens) assert.equal(by.get(id)!.got, 10, id);
    assert.equal(d.totals.open, 10);
    assert.equal(input.slots.filter(s => s.facilityId === F2 && !(d.assignments.get(s.key) ?? []).length).length, 10, 'the open ones are Field 2’s');
    const bill = billOf(input, d.assignments);
    for (const id of sevens) assert.equal(bill.shares.get(id), 90_000, id);
    for (const id of fifteens) assert.equal(bill.shares.get(id), 120_000, id);
    assert.equal(bill.totalCents, 600_000);
  });
  it('By percentage (7U 12.5% each, 15U 25% each): 7U 30, 15U 15, nothing open, $7,200.00', () => {
    const values = Object.fromEntries([...sevens.map(id => [id, 12.5]), ...fifteens.map(id => [id, 25])]);
    const input = inputFor({ [F1]: [1, 2, 4, 8] }, teams, fieldsBy, { method: 'percentage', values });
    const d = makeDraft(input, 'best');
    const by = new Map(d.teams.map(r => [r.teamId, r]));
    for (const id of sevens) assert.equal(by.get(id)!.got, 30, id);
    for (const id of fifteens) assert.equal(by.get(id)!.got, 15, id);
    assert.equal(d.totals.open, 0);
    assert.equal(billOf(input, d.assignments).totalCents, 720_000);
  });
});

describe('a hand move never puts a team on ground its field or a sibling holds', () => {
  const teams = [team('t9a', '9U AA'), team('t9b', '9U A'), team('t15a', '15U AA'), team('t15b', '15U A')];
  const input = inputFor({ [F1]: [3, 12] }, teams, [], { method: 'even', values: {} });
  const d = makeDraft(input, 'best');
  it('moving a team from side A to side B every week: the slots are the cut’s, so the ground never overlaps', () => {
    const a = input.slots.find(s => s.sectionMask === 3 && (d.assignments.get(s.key) ?? []).length)!;
    const b = input.slots.find(s => s.sectionMask === 12 && s.startMs === a.startMs)!;
    const plan = planMove(input.slots, d.assignments, { fromKey: a.key, toKey: b.key, teamId: d.assignments.get(a.key)![0], scope: 'every', sharing: { pools: [], poolOf: new Map() } });
    const after = new Map(d.assignments);
    for (const e of plan.edits) after.set(e.slotKey, e.teamIds);
    assert.equal(teamTwice(input.slots, after), null);
    // Every edited key is a slot of the cut, and the cut never overlaps itself.
    for (const e of plan.edits) assert.ok(input.slots.some(s => s.key === e.slotKey));
    noOverlappingGround(input.slots);
  });
});

describe('a schedule with no split field: exactly as before', () => {
  it('the same keys, the same weights, no part on any slot, units equal to the count', () => {
    const slots = cutSlots(sundays({}), { slotMinutes: 90, changeoverMinutes: 0, prime: null, venueFacilities: VF });
    assert.equal(slots.length, 60);
    assert.ok(slots.every(s => s.sectionMask === undefined && s.key === `${s.venueId}|${s.facilityId}|${s.startMs}` && s.pos === `${s.weekday}|${s.startClock}|${s.venueId}|${s.facilityId}`));
    const base = defaultSettings();
    const counted = seatCounts(slots, base, new Map());
    assert.equal(counted.units, counted.capacity);
  });
  it('every draft, every assignment and every measure: identical with and without the new fields', () => {
    const teams = [team('t9a', '9U AA'), team('t11', '11U AA'), team('t13', '13U AAA'), team('t15a', '15U AA'), team('t15b', '15U A')];
    const splits: ScheduleSettings['split'][] = [{ method: 'even', values: {} }, { method: 'percentage', values: { t9a: 10, t11: 20, t13: 20, t15a: 25, t15b: 20 } }];
    for (const split of splits) {
      const plain = inputFor({}, teams, [{ facilityIds: [F1], groupIds: [], teamIds: ['t9a', 't11'] }], split);
      const time = sundays({});
      time.blocks = time.blocks.map(b => { const { parts: _drop, ...rest } = b; void _drop; return rest; });
      const old = { ...plain, slots: cutSlots(time, { slotMinutes: 90, changeoverMinutes: 0, prime: null, venueFacilities: VF }) };
      const a = generateDrafts(plain), b = generateDrafts(old);
      assert.deepEqual(a.map(d => ({ ...d, assignments: [...d.assignments] })), b.map(d => ({ ...d, assignments: [...d.assignments] })));
      assert.ok(plain.slots.every(s => !('sectionMask' in s)));
    }
  });
});
