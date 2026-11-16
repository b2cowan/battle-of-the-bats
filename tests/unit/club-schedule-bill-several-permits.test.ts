import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  billCorrections, billShares, keptRateOf, priceTheBill, pricedMinutes, pricedMinutesByPermit, pricedValues, scaleOfHour,
  sharesAtRates, teamInstallments, uniformRate, valuesAfterChanges, type BillSlot, type KeptRates, type PriceMode,
} from '../../lib/club-schedule-bill.ts';

/**
 * THE BILL ON SEVERAL PERMITS — the money-arithmetic gate (a schedule on several permits, Session C; plan §4e; build prompt
 * "P9 B"). Two towns: Milton's diamonds cost $60.00 a full field an hour (100 c a minute), Halton Hills' $90.00 (150 c).
 * Three teams, one-hour practices on full fields:
 *   A · two at Milton (120 min)            → $120.00 at each permit's price
 *   B · one at Milton, one at Halton Hills → $150.00
 *   C · two at Halton Hills                → $180.00
 * The time costs $450.00 over 360 priced minutes: one rate is 125 c a minute ($75.00 an hour) → $150.00 each.
 * Later, a third permit (Georgetown, $120.00 an hour, 200 c) adds an hour to A — a permit that was NOT behind the bill.
 */

const H = 3_600_000;
const day = (i: number) => `2027-04-${String(10 + i).padStart(2, '0')}`;
let n = 0;
const slot = (permitId: string | null, teamIds: string[], weight = 1, at = n++): BillSlot =>
  ({ day: day(at), startMs: at * 2 * H, endMs: at * 2 * H + H, weight, teamIds, permitId });
const HOUR = new Map<string, number>([['milton', 60], ['halton', 90], ['georgetown', 120]]);
const hourOf = (p: string) => HOUR.get(p) ?? null;
const ORDER = ['tA', 'tB', 'tC'];
const SLOTS: BillSlot[] = [
  slot('milton', ['tA']), slot('milton', ['tA']),
  slot('milton', ['tB']), slot('halton', ['tB']),
  slot('halton', ['tC']), slot('halton', ['tC']),
];
const bill = (mode: PriceMode, amount: number | null = null, slots = SLOTS) => priceTheBill(slots, { hourOf, mode, amount, teamOrder: ORDER })!;
const sum = (m: ReadonlyMap<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe('one price behind the time: exactly the bill before Session C', () => {
  it('a one-permit schedule bills to the cent what billShares billed (both modes)', () => {
    const one = [slot('milton', ['tA']), slot('milton', ['tA', 'tB']), slot('milton', ['tC'], 0.5), slot(null, ['tC'])].map(s => ({ ...s, permitId: s.permitId ?? 'milton' }));
    const before = billShares(pricedMinutes(one), { fullHour: 60, amount: null, teamOrder: ORDER })!;
    for (const mode of ['each_permit', 'one_rate'] as const) {
      const now = priceTheBill(one, { hourOf, mode, amount: null, teamOrder: ORDER })!;
      assert.equal(now.multiPrice, false);
      assert.deepEqual([...now.shares], [...before.shares]);
      assert.equal(now.totalCents, before.totalCents);
      assert.equal(now.rate, before.rate);
      assert.equal(now.paymentWeight, undefined);
      assert.deepEqual([...now.rates], [['milton', before.rate]]);
    }
  });
  it('two permits at the same hour are one price', () => {
    const same = [slot('milton', ['tA']), slot('other', ['tB'])];
    const b = priceTheBill(same, { hourOf: () => 60, mode: 'each_permit', amount: null, teamOrder: ORDER })!;
    assert.equal(b.multiPrice, false);
    assert.equal(b.totalCents, 12000);
  });
  it('time a permit cannot price is billed only by a typed amount, by priced time', () => {
    const mixed = [slot('milton', ['tA']), slot(null, ['tB'])];
    assert.equal(priceTheBill(mixed, { hourOf, mode: 'each_permit', amount: null, teamOrder: ORDER }), null);
    const typed = priceTheBill(mixed, { hourOf, mode: 'each_permit', amount: 100, teamOrder: ORDER })!;
    assert.equal(typed.multiPrice, false);
    assert.deepEqual([...typed.shares], [['tA', 5000], ['tB', 5000]]);
  });
});

describe('each permit’s price, or one rate (P1 A, P3 A)', () => {
  it('each permit’s price: a slot costs what its permit charges', () => {
    const b = bill('each_permit');
    assert.equal(b.multiPrice, true);
    assert.deepEqual([...b.shares], [['tA', 12000], ['tB', 15000], ['tC', 18000]]);
    assert.equal(b.timePriceCents, 45000);
  });
  it('one rate: the same total, re-shared by hours', () => {
    const b = bill('one_rate');
    assert.deepEqual([...b.shares], [['tA', 15000], ['tB', 15000], ['tC', 15000]]);
    assert.equal(b.rate, 125);
  });
  it('the two ways total the same, and every team’s shares add up to it to the cent', () => {
    const e = bill('each_permit'), o = bill('one_rate');
    assert.equal(e.totalCents, o.totalCents);
    assert.equal(sum(e.shares), e.totalCents);
    assert.equal(sum(o.shares), o.totalCents);
  });
  it('a typed part is shared by what each team’s time costs (each) or by hours (one rate)', () => {
    const e = bill('each_permit', 300), o = bill('one_rate', 300);
    assert.deepEqual([...e.shares], [['tA', 8000], ['tB', 10000], ['tC', 12000]]);
    assert.deepEqual([...o.shares], [['tA', 10000], ['tB', 10000], ['tC', 10000]]);
    assert.equal(e.timePriceCents, 45000);
  });
  it('an awkward part still adds up to the cent', () => {
    for (const mode of ['each_permit', 'one_rate'] as const) {
      const b = bill(mode, 333.33);
      assert.equal(sum(b.shares), 33333);
    }
  });
  it('the rates kept price the bill exactly: Σ priced minutes × the kept rate = the total', () => {
    for (const [mode, amount] of [['each_permit', null], ['one_rate', null], ['each_permit', 300], ['one_rate', 300]] as const) {
      const b = bill(mode, amount);
      const values = pricedValues(SLOTS, s => b.rates.get(s.permitId!)!);
      assert.ok(Math.abs(sum(values) - b.totalCents) < 1e-6, `${mode} ${amount}`);
    }
    assert.deepEqual([...bill('each_permit').rates], [['milton', 100], ['halton', 150]]);
    assert.deepEqual([...bill('each_permit', 300).rates].map(([p, r]) => [p, Math.round(r * 1e6) / 1e6]), [['milton', 66.666667], ['halton', 100]]);
    assert.deepEqual([...bill('one_rate').rates], [['milton', 125], ['halton', 125]]);
  });
  it('each permit’s price: a team’s payments follow what its time costs in each period', () => {
    const b = bill('each_permit');
    const periods = [{ due: '2027-04-01', from: '0000-01-01', until: day(3) }, { due: day(3), from: day(3), until: null }];
    // B: its Milton hour falls in the first period ($60.00), its Halton Hills hour in the second ($90.00).
    const pays = teamInstallments('tB', b.shares.get('tB')!, SLOTS, periods, b.paymentWeight);
    assert.deepEqual(pays.map(p => p.amount), [60, 90]);
    // At one rate (no weight), the same two hours are two equal payments.
    assert.deepEqual(teamInstallments('tB', 15000, SLOTS, periods).map(p => p.amount), [75, 75]);
  });
  it('hours by permit, for each team’s caption', () => {
    const by = pricedMinutesByPermit(SLOTS);
    assert.deepEqual([...by.get('tB')!], [['milton', 60], ['halton', 60]]);
  });
});

describe('a bill already made: kept rates, and a permit added later (P9 B)', () => {
  const madeFrom = (mode: PriceMode) => {
    const b = bill(mode);
    return { before: Object.fromEntries(b.shares) as Record<string, number>, kept: { scale: b.rate, byPermit: b.rates } satisfies KeptRates };
  };
  /** Send the changes as the send path runs it: measure each team at the kept rates, re-value only the touched teams. */
  const send = (kept: KeptRates, before: Record<string, number>, slots: BillSlot[], touched: string[]) => {
    const { rateOf, fresh } = keptRateOf(kept, hourOf);
    const minutes = pricedMinutes(slots), values = pricedValues(slots, rateOf);
    const now = valuesAfterChanges(before, sharesAtRates({ minutes, values }, uniformRate(slots, rateOf), ORDER), new Set(touched));
    return { now, ...billCorrections(before, now), fresh };
  };
  const added = slot('georgetown', ['tA']);

  for (const mode of ['one_rate', 'each_permit'] as const) {
    it(`${mode}: the new permit's time is billed at that permit's own price; nothing earlier moves`, () => {
      const { before, kept } = madeFrom(mode);
      const frozen = structuredClone(before);
      const r = send(kept, before, [...SLOTS, added], ['tA']);
      // The earlier shares are byte-identical: the first bill is never recalculated.
      assert.deepEqual(before, frozen);
      assert.equal(r.now.get('tB'), before.tB);
      assert.equal(r.now.get('tC'), before.tC);
      // The added amount = Georgetown's price × the added priced hours ($120.00 × 1), a new amount on A only.
      assert.deepEqual([...r.gains], [['tA', 12000]]);
      assert.equal(r.losses.size, 0);
      assert.equal(r.now.get('tA'), before.tA + 12000);
      // Georgetown's price is kept from this send on.
      assert.deepEqual([...r.fresh], [['georgetown', scaleOfHour(120)]]);
    });
  }
  it('one rate: more evenings on a permit already behind the bill bill at the one rate (its term)', () => {
    const { before, kept } = madeFrom('one_rate');
    const r = send(kept, before, [...SLOTS, slot('milton', ['tA'])], ['tA']);
    assert.deepEqual([...r.gains], [['tA', 7500]]);
    assert.equal(r.fresh.size, 0);
  });
  it('each permit’s price: more evenings on Halton Hills bill at its kept rate', () => {
    const { before, kept } = madeFrom('each_permit');
    const r = send(kept, before, [...SLOTS, slot('halton', ['tA'])], ['tA']);
    assert.deepEqual([...r.gains], [['tA', 9000]]);
  });
  it('a lost hour is credited at the rate it was billed at', () => {
    const { before, kept } = madeFrom('each_permit');
    const r = send(kept, before, SLOTS.filter((_, i) => i !== 5), ['tC']);
    assert.deepEqual([...r.losses], [['tC', 9000]]);
  });
  it('a bill made before Session C (no kept rates) prices every slot at its rate — never “a new permit”', () => {
    const kept: KeptRates = { scale: 125, byPermit: new Map() };
    const { rateOf, fresh } = keptRateOf(kept, hourOf);
    assert.equal(rateOf(added), 125);
    assert.equal(fresh.size, 0);
  });
  it('a slot no permit prices bills at the bill’s rate', () => {
    const { rateOf } = keptRateOf({ scale: 125, byPermit: new Map([['milton', 100]]) }, hourOf);
    assert.equal(rateOf(slot(null, ['tA'])), 125);
  });
  it('at one kept rate the correction is exactly the single-rate path', () => {
    const { kept } = madeFrom('one_rate');
    const { rateOf } = keptRateOf(kept, hourOf);
    assert.equal(uniformRate(SLOTS, rateOf), 125);
  });
});

describe('/review (Session C): time that is on no bill, and a permit with no price to keep', () => {
  it('house league time on a permit never billed earns it no kept rate and keeps a one-rate bill on one rate', () => {
    const { rateOf, fresh } = keptRateOf({ scale: 100, byPermit: new Map([['milton', 100]]) }, hourOf);
    const hl = slot('halton', ['house_league']);
    assert.equal(rateOf(hl), 100);
    assert.equal(fresh.size, 0);
    assert.equal(uniformRate([slot('milton', ['tA']), hl], rateOf), 100);
  });
  it('a $0 permit beside a priced one is not wholly priced: no bill without a typed amount, never a rate of 0', () => {
    const free = (p: string) => (p === 'free' ? 0 : hourOf(p));
    const slots = [slot('free', ['tA']), slot('milton', ['tB'])];
    assert.equal(priceTheBill(slots, { hourOf: free, mode: 'each_permit', amount: null, teamOrder: ORDER }), null);
    const typed = priceTheBill(slots, { hourOf: free, mode: 'each_permit', amount: 100, teamOrder: ORDER })!;
    assert.equal(typed.totalCents, 10000);
    assert.equal(typed.multiPrice, false);
    assert.ok([...typed.rates.values()].every(r => r > 0));
  });
});
