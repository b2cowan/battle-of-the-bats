import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type Stripe from 'stripe';
import { readClubMoney } from '../../lib/console-money-stripe.ts';
import { moneyBand, subscriptionsMoreWords, type MoneyRead } from '../../lib/console-money.ts';
import { functionBody, readCode } from './_source-code.ts';

/**
 * Plans & pricing Stage 0, Part 8 (fix 3): the Money tab's next charge tells "None" apart from "Stripe could not be asked",
 * and the subscription list pages instead of stopping at 20.
 */

const NOW = new Date('2026-11-01T15:00:00.000Z');
const unix = (iso: string) => Math.floor(Date.parse(iso) / 1000);

function sub(id: string, status: string, over: Partial<Record<string, unknown>> = {}) {
  return {
    id, status, created: unix('2026-01-01T00:00:00.000Z'), cancel_at_period_end: false, ended_at: null, canceled_at: null, trial_end: null,
    items: { data: [{ current_period_end: unix('2026-12-01T13:00:00.000Z'), price: { id: 'price_x', unit_amount: 3900, currency: 'cad', recurring: { interval: 'month' } } }] },
    ...over,
  };
}
const list = <T>(data: T[], has_more = false) => Promise.resolve({ object: 'list', data, has_more, url: '' });

function fakeStripe(o: { pages: Array<ReturnType<typeof sub>[]>; preview?: () => Promise<unknown> }) {
  const calls: Array<string | undefined> = [];
  const stripe = {
    customers: { retrieve: () => Promise.resolve({ id: 'cus_1', email: null, invoice_settings: { default_payment_method: null } }) },
    subscriptions: {
      list: (p: { starting_after?: string }) => {
        calls.push(p.starting_after);
        const i = calls.length - 1;
        return list(o.pages[i] ?? [], i < o.pages.length - 1);
      },
    },
    charges: { list: () => list([]) },
    invoices: {
      list: () => list([]),
      createPreview: o.preview ?? (() => Promise.resolve({ amount_due: 3900, currency: 'cad', next_payment_attempt: unix('2026-12-01T13:00:00.000Z') })),
    },
  };
  return { stripe: stripe as unknown as Stripe, calls };
}
const read = (s: Stripe) => readClubMoney(s, 'cus_1', { prices: new Map(), testMode: true, now: NOW });

describe('the next charge is one of three answers', () => {
  it('Stripe previews it: the amount and the date', async () => {
    const r = await read(fakeStripe({ pages: [[sub('sub_1', 'active')]] }).stripe);
    assert.deepEqual(r.nextCharge, { kind: 'charge', amountCents: 3900, currency: 'cad', at: '2026-12-01T13:00:00.000Z' });
  });
  it('no live subscription: none, and Stripe is not asked for a preview', async () => {
    let asked = false;
    const r = await read(fakeStripe({ pages: [[sub('sub_1', 'canceled')]], preview: () => { asked = true; return Promise.reject(new Error('no')); } }).stripe);
    assert.deepEqual(r.nextCharge, { kind: 'none' });
    assert.equal(asked, false);
  });
  it('the preview fails: "could not be read", never none, and the tab still reads', async () => {
    const r = await read(fakeStripe({ pages: [[sub('sub_1', 'active')]], preview: () => Promise.reject(new Error('Stripe is down')) }).stripe);
    assert.deepEqual(r.nextCharge, { kind: 'unread' });
    assert.equal(r.subscriptions.length, 1);
  });
});

describe('the subscriptions page past 20', () => {
  it('the live subscription on a later page is found, and the preview is asked for it', async () => {
    const first = Array.from({ length: 100 }, (_, i) => sub(`sub_old_${i}`, 'canceled'));
    let previewed: string | undefined;
    const f = fakeStripe({ pages: [first, [sub('sub_live', 'active')]], preview: (async (p: { subscription: string }) => {
      previewed = p.subscription; return { amount_due: 3900, currency: 'cad', next_payment_attempt: unix('2026-12-01T13:00:00.000Z') };
    }) as () => Promise<unknown> });
    const r = await read(f.stripe);
    assert.equal(r.subscriptions.length, 101);
    assert.equal(previewed, 'sub_live');
    assert.equal(r.nextCharge.kind, 'charge');
    assert.deepEqual(f.calls, [undefined, 'sub_old_99'], 'the second page starts after the last one read');
    assert.equal(r.subscriptionsMore, false);
  });
  it('past the ceiling, the read says there are more', async () => {
    const page = (n: number) => Array.from({ length: 100 }, (_, i) => sub(`sub_${n}_${i}`, 'canceled'));
    const r = await read(fakeStripe({ pages: [page(1), page(2), page(3), page(4)] }).stripe);
    assert.equal(r.subscriptions.length, 300);
    assert.equal(r.subscriptionsMore, true);
    // None live among the 300 read, but Stripe holds more: not asked about the rest, so "Not read", never "None".
    assert.deepEqual(r.nextCharge, { kind: 'unread' });
    assert.match(subscriptionsMoreWords(r.subscriptions.length), /more than 300 subscriptions.*newest 300 were read/);
  });
  it('the source pages the subscription list and never swallows a failed preview into null', () => {
    const body = functionBody(readCode('lib/console-money-stripe.ts'), 'readClubMoney');
    assert.doesNotMatch(body, /limit: 20\b/);
    assert.match(body, /listAll<Stripe\.Subscription>/);
    assert.doesNotMatch(body, /\.catch\(\(\) => null\)/);
  });
});

describe('the band words each answer', () => {
  const base: MoneyRead = { readAt: NOW.toISOString(), testMode: true, customer: { id: 'cus_1', email: null }, card: null, charges: [], olderBefore: null, subscriptionsMore: false, subscriptions: [], nextCharge: { kind: 'none' } };
  const cell = (r: MoneyRead) => moneyBand(r, '2025-11-01T15:00:00.000Z').find(b => b.label === 'Next charge')!;
  it('none: "None · no live subscription"', () => {
    assert.deepEqual(cell(base), { label: 'Next charge', value: 'None', note: 'no live subscription' });
  });
  it('none on a subscription that ends at the period end says so', () => {
    const ending = { ...base, subscriptions: [{ id: 'sub_1', status: 'active', planId: null, cycle: 'monthly', amountCents: 3900, currency: 'cad', currentPeriodEnd: null, createdAt: NOW.toISOString(), cancelAtPeriodEnd: true, endedAt: null }] };
    assert.equal(cell(ending).note, 'it ends at the period end');
  });
  it('unread: "Not read", a warning, and the plain sentence that points at Read again', () => {
    assert.deepEqual(cell({ ...base, nextCharge: { kind: 'unread' } }),
      { label: 'Next charge', value: 'Not read', note: 'Stripe could not be asked for the next charge. Read again.', tone: 'warn' });
  });
  it('a charge: the amount and the day', () => {
    const c = cell({ ...base, nextCharge: { kind: 'charge', amountCents: 3900, currency: 'cad', at: '2026-12-01T13:00:00.000Z' } });
    assert.equal(c.value, '$39.00');
    assert.match(c.note, /^on /);
  });
});
