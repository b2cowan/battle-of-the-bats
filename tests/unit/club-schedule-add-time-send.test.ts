import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { slotKeyOf, type Slot } from '../../lib/club-schedule-engine.ts';
import { paymentPeriods, priceTheBill, scaleOfHour, type BillSlot, type KeptRates, type PriceMode } from '../../lib/club-schedule-bill.ts';
import { mondayOfDay, zonedWallClockToUtc } from '../../lib/timezone.ts';
import { weekdayOf } from '../../lib/permit-time.ts';
import { billingTestLoader } from './_billing-test-loader.ts';

/**
 * P9 B THROUGH THE REAL SEND PATH (a schedule on several permits, Session E; owner ruling 2026-11-14, quoted in the build
 * prompt: "The previous payments stay the same and just the new amounts are added to the impacted coaches' payments. It's
 * basically a new separate permit that wants to be part of the same schedule."). The send's own planning (`planChanges`:
 * what the teams were sent against what the schedule holds now) and its own money (`changesMoney`: the kept rates, the
 * teams it touches, the correction and its payments) — the functions Send the changes calls, loaded with the database
 * stubbed out. Fixture: Milton $40 an hour and Halton Hills $60 billed at Finalize; Milton June ($50) added by Add time.
 *
 * ⚖ PHASE 8 (Session 3, 2026-11-17): ADD TIME NO LONGER REACHES THIS PATH. It makes a part of its own, with a bill of its own
 * at Send the changes (tests/unit/club-schedule-family-send.test.ts; the database half, two allocations and the schedule's
 * payments byte-identical, tests/sql/schedule-part-send-fixture.sql). The path stays for time that still lands on the
 * schedule itself on a permit not behind its bill — Settings… on a FINAL schedule can still add a typed row (Session 2's
 * review, open item 1: the owner's call whether to refuse it). Retire `fresh` and this file with that call.
 */

const stub = new Proxy({}, { get: () => () => { throw new Error('no database in this test'); } });
const send = billingTestLoader({ './supabase-admin': { supabaseAdmin: stub }, '@/lib/supabase-admin': { supabaseAdmin: stub } })('lib/club-schedule-send.ts') as {
  planChanges: (c: unknown, practices: unknown[]) => { byTeam: Map<string, unknown[]>; gainedSlots: Map<string, BillSlot[]>; inserts: { teamId: string }[]; retire: string[]; updates: unknown[] };
  changesMoney: (c: unknown, plan: unknown, kept: KeptRates, before: Record<string, number>, handBacks: unknown[], o: { periods: unknown[]; today: string }) => {
    now: Map<string, number>; correction: { gains: Map<string, number>; losses: Map<string, number> }; fresh: Map<string, number>;
    splits: { teamId: string; amount: number; programYearId: string; installments: { amount: number; dueDate: string }[] }[];
  };
};

const KIN = 'venue-kinsmen', PRO = 'venue-prospect';
const MILTON = 'permit-milton', HALTON = 'permit-halton', JUNE = 'permit-june';
const HOUR: Record<string, number> = { [MILTON]: 40, [HALTON]: 60, [JUNE]: 50 };
const TEAMS = ['t11', 't13', 't15'];
const TODAY = '2027-05-20';

const slot = (day: string, venueId: string, facilityId: string, permitId: string, teams: string[]): { s: Slot; teams: string[] } => {
  const startMs = Date.parse(zonedWallClockToUtc(day, '18:00')!), endMs = Date.parse(zonedWallClockToUtc(day, '19:30')!);
  const weekday = weekdayOf(day);
  return {
    s: {
      key: slotKeyOf(venueId, facilityId, startMs), venueId, facilityId, blockIndex: 0, day, weekday, week: mondayOfDay(day),
      startClock: '18:00', endClock: '19:30', startMs, endMs, pos: `${weekday}|18:00|${venueId}|${facilityId}`, prime: false, weight: 1, permitId,
    },
    teams,
  };
};
/** The schedule as sent: Milton (Kinsmen) Tuesdays in April and May, Halton Hills (Prospect) Mondays; one shared evening. */
const SENT = [
  slot('2027-04-06', KIN, 'ka', MILTON, ['t11']), slot('2027-04-13', KIN, 'ka', MILTON, ['t13']), slot('2027-04-20', KIN, 'ka', MILTON, ['t11', 't13']),
  slot('2027-05-04', KIN, 'ka', MILTON, ['t11']), slot('2027-05-11', KIN, 'ka', MILTON, ['t13']), slot('2027-05-25', KIN, 'ka', MILTON, ['t11']),
  slot('2027-04-05', PRO, 'pa', HALTON, ['t15']), slot('2027-04-12', PRO, 'pa', HALTON, ['t13']), slot('2027-05-03', PRO, 'pa', HALTON, ['t15']),
];
/** Add time: Milton June's Thursdays at Kinsmen — two for 11U, one for 15U. 13U gets nothing new. */
const JUNE_ADDED = [slot('2027-06-03', KIN, 'kb', JUNE, ['t11']), slot('2027-06-10', KIN, 'kb', JUNE, ['t15']), slot('2027-06-17', KIN, 'kb', JUNE, ['t11'])];

const contextOf = (rows: { s: Slot; teams: string[] }[]) => ({
  orgId: 'org', orgName: 'Club', orgSlug: 'club', senderId: 'u', senderEmail: null, loaded: { row: { ends_on: '2027-06-30' } },
  teams: TEAMS.map(id => ({ id, name: id, groupId: null, groupName: null, color: null, groupOrder: 0, season: { id: `season-${id}`, name: '2027' } })),
  places: { byVenue: new Map([[KIN, ['ka', 'kb']], [PRO, ['pa']]]), order: new Map(), venueName: new Map([[KIN, 'Kinsmen Park'], [PRO, 'Prospect Park']]), facilityName: new Map([['ka', 'Diamond A'], ['kb', 'Diamond B'], ['pa', 'Diamond 1']]) },
  slots: rows.map(r => r.s),
  assignments: new Map(rows.map(r => [r.s.key, r.teams])),
  slotIdOf: new Map(rows.map((r, i) => [r.s.key, `slot-${i}-${r.s.day}`])),
  weightOf: () => 1,
  prices: { hourOf: (id: string) => HOUR[id] ?? null, priceKeyOf: (p: string | null) => p, weightOf: () => 1 },
  venueAddress: new Map(),
});
/** What each team was sent: one practice per team per slot. */
const practicesOf = (c: ReturnType<typeof contextOf>) => c.slots.flatMap(s => (c.assignments.get(s.key) ?? []).map(t => ({
  id: `ev-${c.slotIdOf.get(s.key)}-${t}`, team_id: t, program_year_id: `season-${t}`, club_schedule_slot_id: c.slotIdOf.get(s.key)!,
  status: 'scheduled', starts_at: new Date(s.startMs).toISOString(), ends_at: new Date(s.endMs).toISOString(),
})));
const billSlots = (rows: { s: Slot; teams: string[] }[]): BillSlot[] =>
  rows.map(r => ({ day: r.s.day, startMs: r.s.startMs, endMs: r.s.endMs, weight: 1, teamIds: r.teams, permitId: r.s.permitId ?? null }));

/** Finalize: the bill made on what was sent — the shares (`team_values`) and the rates it keeps. */
const finalize = (mode: PriceMode) => {
  const b = priceTheBill(billSlots(SENT), { hourOf: id => HOUR[id] ?? null, mode, amount: null, teamOrder: TEAMS })!;
  return { before: Object.fromEntries(b.shares) as Record<string, number>, kept: { scale: b.rate, byPermit: b.rates } satisfies KeptRates };
};
/** Send the changes, as the send runs it: what changed against what was sent, then its money. */
const sendChanges = (mode: PriceMode, after: { s: Slot; teams: string[] }[]) => {
  const { before, kept } = finalize(mode);
  const frozen = structuredClone(before);
  const sent = contextOf(SENT), now = contextOf(after);
  // The practices keep their slot ids: the schedule's own slots keep theirs through Add time (same place, same start).
  now.slotIdOf = new Map([...now.slotIdOf.keys()].map(k => [k, sent.slotIdOf.get(k) ?? `new-${k}`]));
  const plan = send.planChanges(now, practicesOf(sent));
  const periods = paymentPeriods('monthly', { firstDue: '2027-04-01', dates: null, lastDay: '2027-06-30' });
  const money = send.changesMoney(now, plan, kept, before, [], { periods, today: TODAY });
  return { before, frozen, plan, money };
};
/** 1.5 hours × that permit's hour, in cents, per added evening. */
const evening = (permit: string) => Math.round(1.5 * HOUR[permit] * 100);

describe('Add time on a billed schedule, sent: the new permit bills at its own price; nothing already billed moves (P9 B)', () => {
  for (const mode of ['one_rate', 'each_permit'] as const) {
    it(`${mode}: the earlier shares are byte-identical, and each touched team's new amount is the new permit's price × its added hours`, () => {
      const { before, frozen, plan, money } = sendChanges(mode, [...SENT, ...JUNE_ADDED]);
      // What the send plans: three new practices, nothing moved, nothing retired.
      assert.equal(plan.inserts.length, 3);
      assert.equal(plan.updates.length, 0);
      assert.deepEqual(plan.retire, []);
      // The first bill is never recalculated.
      assert.deepEqual(before, frozen);
      assert.equal(money.now.get('t13'), before.t13, '13U gained nothing: its value is untouched to the cent');
      // The new amounts, on the teams the new time reaches only: Milton June's $50 × the added hours.
      assert.deepEqual([...money.correction.gains].sort(), [['t11', 2 * evening(JUNE)], ['t15', evening(JUNE)]]);
      assert.equal(money.correction.losses.size, 0);
      for (const t of ['t11', 't15']) assert.equal(money.now.get(t), before[t] + money.correction.gains.get(t)!);
      // Milton June's price is kept from this send on.
      assert.deepEqual([...money.fresh], [[JUNE, scaleOfHour(50)]]);
      // Each new amount is its own correction, on the team's running season, with its own payments adding up to the cent.
      for (const s of money.splits) {
        assert.equal(s.programYearId, `season-${s.teamId}`);
        assert.equal(Math.round(s.installments.reduce((a, i) => a + i.amount, 0) * 100), money.correction.gains.get(s.teamId));
        assert.ok(s.installments.every(i => i.dueDate >= TODAY), 'no new payment is due before today');
      }
    });
  }
  it('one rate: more evenings on a permit already behind the bill bill at the one rate (its term), and nothing is kept new', () => {
    const { kept } = finalize('one_rate');
    const more = slot('2027-06-01', KIN, 'ka', MILTON, ['t13']);
    const { money } = sendChanges('one_rate', [...SENT, more]);
    assert.deepEqual([...money.correction.gains], [['t13', Math.round(90 * kept.scale)]]);
    assert.equal(money.fresh.size, 0);
  });
  it('each permit’s price: more evenings on Milton bill at Milton’s kept rate', () => {
    const more = slot('2027-06-01', KIN, 'ka', MILTON, ['t13']);
    const { money } = sendChanges('each_permit', [...SENT, more]);
    assert.deepEqual([...money.correction.gains], [['t13', evening(MILTON)]]);
  });
});

describe('a permit taken off a sent schedule (P11 A): its practices from today on are credited; played ones and their bill stay', () => {
  for (const mode of ['one_rate', 'each_permit'] as const) {
    it(`${mode}: only Halton Hills' evening after today comes off, credited at the rate it was billed at`, () => {
      const { kept } = finalize(mode);
      // Taken off on May 1: April's Halton Hills evenings were played and stay; May 3's comes off.
      const left = SENT.filter(r => !(r.s.permitId === HALTON && r.s.day >= '2027-05-01'));
      const { before, frozen, money } = sendChanges(mode, left);
      assert.deepEqual(before, frozen);
      assert.deepEqual([...money.correction.losses], [['t15', Math.round(90 * (kept.byPermit.get(HALTON) ?? kept.scale))]]);
      assert.equal(money.correction.gains.size, 0);
      assert.equal(money.now.get('t11'), before.t11);
      assert.equal(money.now.get('t13'), before.t13);
    });
  }
});
