import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { slotKeyOf, slotPosOf, type Slot } from '../../lib/club-schedule-engine.ts';
import { paymentPeriods, priceTheBill, type BillSlot, type KeptRates } from '../../lib/club-schedule-bill.ts';
import { mondayOfDay, zonedWallClockToUtc } from '../../lib/timezone.ts';
import { weekdayOf } from '../../lib/permit-time.ts';
import { maskProp, partFactor } from '../../lib/field-parts.ts';
import { billingTestLoader } from './_billing-test-loader.ts';

/**
 * CLUB SCHEDULES STAGE 2, SESSION 2C PART 2 (a): Send the changes says the part, and records a gained slot's hours at the
 * team's share (Finding #56). Through the real send path (`planChanges`, `patternsFor`, `changesMoney`) with the database
 * stubbed out, as `club-schedule-add-time-send.test.ts` does. Fixture: Kinsmen Park's Diamond A in two sides, Diamond B
 * not split.
 */

const stub = new Proxy({}, { get: () => () => { throw new Error('no database in this test'); } });
const send = billingTestLoader({ './supabase-admin': { supabaseAdmin: stub }, '@/lib/supabase-admin': { supabaseAdmin: stub } })('lib/club-schedule-send.ts') as {
  planChanges: (c: unknown, practices: unknown[]) => { byTeam: Map<string, Record<string, unknown>[]>; gainedSlots: Map<string, BillSlot[]>; inserts: unknown[]; updates: unknown[]; retire: string[] };
  patternsFor: (c: unknown, teamId: string) => string[];
  changesMoney: (c: unknown, plan: unknown, kept: KeptRates, before: Record<string, number>, handBacks: unknown[], o: { periods: unknown[]; today: string }) => {
    splits: { teamId: string; splitValue: number }[];
  };
};

const KIN = 'venue-kinsmen', PERMIT = 'permit-milton';
const TEAMS = ['t11', 't13'];
const SIDE_A = 3, SIDE_B = 12;

const slot = (day: string, facilityId: string, teams: string[], mask = 0): { s: Slot; teams: string[] } => {
  const startMs = Date.parse(zonedWallClockToUtc(day, '18:00')!), endMs = Date.parse(zonedWallClockToUtc(day, '19:30')!);
  const weekday = weekdayOf(day);
  return {
    s: {
      key: slotKeyOf(KIN, facilityId, startMs, mask), venueId: KIN, facilityId, ...maskProp(mask), blockIndex: 0, day, weekday, week: mondayOfDay(day),
      startClock: '18:00', endClock: '19:30', startMs, endMs, pos: slotPosOf(weekday, '18:00', KIN, facilityId, mask), prime: false,
      weight: partFactor(mask), permitId: PERMIT,
    },
    teams,
  };
};

const contextOf = (rows: { s: Slot; teams: string[] }[], split = true) => ({
  orgId: 'org', orgName: 'Club', orgSlug: 'club', senderId: 'u', senderEmail: null, loaded: { row: { ends_on: '2027-06-30' } },
  teams: TEAMS.map(id => ({ id, name: id, groupId: null, groupName: null, color: null, groupOrder: 0, season: { id: `season-${id}`, name: '2027' } })),
  places: {
    byVenue: new Map([[KIN, ['ka', 'kb']]]), order: new Map(), venueName: new Map([[KIN, 'Kinsmen Park']]),
    facilityName: new Map([['ka', 'Diamond A'], ['kb', 'Diamond B']]), sectionsOf: new Map(split ? [['ka', 2 as const]] : []),
  },
  slots: rows.map(r => r.s),
  assignments: new Map(rows.map(r => [r.s.key, r.teams])),
  slotIdOf: new Map(rows.map((r, i) => [r.s.key, `slot-${i}-${r.s.day}${r.s.sectionMask ?? ''}`])),
  weightOf: () => 1,
  prices: { hourOf: () => 40, priceKeyOf: (p: string | null) => p, weightOf: () => 1 },
  venueAddress: new Map(),
});
const practicesOf = (c: ReturnType<typeof contextOf>) => c.slots.flatMap(s => (c.assignments.get(s.key) ?? []).map(t => ({
  id: `ev-${c.slotIdOf.get(s.key)}-${t}`, team_id: t, program_year_id: `season-${t}`, club_schedule_slot_id: c.slotIdOf.get(s.key)!,
  status: 'scheduled', starts_at: new Date(s.startMs).toISOString(), ends_at: new Date(s.endMs).toISOString(),
})));
/** What was sent, then what the schedule holds now, the slots keeping their ids. */
const planOf = (sentRows: { s: Slot; teams: string[] }[], nowRows: { s: Slot; teams: string[] }[]) => {
  const sent = contextOf(sentRows), now = contextOf(nowRows);
  now.slotIdOf = new Map([...now.slotIdOf.keys()].map(k => [k, sent.slotIdOf.get(k) ?? `new-${k}`]));
  return { now, plan: send.planChanges(now, practicesOf(sent)) };
};

describe('Send the changes says the part (2C part 2, a)', () => {
  it('the email’s pattern line names the side, joined with a comma, as the review card says it', () => {
    const c = contextOf([slot('2027-04-06', 'ka', ['t11'], SIDE_A), slot('2027-04-13', 'ka', ['t11'], SIDE_A)]);
    assert.deepEqual(send.patternsFor(c, 't11'), ['Tuesdays, 6:00–7:30 p.m. · Diamond A, side A, Apr 6 – 13']);
  });
  it('no split field: the pattern line is the field alone, exactly as before', () => {
    const c = contextOf([slot('2027-04-06', 'ka', ['t11']), slot('2027-04-13', 'ka', ['t11'])], false);
    assert.deepEqual(send.patternsFor(c, 't11'), ['Tuesdays, 6:00–7:30 p.m. · Diamond A, Apr 6 – 13']);
  });
  it('a side-only move is a move, and its line names both sides (the coach is told; families are not, owner 2026-11-26)', () => {
    const { plan } = planOf(
      [slot('2027-04-06', 'ka', ['t11'], SIDE_A), slot('2027-04-06', 'ka', [], SIDE_B)],
      [slot('2027-04-06', 'ka', [], SIDE_A), slot('2027-04-06', 'ka', ['t11'], SIDE_B)],
    );
    assert.equal(plan.updates.length, 1);
    const [change] = plan.byTeam.get('t11')!;
    assert.equal(change.kind, 'moved');
    assert.equal(change.fromPlace, 'Kinsmen Park · Diamond A, side A');
    assert.equal(change.toPlace, 'Kinsmen Park · Diamond A, side B');
  });
  it('a gain on a field not split names the park and the field, exactly as before', () => {
    const { plan } = planOf([], [slot('2027-04-06', 'kb', ['t11'])]);
    assert.deepEqual(plan.byTeam.get('t11')!.map(c => c.place), ['Kinsmen Park · Diamond B']);
  });
});

describe('Finding #56: a gained slot’s hours are the team’s share, sharing and parts alike', () => {
  /** Finalize's bill on what was sent: the shares and the rates it keeps. */
  const billBefore = (rows: { s: Slot; teams: string[] }[]) => {
    const b = priceTheBill(rows.map(r => ({ day: r.s.day, startMs: r.s.startMs, endMs: r.s.endMs, weight: r.s.weight, teamIds: r.teams, permitId: PERMIT })),
      { hourOf: () => 40, mode: 'one_rate', amount: null, teamOrder: TEAMS })!;
    return { before: Object.fromEntries(b.shares) as Record<string, number>, kept: { scale: b.rate, byPermit: b.rates } satisfies KeptRates };
  };
  const SENT = [slot('2027-04-06', 'kb', ['t11']), slot('2027-04-13', 'kb', ['t13'])];
  const hoursOf = (added: { s: Slot; teams: string[] }) => {
    const { before, kept } = billBefore(SENT);
    const { now, plan } = planOf(SENT, [...SENT, added]);
    const periods = paymentPeriods('monthly', { firstDue: '2027-04-01', dates: null, lastDay: '2027-06-30' });
    const money = send.changesMoney(now, plan, kept, before, [], { periods, today: '2027-03-01' });
    return Object.fromEntries(money.splits.map(s => [s.teamId, s.splitValue]));
  };
  it('a shared 1.5-hour slot gained by two teams records 0.75 hours each, not 1.5', () => {
    assert.deepEqual(hoursOf(slot('2027-04-20', 'kb', ['t11', 't13'])), { t11: 0.75, t13: 0.75 });
  });
  it('a slot shared with house league records the team’s half, as the bill counts it', () => {
    assert.deepEqual(hoursOf(slot('2027-04-20', 'kb', ['t11', 'house_league'])), { t11: 0.75 });
  });
  it('a side gained by one team records the same 0.75 hours', () => {
    assert.deepEqual(hoursOf(slot('2027-04-20', 'ka', ['t11'], SIDE_A)), { t11: 0.75 });
  });
  it('a whole field gained by one team records its 1.5 hours, as before', () => {
    assert.deepEqual(hoursOf(slot('2027-04-20', 'kb', ['t11'])), { t11: 1.5 });
  });
});
