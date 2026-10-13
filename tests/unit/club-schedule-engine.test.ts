import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ageOf, apportionByGroup, cutSlots, generateDrafts, heldSlots, makeDraft, matchPool, planMove, shareTargets, slotPatterns, teamResults,
  teamTwice, type DraftMeasure, type EngineInput, type EngineTeam, type PoolBooking, type Slot,
} from '../../lib/club-schedule-engine.ts';
import { defaultSettings, readScheduleSettings, rulesOn, sharingInSeason, sharingPools, slotRoom, type ScheduleSettings } from '../../lib/club-schedule-settings.ts';
import { billShares, pricedMinutes } from '../../lib/club-schedule-bill.ts';
import type { TimeBlock } from '../../lib/permit-time.ts';
import { zonedWallClockToUtc } from '../../lib/timezone.ts';

/**
 * THE SCHEDULER'S ENGINE, BY THE DRAWINGS' OWN NUMBERS (Club Tier Stage 11a, part A — hub K4MPu4ni53Ct7yrDcmWJd9 →
 * Stages 10 + 11, specimens 4–7 and 14; plan §6a). The lanes and the 60/40 split are DRAWING DATA (not seeded); the dome
 * is 10a's seeded permit (Winter dome 2026–27). Every figure asserted here is one the hub prints.
 */

const DOME = 'v-dome', LANE1 = 'f-lane1', LANE2 = 'f-lane2';
const F = ['f-1', 'f-2', 'f-3', 'f-4', 'f-5', 'f-6'];
const SENIOR = 'g-senior', JUNIOR = 'g-junior';

const team = (id: string, name: string, groupId: string | null): EngineTeam => ({ id, name, groupId, age: ageOf(name) });
const NO_SHARING = { pools: [], poolOf: new Map<string, number>() };
const TEAMS: EngineTeam[] = [
  team('t15aaa', '15U AAA', SENIOR), team('t15aa', '15U AA', SENIOR), team('t16aa', '16U AA', SENIOR), team('t14aa', '14U AA', SENIOR),
  team('t13aaa', '13U AAA', JUNIOR), team('t12aa', '12U AA', JUNIOR), team('t11aa', '11U AA', JUNIOR), team('t9aa', '9U AA', JUNIOR),
];
const ids = TEAMS.map(t => t.id);
const SENIORS = ids.slice(0, 4), JUNIORS = ids.slice(4);

const block = (id: string, venueId: string, facilityIds: string[], weekdays: number[], startTime: string, endTime: string): TimeBlock =>
  ({ id, venueId, facilityIds, weekdays, startTime, endTime, fromDate: null, untilDate: null });

const instant = (day: string, time: string) => Date.parse(zonedWallClockToUtc(day, time)!);

function settings(over: Omit<Partial<ScheduleSettings>, 'rules'> & { rules?: Partial<ScheduleSettings['rules']> } = {}): ScheduleSettings {
  const base = defaultSettings();
  return { ...base, ...over, teamIds: over.teamIds ?? ids, rules: { ...base.rules, avoidGameDays: false, ...(over.rules ?? {}) } };
}

// ── The lanes (drawing data): Lanes 1–2, Mon–Thu 6:00–9:00 p.m. + Sat 8:00–11:00 a.m., Jan 4 – Mar 28, 2027, Feb 15 off ──
const LANES_VF = new Map([[DOME, [LANE1, LANE2]]]);
const LANES_TIME = {
  startsOn: '2027-01-04', endsOn: '2027-03-28',
  blocks: [block('b1', DOME, [], [1, 2, 3, 4], '18:00', '21:00'), block('b2', DOME, [], [6], '08:00', '11:00')],
  datesOff: [{ day: '2027-02-15', note: 'Family Day' }],
};
const WEEKNIGHTS = { weekdays: [1, 2, 3, 4, 5], start: '18:00', end: '20:00', share: 'same' as const, mode: 'keep' as const };
const lanesSlots = (prime = WEEKNIGHTS) => cutSlots(LANES_TIME, { slotMinutes: 60, changeoverMinutes: 0, prime, venueFacilities: LANES_VF });
// 13U AAA's tryout day holds Sat, Jan 9 on Lane 1, 9:00–11:00 a.m.
const TRYOUT: PoolBooking = { key: 'tryout_session:1', venueId: DOME, facilityId: LANE1, startMs: instant('2027-01-09', '09:00'), endMs: instant('2027-01-09', '11:00'), ownerName: '13U AAA', kind: 'tryout' };

function lanesInput(over: Omit<Partial<ScheduleSettings>, 'rules'> & { rules?: Partial<ScheduleSettings['rules']> } = {}, extra: Partial<EngineInput> = {}): EngineInput {
  const s = settings({ slotMinutes: 60, prime: WEEKNIGHTS, ...over });
  const slots = cutSlots(LANES_TIME, { slotMinutes: 60, changeoverMinutes: 0, prime: s.prime, venueFacilities: LANES_VF });
  return { slots, teams: TEAMS, settings: s, held: heldSlots(slots, [TRYOUT]), teamBookings: new Map(), fixed: new Map(), ...extra };
}

describe('the lanes: the time cut into slots (specimen 4)', () => {
  it('354 slots, 30 a week; Feb 15 off; prime weeknights 6:00–8:00 p.m.', () => {
    const slots = lanesSlots();
    assert.equal(slots.length, 354);
    const weeks = new Map<string, number>();
    for (const s of slots) weeks.set(s.week, (weeks.get(s.week) ?? 0) + 1);
    assert.equal(weeks.size, 12);
    assert.equal(weeks.get('2027-01-04'), 30);
    assert.equal(weeks.get('2027-02-15'), 24, 'Family Day takes the Monday');
    assert.ok(!slots.some(s => s.day === '2027-02-15'));
    assert.equal(slots.filter(s => s.prime).length, 188, '16 a week less the Monday off');
    const first = slots[0];
    assert.equal(first.day, '2027-01-04');
    assert.equal(first.startClock, '18:00');
    assert.equal(first.endClock, '19:00');
  });
  it('the tryout day holds two Saturday slots on Lane 1', () => {
    const slots = lanesSlots();
    const held = heldSlots(slots, [TRYOUT]);
    assert.equal(held.size, 2);
    assert.deepEqual([...held.keys()].map(k => slots.find(s => s.key === k)!.startClock).sort(), ['09:00', '10:00']);
  });
  it('a changeover between slots on one facility', () => {
    const slots = cutSlots({ ...LANES_TIME, blocks: [LANES_TIME.blocks[0]] }, { slotMinutes: 60, changeoverMinutes: 15, prime: null, venueFacilities: LANES_VF });
    assert.deepEqual([...new Set(slots.map(s => s.startClock))], ['18:00', '19:15'], '6:00 and 7:15; a third would end past 9:00');
  });
});

describe('the lanes: 8 teams × 3 a week (specimens 4–6)', () => {
  const input = lanesInput({ split: { method: 'weekly', values: Object.fromEntries(ids.map(t => [t, 3])) } });
  const drafts = generateDrafts(input);
  it('three drafts, ranked by score', () => {
    assert.equal(drafts.length, 3);
    assert.ok(drafts[0].score >= drafts[1].score && drafts[1].score >= drafts[2].score);
    // The same each week (Stage 11c Ask 5): "Prime time rotated" retired — Moved around rotates prime time instead.
    assert.deepEqual(drafts.map(d => d.strategy).sort(), ['best', 'mix', 'youngest']);
  });
  for (const d of drafts) {
    it(`${d.strategy}: every team gets 36 slots; 288 handed out, 64 open, 2 held`, () => {
      for (const r of d.teams) assert.equal(r.got, 36, r.teamId);
      assert.equal(d.totals.handedOut, 288);
      assert.equal(d.totals.open, 64);
      assert.equal(d.totals.held, 2);
      assert.equal(d.totals.slots, 354);
      assert.equal(teamTwice(input.slots, d.assignments), null, 'never a team twice at once');
      const held = [...input.held.keys()];
      assert.ok(held.every(k => !(d.assignments.get(k) ?? []).length), 'a held slot is never handed out');
    });
    it(`${d.strategy}: prime time 23–24 each, and the measures say so`, () => {
      const primes = d.teams.map(r => r.prime);
      assert.equal(primes.reduce((a, b) => a + b, 0), 188);
      assert.ok(Math.min(...primes) >= 23 && Math.max(...primes) <= 24, JSON.stringify(primes));
      const shares = d.measures.find(m => m.kind === 'shares');
      assert.deepEqual(shares, { kind: 'shares', allMet: true, sameCount: 36, short: [] });
      assert.deepEqual(d.measures.find(m => m.kind === 'held'), { kind: 'held', count: 2, owners: ['13U AAA'], what: 'tryout' });
    });
  }
  it('Best overall keeps each team on the same nights every week', () => {
    const best = drafts.find(d => d.strategy === 'best')!;
    const nights = best.measures.find(m => m.kind === 'nights') as { same: boolean; ratio: number };
    assert.equal(nights.same, true);
  });
  it('the same round makes the same drafts (seeded)', () => {
    const again = generateDrafts(input);
    assert.deepEqual(again.map(d => [d.strategy, d.score]), drafts.map(d => [d.strategy, d.score]));
    assert.deepEqual([...again[0].assignments], [...drafts[0].assignments]);
  });
  it('"Three more drafts" is a new round', () => {
    const more = generateDrafts(input, 1);
    assert.equal(more.length, 3);
    for (const d of more) { assert.equal(d.round, 1); for (const r of d.teams) assert.equal(r.got, 36); }
  });
});

describe('by percentage, 60 / 40 — the way New allocation splits money (Ask 18)', () => {
  const values = { ...Object.fromEntries(SENIORS.map(t => [t, 15])), ...Object.fromEntries(JUNIORS.map(t => [t, 10])) };
  const input = lanesInput({ split: { method: 'percentage', values } });
  it('352 slots → Senior 211 (53/53/53/52), Junior 141 (36/35/35/35); prime 113 · 75', () => {
    const t = shareTargets(TEAMS, input.settings, { capacity: 352, primeCapacity: 188, weeks: 12 });
    assert.deepEqual(SENIORS.map(id => t.slots.get(id)), [53, 53, 53, 52]);
    assert.deepEqual(JUNIORS.map(id => t.slots.get(id)), [36, 35, 35, 35]);
    assert.equal(SENIORS.reduce((n, id) => n + t.slots.get(id)!, 0), 211);
    assert.equal(JUNIORS.reduce((n, id) => n + t.slots.get(id)!, 0), 141);
    assert.equal(SENIORS.reduce((n, id) => n + t.prime.get(id)!, 0), 113);
    assert.equal(JUNIORS.reduce((n, id) => n + t.prime.get(id)!, 0), 75);
    assert.equal(t.handedOut, 352, 'nothing left open at 100%');
  });
  it('the draft meets every share; the shares hold every week', () => {
    const d = makeDraft(input, 'best');
    assert.deepEqual(SENIORS.map(id => d.teams.find(r => r.teamId === id)!.got), [53, 53, 53, 52]);
    assert.deepEqual(JUNIORS.map(id => d.teams.find(r => r.teamId === id)!.got), [36, 35, 35, 35]);
    // Every week: Senior within one slot of 60% of that week's slots.
    const weeks = new Map<string, { all: number; senior: number }>();
    for (const s of input.slots) {
      if (input.held.has(s.key)) continue;
      const w = weeks.get(s.week) ?? { all: 0, senior: 0 };
      w.all++;
      if ((d.assignments.get(s.key) ?? []).some(t => SENIORS.includes(t))) w.senior++;
      weeks.set(s.week, w);
    }
    for (const [week, w] of weeks) assert.ok(Math.abs(w.senior - 0.6 * w.all) <= 1.5, `${week}: ${w.senior} of ${w.all}`);
  });
  it('under 100% leaves slots open; over 100% is refused with its reason', () => {
    const half = Object.fromEntries(ids.map(t => [t, 5]));
    const t = shareTargets(TEAMS, { ...input.settings, split: { method: 'percentage', values: half } }, { capacity: 352, primeCapacity: 188, weeks: 12 });
    assert.equal(t.handedOut, 141, '40% of 352, rounded');
    // The reader checks real ids: the same 60 / 40 on uuid-shaped teams, with 9U AA retyped to 20%.
    const uuidOf = (id: string) => `00000000-0000-4000-8000-${String(ids.indexOf(id) + 1).padStart(12, '0')}`;
    const uValues = Object.fromEntries(Object.entries({ ...values, t9aa: 20 }).map(([k, v]) => [uuidOf(k), v]));
    const over = readScheduleSettings({ ...input.settings, teamIds: ids.map(uuidOf), split: { method: 'percentage', values: uValues } });
    assert.equal(over.ok, false);
    assert.equal(!over.ok && over.code, 'over_100');
    assert.equal(!over.ok && over.error, 'The shares add up to 110%. Take 10% off a group or a team.');
  });
  it('a weekly cap of 3 holds Senior to about 41% — reported, never broken', () => {
    const capped = lanesInput({ split: { method: 'percentage', values }, rules: { maxPerWeek: 3 } });
    const d = makeDraft(capped, 'best');
    const w = d.warnings.find(x => x.groupId === SENIOR);
    assert.ok(w, 'Senior is warned');
    assert.equal(w!.percent, 41);
    assert.equal(w!.cap, 3);
    for (const id of SENIORS) assert.equal(d.teams.find(r => r.teamId === id)!.got, 36, 'the cap holds');
  });
});

// ── The dome (10a's seeded permit): Fields 1–4 full + 5–6 half, Sundays 8:00–11:00 a.m., Oct 4, 2026 – Mar 28, 2027 ──
const DOME_VF = new Map([[DOME, F]]);
const DOME_TIME = {
  startsOn: '2026-10-04', endsOn: '2027-03-28',
  blocks: [block('b1', DOME, F, [7], '08:00', '11:00')],
  datesOff: [{ day: '2026-12-27', note: 'The dome is closed' }],
};
const half = (f: string | null) => (f === 'f-5' || f === 'f-6' ? 0.5 : 1);
function domeInput(over: Omit<Partial<ScheduleSettings>, 'rules'> & { rules?: Partial<ScheduleSettings['rules']> } = {}, extra: Partial<EngineInput> = {}): EngineInput {
  const s = settings({
    slotMinutes: 90,
    split: { method: 'weekly', values: { ...Object.fromEntries(SENIORS.map(t => [t, 1])), ...Object.fromEntries(JUNIORS.map(t => [t, 2])) } },
    ...over,
    rules: { fieldsBy: [{ facilityIds: ['f-5', 'f-6'], groupIds: [JUNIOR], teamIds: [] }], ...(over.rules ?? {}) },
  });
  const slots = cutSlots(DOME_TIME, { slotMinutes: 90, changeoverMinutes: 0, prime: null, venueFacilities: DOME_VF, weightOf: half });
  return { slots, teams: TEAMS, settings: s, held: new Map(), teamBookings: new Map(), fixed: new Map(), ...extra };
}

describe('the dome, walked (specimen 14, step 3)', () => {
  const input = domeInput();
  it('90-minute slots: 12 a Sunday, 300 in all; Dec 27 off', () => {
    assert.equal(input.slots.length, 300);
    assert.equal(input.slots.filter(s => s.day === '2026-10-04').length, 12);
    assert.ok(!input.slots.some(s => s.day === '2026-12-27'));
    assert.deepEqual([...new Set(input.slots.map(s => `${s.startClock}–${s.endClock}`))], ['08:00–09:30', '09:30–11:00']);
  });
  const drafts = generateDrafts(input);
  for (const d of drafts) {
    it(`${d.strategy}: Senior 1 full field a week (25 each), Junior 1 full + 1 half (50 each); nothing left open`, () => {
      for (const id of SENIORS) assert.equal(d.teams.find(r => r.teamId === id)!.got, 25, id);
      for (const id of JUNIORS) assert.equal(d.teams.find(r => r.teamId === id)!.got, 50, id);
      assert.equal(d.totals.handedOut, 300);
      assert.equal(d.totals.open, 0);
      assert.equal(teamTwice(input.slots, d.assignments), null, 'a Junior team is never on two fields at once');
    });
    it(`${d.strategy}: the half fields go to Junior only, and every Junior team gets 25 of each`, () => {
      for (const s of input.slots) {
        if (s.facilityId === 'f-5' || s.facilityId === 'f-6') {
          for (const t of d.assignments.get(s.key) ?? []) assert.ok(JUNIORS.includes(t), `${t} on a half field`);
        }
      }
      for (const id of JUNIORS) {
        const halves = input.slots.filter(s => (d.assignments.get(s.key) ?? []).includes(id) && s.weight === 0.5).length;
        assert.equal(halves, 25, id);
      }
      // Priced full-field minutes: Senior 25 × 90; Junior 25 × 90 + 25 × 45.
      for (const id of SENIORS) assert.equal(d.teams.find(r => r.teamId === id)!.pricedMinutes, 2250);
      for (const id of JUNIORS) assert.equal(d.teams.find(r => r.teamId === id)!.pricedMinutes, 3375);
    });
  }
});

describe('the rules, one by one', () => {
  it('a team’s day off — 13U AAA on the Sunday before Christmas — gives its slots to nobody else’s share, and says so', () => {
    const input = domeInput({ rules: { daysOff: [{ teamId: 't13aaa', date: '2026-12-20', weekday: null, note: 'away at a tournament' }], fieldsBy: [{ facilityIds: ['f-5', 'f-6'], groupIds: [JUNIOR], teamIds: [] }] } });
    const d = makeDraft(input, 'best');
    const dec20 = input.slots.filter(s => s.day === '2026-12-20');
    assert.ok(dec20.every(s => !(d.assignments.get(s.key) ?? []).includes('t13aaa')));
    assert.equal(d.teams.find(r => r.teamId === 't13aaa')!.got, 48);
    assert.deepEqual((d.measures.find(m => m.kind === 'shares') as { short: unknown }).short, [{ teamId: 't13aaa', short: 2 }]);
  });
  it('every Tuesday off (11U AA, the coach works nights)', () => {
    const input = lanesInput({ split: { method: 'weekly', values: Object.fromEntries(ids.map(t => [t, 3])) }, rules: { daysOff: [{ teamId: 't11aa', date: null, weekday: 2, note: null }] } });
    const d = makeDraft(input, 'best');
    assert.ok(input.slots.filter(s => s.weekday === 2).every(s => !(d.assignments.get(s.key) ?? []).includes('t11aa')));
    assert.equal(d.teams.find(r => r.teamId === 't11aa')!.got, 36);
  });
  it('an away game on a typed place: never on that team’s game day', () => {
    const away = { startMs: instant('2027-01-12', '19:00'), endMs: instant('2027-01-12', '21:00'), isGame: true, days: ['2027-01-12'] };
    const input = lanesInput({ split: { method: 'weekly', values: Object.fromEntries(ids.map(t => [t, 3])) }, rules: { avoidGameDays: true } },
      { teamBookings: new Map([['t15aa', [away]]]) });
    const d = makeDraft(input, 'best');
    assert.ok(input.slots.filter(s => s.day === '2027-01-12').every(s => !(d.assignments.get(s.key) ?? []).includes('t15aa')));
    assert.equal(d.teams.find(r => r.teamId === 't15aa')!.got, 36, 'it gets its three elsewhere that week');
  });
  it('a 13U latest start: 13U AAA never starts after 6:00 p.m.; 9U AA and 11U AA finish by 8:00 p.m.', () => {
    const input = lanesInput({
      split: { method: 'weekly', values: Object.fromEntries(ids.map(t => [t, 3])) },
      rules: { windows: [{ teamIds: ['t13aaa'], startAfter: null, startBy: '18:00', finishBy: null }, { teamIds: ['t9aa', 't11aa'], startAfter: null, startBy: null, finishBy: '20:00' }] },
    });
    const d = makeDraft(input, 'best');
    for (const s of input.slots) {
      const on = d.assignments.get(s.key) ?? [];
      if (on.includes('t13aaa')) assert.ok(s.startClock <= '18:00', s.startClock);
      if (on.includes('t9aa') || on.includes('t11aa')) assert.ok(s.endClock <= '20:00', s.endClock);
    }
  });
  it('no back-to-back days for a team', () => {
    const input = lanesInput({ split: { method: 'weekly', values: Object.fromEntries(ids.map(t => [t, 2])) }, rules: { noBackToBack: true } });
    const d = makeDraft(input, 'best');
    for (const id of ids) {
      const days = [...new Set(input.slots.filter(s => (d.assignments.get(s.key) ?? []).includes(id)).map(s => s.day))].sort();
      for (let i = 1; i < days.length; i++) {
        const gap = (Date.parse(days[i]) - Date.parse(days[i - 1])) / 86_400_000;
        assert.ok(gap > 1, `${id}: ${days[i - 1]} then ${days[i]}`);
      }
    }
  });
  it('at most one slot a team a day', () => {
    const input = lanesInput({ split: { method: 'weekly', values: Object.fromEntries(ids.map(t => [t, 3])) }, rules: { maxPerDay: 1 } });
    const d = makeDraft(input, 'best');
    for (const id of ids) {
      const days = input.slots.filter(s => (d.assignments.get(s.key) ?? []).includes(id)).map(s => s.day);
      assert.equal(new Set(days).size, days.length, id);
    }
  });
  it('a booking already on the books holds its slots unless that rule is off', () => {
    const off = lanesInput({ split: { method: 'even', values: {} }, rules: { avoidBookings: false } });
    const d = makeDraft(off, 'best');
    assert.equal(d.totals.held, 0);
    assert.equal(d.totals.seats, 354);
  });
});

describe('what a regenerate keeps (Ask 19)', () => {
  const base = lanesInput({ split: { method: 'weekly', values: Object.fromEntries(ids.map(t => [t, 3])) } });
  const first = makeDraft(base, 'best');
  // The coach can't do Tuesdays: 15U AA's slot moved by hand to Wednesday 8:00 p.m. on Lane 2 (it locks itself), and a
  // slot the admin locked.
  const wed8 = base.slots.find(s => s.day === '2027-01-06' && s.startClock === '20:00' && s.facilityId === LANE2)!;
  const someLocked = base.slots.find(s => (first.assignments.get(s.key) ?? []).length && s.day === '2027-01-07')!;
  const fixed = new Map<string, string[]>([[wed8.key, ['t15aa']], [someLocked.key, [...first.assignments.get(someLocked.key)!]]]);
  const again = makeDraft({ ...base, fixed, settings: { ...base.settings, split: { method: 'weekly', values: Object.fromEntries(ids.map(t => [t, 3])) } } }, 'mix');
  it('a locked slot and a slot moved by hand stay where they are', () => {
    assert.deepEqual(again.assignments.get(wed8.key), ['t15aa']);
    assert.deepEqual(again.assignments.get(someLocked.key), first.assignments.get(someLocked.key));
  });
  it('and count toward the shares: still 36 each, never twice at once', () => {
    for (const r of again.teams) assert.equal(r.got, 36, r.teamId);
    assert.equal(teamTwice(base.slots, again.assignments), null);
  });
});

describe('the grid: which weeks a move reaches (Ask 13), and the one refusal', () => {
  const base = lanesInput({ split: { method: 'weekly', values: Object.fromEntries(ids.map(t => [t, 3])) } });
  const d = makeDraft(base, 'best');
  const assign = new Map([...d.assignments].map(([k, v]) => [k, [...v]]));
  const a15 = base.slots.find(s => s.week === '2027-01-04' && (assign.get(s.key) ?? []).includes('t15aa'))!;
  const open = base.slots.find(s => s.week === '2027-01-04' && !(assign.get(s.key) ?? []).length && !base.held.has(s.key) && s.startMs !== a15.startMs)!;
  it('This week only moves one slot', () => {
    const m = planMove(base.slots, assign, { fromKey: a15.key, toKey: open.key, teamId: 't15aa', scope: 'this', sharing: NO_SHARING });
    assert.deepEqual(m.moved, ['2027-01-04']);
    assert.deepEqual(m.edits.find(e => e.slotKey === open.key)?.teamIds, ['t15aa']);
    assert.ok(!m.edits.find(e => e.slotKey === a15.key)!.teamIds.includes('t15aa'));
  });
  it('Every week reaches each week the team holds that slot, and names the weeks it can’t', () => {
    const m = planMove(base.slots, assign, { fromKey: a15.key, toKey: open.key, teamId: 't15aa', scope: 'every', sharing: NO_SHARING });
    assert.equal(m.moved.length + m.skipped.length, 12);
    assert.ok(m.moved.length >= 1);
  });
  it('a drop onto another team swaps the two', () => {
    const other = base.slots.find(s => s.week === '2027-01-04' && (assign.get(s.key) ?? []).length === 1 && !(assign.get(s.key) ?? []).includes('t15aa') && s.startMs !== a15.startMs)!;
    const otherTeam = assign.get(other.key)![0];
    const m = planMove(base.slots, assign, { fromKey: a15.key, toKey: other.key, teamId: 't15aa', scope: 'this', sharing: NO_SHARING });
    assert.deepEqual(m.edits.find(e => e.slotKey === other.key)?.teamIds, ['t15aa']);
    assert.ok(m.edits.find(e => e.slotKey === a15.key)!.teamIds.includes(otherTeam));
  });
  it('a team twice at once is the one refusal', () => {
    const twice = new Map(assign);
    const sameTime = base.slots.find(s => s.startMs === a15.startMs && s.key !== a15.key)!;
    twice.set(sameTime.key, ['t15aa']);
    assert.deepEqual(teamTwice(base.slots, twice)?.teamId, 't15aa');
  });
});

describe('the pieces the words and the bill read', () => {
  it('a team\'s slots as a pattern: Sundays 8:00 on one field, every Sunday but Dec 27', () => {
    const input = domeInput();
    const d = makeDraft(input, 'best');
    const p = slotPatterns(input.slots, 't15aaa', d.assignments);
    assert.equal(p.length, 1, 'one field, one time, every week (keep nights)');
    assert.equal(p[0].weekday, 7);
    assert.equal(p[0].days.length, 25);
    assert.equal(p[0].days[0], '2026-10-04');
    assert.equal(p[0].days[24], '2027-03-28');
  });
  it('teamResults reads hours and nights from any assignment', () => {
    const input = domeInput();
    const d = makeDraft(input, 'best');
    const r = teamResults(input.slots, d.assignments, TEAMS).find(x => x.teamId === 't13aaa')!;
    assert.equal(r.minutes, 50 * 90);
    assert.deepEqual(r.nights, [7]);
  });
  it('a group\'s figure, then its teams\'; an ungrouped team is its own group', () => {
    const t = apportionByGroup(10, [team('a', 'A', 'g'), team('b', 'B', 'g'), team('c', 'C', null)], () => 1);
    assert.deepEqual([t.get('a'), t.get('b'), t.get('c')], [4, 3, 3], '10 over weights 2 (group) and 1 → 6.67/3.33 → 7/3 → 4/3');
    assert.equal(ageOf('13U AAA'), 13);
    assert.equal(ageOf('U11 Girls'), 11);
    assert.equal(ageOf('UAT Test Team'), null);
  });
  it('the settings reader: defaults, refusals in words, and "Rules · 4 on" as drawn', () => {
    const uuids = ids.map((_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
    const ok = readScheduleSettings({ ...settings({ teamIds: uuids, split: { method: 'weekly', values: Object.fromEntries(uuids.map(x => [x, 3])) } }) });
    assert.equal(ok.ok, true);
    assert.deepEqual(ok.ok && ok.value.rules.daysOff, []);
    const slot = readScheduleSettings({ ...settings({ teamIds: uuids }), slotMinutes: 5 });
    assert.deepEqual(slot, { ok: false, code: 'bad_slot_length', error: 'A slot is between 15 minutes and 8 hours long.' });
    assert.equal(readScheduleSettings({ ...settings(), teamIds: ['not-an-id'] }).ok, false, 'a team id must be one');
    const lanesRules = { ...defaultSettings().rules, avoidGameDays: true, avoidBookings: true,
      windows: [{ teamIds: ['t9aa', 't11aa'], startAfter: null, startBy: null, finishBy: '20:00' }],
      daysOff: [{ teamId: 't13aaa', date: '2027-02-06', weekday: null, note: 'away at a tournament' }, { teamId: 't11aa', date: null, weekday: 2, note: null }] };
    // Stage 11c: each day off is its own rule (it reads as its own sentence) — the lanes' 4 becomes 5.
    assert.equal(rulesOn(lanesRules), 5);
    assert.equal(rulesOn({ ...defaultSettings().rules, avoidGameDays: false, fieldsBy: [{ facilityIds: ['f-5', 'f-6'], groupIds: [JUNIOR], teamIds: [] }] }), 2);
  });
});

describe('every slot\'s instants are on the club\'s clock (daylight saving included)', () => {
  it('a Sunday after the November change keeps its 8:00 a.m.', () => {
    const input = domeInput();
    const nov8: Slot = input.slots.find(s => s.day === '2026-11-08' && s.startClock === '08:00')!;
    assert.equal(nov8.startMs, instant('2026-11-08', '08:00'));
    assert.equal(new Date(nov8.startMs).toISOString(), '2026-11-08T13:00:00.000Z', 'EST, UTC−5');
    const oct4 = input.slots.find(s => s.day === '2026-10-04' && s.startClock === '08:00')!;
    assert.equal(new Date(oct4.startMs).toISOString(), '2026-10-04T12:00:00.000Z', 'EDT, UTC−4');
  });
});

// ── Stage 11c (ratified 2026-10-12 — hub → Stage 11c, specimens 2 and 3; the build prompt's gates) ──────────────────────
const SHARE_9_11 = { teamIds: ['t9aa', 't11aa'], groupIds: [] as string[], atOnce: 2 };
const priced = (input: EngineInput, d: { assignments: Map<string, string[]> }) =>
  pricedMinutes(input.slots.map(s => ({ day: s.day, startMs: s.startMs, endMs: s.endMs, weight: s.weight, teamIds: d.assignments.get(s.key) ?? [] })));

describe('Stage 11c · sharing a facility: the dome with 9U AA and 11U AA two to a facility (specimen 2)', () => {
  const input = domeInput({ rules: { sharing: [SHARE_9_11], fieldsBy: [{ facilityIds: ['f-5', 'f-6'], groupIds: [JUNIOR], teamIds: [] }] } });
  const drafts = generateDrafts(input);
  it('the shares count it: 250 slots handed out of 300, 50 open', () => {
    const t = shareTargets(TEAMS, input.settings, { capacity: 300, primeCapacity: 0, weeks: 25 });
    assert.equal(t.handedOut, 250);
    assert.equal(t.practices.get('t9aa'), 50, 'a set number a week still counts practices');
  });
  for (const d of drafts) {
    it(`${d.strategy}: 250 handed out, 50 open; every team 37.5 hours; the bill $2,700.00 each`, () => {
      assert.equal(d.totals.seats, 300);
      assert.equal(d.totals.handedOut, 250);
      assert.equal(d.totals.open, 50);
      for (const r of d.teams) assert.equal(r.pricedMinutes, 2250, `${r.teamId}: 37.5 h`);
      for (const id of ['t9aa', 't11aa']) {
        const r = d.teams.find(x => x.teamId === id)!;
        assert.equal(r.got, 50); assert.equal(r.shared, 50); assert.equal(r.units, 25);
      }
      const bill = billShares(priced(input, d), { fullHour: 72, amount: null, teamOrder: ids });
      assert.equal(bill?.totalCents, 2_160_000, '$21,600.00 — $5,400.00 less than the permit');
      for (const id of ids) assert.equal(bill?.shares.get(id), 270_000, id);
      assert.equal(teamTwice(input.slots, d.assignments), null);
    });
    it(`${d.strategy}: a team in no rule never shares, and a half facility is never shared`, () => {
      for (const s of input.slots) {
        const on = d.assignments.get(s.key) ?? [];
        if (on.length < 2) continue;
        assert.deepEqual([...on].sort(), ['t11aa', 't9aa'], 'only the rule’s teams share');
        assert.equal(s.weight, 1, 'never on Field 5 or Field 6');
      }
    });
    it(`${d.strategy}: the draft says it`, () => {
      assert.deepEqual(d.measures.find(m => m.kind === 'sharing'), { kind: 'sharing', rules: [SHARE_9_11] });
      assert.deepEqual(d.measures.find(m => m.kind === 'open'), { kind: 'open', count: 50 });
    });
  }
  it('a pair that can’t play together plays alone: 9U AA off Sun, Oct 4 — 11U AA still has its two that Sunday', () => {
    const off = domeInput({ rules: {
      sharing: [SHARE_9_11], fieldsBy: [{ facilityIds: ['f-5', 'f-6'], groupIds: [JUNIOR], teamIds: [] }],
      daysOff: [{ teamId: 't9aa', date: '2026-10-04', weekday: null, note: null }],
    } });
    const d = makeDraft(off, 'best');
    const oct4 = off.slots.filter(s => s.day === '2026-10-04');
    assert.equal(oct4.filter(s => (d.assignments.get(s.key) ?? []).includes('t11aa')).length, 2, '11U AA plays alone');
    assert.ok(oct4.every(s => !(d.assignments.get(s.key) ?? []).includes('t9aa')), '9U AA is off');
    assert.equal(d.teams.find(r => r.teamId === 't11aa')!.got, 50);
    assert.equal(d.teams.find(r => r.teamId === 't9aa')!.got, 48);
    assert.equal(teamTwice(off.slots, d.assignments), null);
  });
  it('teams in two rules pair only within their own', () => {
    const two = domeInput({ rules: { sharing: [SHARE_9_11, { teamIds: ['t15aa', 't16aa'], groupIds: [], atOnce: 2 }] } });
    const d = makeDraft(two, 'best');
    for (const s of two.slots) {
      const on = [...(d.assignments.get(s.key) ?? [])].sort();
      if (on.length > 1) assert.ok(on.join() === 't11aa,t9aa' || on.join() === 't15aa,t16aa', on.join());
    }
    assert.ok(two.slots.some(s => (d.assignments.get(s.key) ?? []).length === 2 && (d.assignments.get(s.key) ?? []).includes('t15aa')), 'the second pair shares too');
  });
  it('a whole group’s rule pairs its teams youngest first: 9U AA with 11U AA, 12U AA with 13U AAA', () => {
    const at = ['t9aa', 't11aa', 't12aa', 't13aaa'];
    const m = matchPool(new Map([['t13aaa', 2], ['t12aa', 2], ['t11aa', 2], ['t9aa', 2]]), 2, 'practices', (a, b) => at.indexOf(a) - at.indexOf(b));
    assert.deepEqual(m.groups.map(g => [g.teamIds.join('+'), g.count]), [['t9aa+t11aa', 2], ['t12aa+t13aaa', 2]]);
    assert.equal(m.alone.size, 0);
  });
  it('an odd team out is paired in turn, never left alone while a partner is free', () => {
    const m = matchPool(new Map([['a', 2], ['b', 2], ['c', 2]]), 2, 'practices', (x, y) => x.localeCompare(y));
    assert.deepEqual(m.groups.map(g => g.teamIds.join('+')).sort(), ['a+b', 'a+c', 'b+c']);
    assert.equal(m.alone.size, 0);
  });
  it('By percentage and Evenly count a shared slot half: a share of 1 facility is 2 shared practices', () => {
    const m = matchPool(new Map([['a', 1], ['b', 1]]), 2, 'units', (x, y) => x.localeCompare(y));
    assert.deepEqual(m.groups, [{ teamIds: ['a', 'b'], count: 2 }]);
  });
});

describe('Stage 11c · Moved around: the dome, each team’s start and facility in turn (specimen 3)', () => {
  const input = domeInput({ timeMode: 'moved' });
  const drafts = generateDrafts(input);
  it('three mixes that all move — never Youngest earliest or Prime time rotated', () => {
    assert.deepEqual(drafts.map(d => d.strategy).sort(), ['best', 'mix', 'third']);
  });
  const best = drafts.find(d => d.strategy === 'best')!;
  it('each Senior team: 12 or 13 early starts of 25, on at least three facilities; every slot a Sunday', () => {
    for (const id of SENIORS) {
      const r = best.teams.find(x => x.teamId === id)!;
      assert.equal(r.got, 25, id);
      assert.ok(r.early === 12 || r.early === 13, `${id}: ${r.early} early`);
      assert.ok(r.facilities >= 3, `${id}: ${r.facilities} facilities`);
      assert.deepEqual(r.nights, [7], 'a team keeps its days');
    }
    assert.ok(input.slots.every(s => s.weekday === 7));
  });
  it('the draft says how evenly early and late fell, and that facilities were taken in turn', () => {
    const early = best.measures.find(m => m.kind === 'early') as Extract<DraftMeasure, { kind: 'early' }>;
    assert.equal(early.of, 25);
    assert.ok(early.min >= 12 && early.max <= 13, JSON.stringify(early));
    assert.equal(early.even, true);
    assert.deepEqual(best.measures.find(m => m.kind === 'facilities'), { kind: 'facilities', turned: true });
  });
  it('moved around with sharing: still 250 of 300, every team 37.5 hours; 12U AA and 13U AAA take Fields 5 and 6 in turn', () => {
    const both = domeInput({ timeMode: 'moved', rules: { sharing: [SHARE_9_11], fieldsBy: [{ facilityIds: ['f-5', 'f-6'], groupIds: [JUNIOR], teamIds: [] }] } });
    const d = generateDrafts(both).find(x => x.strategy === 'best')!;
    assert.equal(d.totals.handedOut, 250);
    for (const r of d.teams) assert.equal(r.pricedMinutes, 2250, `${r.teamId}: 37.5 h`);
    for (const id of ['t12aa', 't13aaa']) assert.equal(d.teams.find(x => x.teamId === id)!.facilities, 2, `${id} keeps to Fields 5 and 6`);
    for (const id of SENIORS) {
      const r = d.teams.find(x => x.teamId === id)!;
      assert.ok(r.early === 12 || r.early === 13, `${id}: ${r.early} early`);
    }
  });
  it('the same each week keeps today’s continuity: one facility, one start', () => {
    const same = makeDraft(domeInput(), 'best');
    for (const id of SENIORS) assert.equal(same.teams.find(x => x.teamId === id)!.facilities, 1, id);
  });
});

describe('Stage 11c · what was saved before reads with its meaning', () => {
  const uuids = ids.map((_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
  const v1 = { v: 1, slotMinutes: 90, changeoverMinutes: 0, teamIds: uuids, split: { method: 'even', values: {} }, prime: null,
    rules: { windows: [], maxPerDay: null, maxPerWeek: null, avoidGameDays: true, avoidBookings: true, noBackToBack: false, daysOff: [], fieldsBy: [] } };
  it('a saved Teams at once of 2 reads as one sharing rule naming every ticked team', () => {
    const r = readScheduleSettings({ ...v1, teamsAtOnce: 2 });
    assert.ok(r.ok);
    assert.deepEqual(r.ok && r.value.rules.sharing, [{ teamIds: uuids, groupIds: [], atOnce: 2 }]);
    assert.equal(r.ok && r.value.teamsAtOnce, 2, 'the database’s ceiling stays');
    assert.equal(r.ok && r.value.v, 2);
  });
  it('a saved Teams at once of 1 reads as no rule', () => {
    const r = readScheduleSettings({ ...v1, teamsAtOnce: 1 });
    assert.deepEqual(r.ok && r.value.rules.sharing, []);
    assert.equal(r.ok && r.value.timeMode, 'same');
  });
  it('a saved prime time rotated weekly reads as Moved around', () => {
    const r = readScheduleSettings({ ...v1, teamsAtOnce: 1, prime: { weekdays: [1, 2, 3, 4, 5], start: '18:00', end: '20:00', share: 'same', mode: 'rotate' } });
    assert.equal(r.ok && r.value.timeMode, 'moved');
    assert.deepEqual(r.ok && r.value.prime, { weekdays: [1, 2, 3, 4, 5], start: '18:00', end: '20:00', share: 'same' });
  });
  it('a copied sharing rule drops a team with no season; a rule left with nobody goes', () => {
    const rules = [{ teamIds: [uuids[6], uuids[7]], groupIds: [], atOnce: 2 }, { teamIds: [uuids[0]], groupIds: [], atOnce: 2 }];
    const running = new Set(uuids.slice(1));
    assert.deepEqual(sharingInSeason(rules, running), [{ teamIds: [uuids[6], uuids[7]], groupIds: [], atOnce: 2 }]);
    assert.deepEqual(sharingInSeason([{ teamIds: [uuids[6], uuids[0]], groupIds: [], atOnce: 2 }], running), [{ teamIds: [uuids[6]], groupIds: [], atOnce: 2 }]);
    const group = '00000000-0000-4000-8000-0000000000aa';
    assert.deepEqual(sharingInSeason([{ teamIds: [uuids[0]], groupIds: [group], atOnce: 3 }], running), [{ teamIds: [], groupIds: [group], atOnce: 3 }], 'a group stays');
  });
});

describe('Stage 11c · the reader refuses a sharing rule that can’t share, in words', () => {
  const uuids = ids.map((_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
  const GROUP = '00000000-0000-4000-8000-0000000000aa';
  const base = (sharing: unknown[]) => ({ ...settings({ teamIds: uuids.slice(0, 6) }), rules: { ...defaultSettings().rules, sharing } });
  const known = { teamIds: new Set(uuids), groupIds: new Set([GROUP]), groupOf: new Map(uuids.map((u, i) => [u, i >= 4 ? GROUP : null])) };
  const refusal = (sharing: unknown[]) => { const r = readScheduleSettings(base(sharing), known); return r.ok ? 'ok' : r.error; };
  it('no ticked team', () => assert.equal(refusal([{ teamIds: [uuids[7]], groupIds: [], atOnce: 2 }]), 'A sharing rule names no ticked team. Tick one of its teams, or remove the rule.'));
  it('an unknown group', () => assert.equal(refusal([{ teamIds: [], groupIds: ['00000000-0000-4000-8000-0000000000bb'], atOnce: 2 }]), 'A sharing rule names a group that isn’t the club’s.'));
  it('a team in two rules — named twice, or named and in a group another rule names', () => {
    assert.equal(refusal([{ teamIds: [uuids[0], uuids[1]], groupIds: [], atOnce: 2 }, { teamIds: [uuids[1]], groupIds: [], atOnce: 2 }]), 'A team is in two sharing rules. Take it out of one.');
    assert.equal(refusal([{ teamIds: [uuids[4]], groupIds: [], atOnce: 2 }, { teamIds: [], groupIds: [GROUP], atOnce: 2 }]), 'A team is in two sharing rules. Take it out of one.');
  });
  it('at once outside 2–4', () => {
    for (const atOnce of [1, 5, 2.5]) assert.equal(refusal([{ teamIds: [uuids[0], uuids[1]], groupIds: [], atOnce }]), 'A sharing rule shares a facility between 2 and 4 teams at once.');
  });
  it('a rule with nobody in it', () => assert.equal(refusal([{ teamIds: [], groupIds: [], atOnce: 2 }]), 'A sharing rule needs its teams.'));
  it('a good rule reads back exactly, and the ceiling is its number', () => {
    const r = readScheduleSettings(base([{ teamIds: [uuids[0], uuids[1]], groupIds: [], atOnce: 3 }, { teamIds: [], groupIds: [GROUP], atOnce: 2 }]), known);
    assert.ok(r.ok);
    assert.deepEqual(r.ok && r.value.rules.sharing, [{ teamIds: [uuids[0], uuids[1]], groupIds: [], atOnce: 3 }, { teamIds: [], groupIds: [GROUP], atOnce: 2 }]);
    assert.equal(r.ok && r.value.teamsAtOnce, 3);
    assert.equal(r.ok && rulesOn(r.value.rules), 4, 'two sharing rules, game days, bookings');
  });
  it('a slot’s room: a rule’s number for its teams, one for anybody else and on a half facility', () => {
    const pools = sharingPools([SHARE_9_11], TEAMS);
    assert.equal(slotRoom(['t9aa'], 1, pools), 2);
    assert.equal(slotRoom(['t9aa', 't11aa'], 1, pools), 2);
    assert.equal(slotRoom(['t15aa'], 1, pools), 1);
    assert.equal(slotRoom(['t9aa'], 0.5, pools), 1);
    assert.equal(slotRoom([], 1, pools), 1);
  });
});
