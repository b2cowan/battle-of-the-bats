import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { billingTestLoader } from './_billing-test-loader.ts';
import { functionBody, readCode } from './_source-code.ts';

/**
 * Plans & pricing Stage 0, Part 5 (fix 2): a replaced Stripe price stays recognised. The trigger that records a replaced
 * id is proved on the database by scripts/stripe-price-retired-check.sql (replace → recorded; a note change → nothing).
 * Prompt: docs/projects/active/PLANS_PRICING_STAGE0_BUILD_PROMPT.md.
 */

type Row = Record<string, string>;
type Tables = { stripe_prices?: Row[]; stripe_price_ids_retired?: Row[]; fail?: string };

/** The few query-builder steps these reads use, over in-memory rows. `fail` names a table whose read errors. */
function fakeSupabase(tables: Tables) {
  const reads: Array<{ table: string; filters: Array<[string, string]> }> = [];
  const from = (table: string) => {
    const filters: Array<[string, string]> = [];
    reads.push({ table, filters });
    const rows = () => ((tables as Record<string, Row[]>)[table] ?? []).filter(r => filters.every(([k, v]) => r[k] === v));
    const answer = (data: unknown) => tables.fail === table ? { data: null, error: { message: `${table} is down` } } : { data, error: null };
    const b = {
      select: () => b,
      eq: (k: string, v: string) => { filters.push([k, v]); return b; },
      not: () => b,
      limit: () => b,
      maybeSingle: async () => answer(rows()[0] ?? null),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(answer(rows())).then(resolve),
    };
    return b;
  };
  return { client: { from }, reads };
}

function load(tables: Tables) {
  const fake = fakeSupabase(tables);
  const loader = billingTestLoader({ './supabase-admin': { supabaseAdmin: fake.client } });
  const prices = loader('lib/stripe-prices.ts') as typeof import('../../lib/stripe-prices.ts');
  return { ...prices, reads: fake.reads };
}

const SLOT = { plan_id: 'club', billing_cycle: 'annual', environment: 'sandbox', price_id: 'price_now' };
const OLD = { plan_id: 'club', billing_cycle: 'annual', environment: 'sandbox', price_id: 'price_before' };

describe('getPlanFromPriceId', () => {
  const key = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';

  it('a current slot resolves, not marked retired', async () => {
    const p = load({ stripe_prices: [SLOT], stripe_price_ids_retired: [OLD] });
    assert.deepEqual(await p.getPlanFromPriceId('price_now'), { planId: 'club', billingCycle: 'annual', retired: false });
  });
  it('a replaced id still resolves to its plan and cycle', async () => {
    const p = load({ stripe_prices: [SLOT], stripe_price_ids_retired: [OLD] });
    assert.deepEqual(await p.getPlanFromPriceId('price_before'), { planId: 'club', billingCycle: 'annual', retired: true });
  });
  it('an unknown id is "no such price"', async () => {
    const p = load({ stripe_prices: [SLOT], stripe_price_ids_retired: [OLD] });
    assert.equal(await p.getPlanFromPriceId('price_never'), null);
  });
  it('a failed lookup is NOT "no such price": it throws', async () => {
    await assert.rejects(load({ stripe_prices: [SLOT], fail: 'stripe_prices' }).getPlanFromPriceId('price_now'), /down/);
    await assert.rejects(load({ stripe_prices: [], fail: 'stripe_price_ids_retired' }).getPlanFromPriceId('price_before'), /down/);
  });
  it('reads only the current key\'s mode', async () => {
    const p = load({ stripe_prices: [{ ...SLOT, environment: 'live' }], stripe_price_ids_retired: [{ ...OLD, environment: 'live' }] });
    assert.equal(await p.getPlanFromPriceId('price_now'), null);
    assert.equal(await p.getPlanFromPriceId('price_before'), null);
    assert.ok(p.reads.every(r => r.filters.some(([k, v]) => k === 'environment' && v === 'sandbox')));
  });

  process.env.STRIPE_SECRET_KEY = key;
});

describe('the Money tab and the webhook recognise it too', () => {
  it('priceMap reads the replaced prices, and a current slot wins over a retired row', () => {
    const body = functionBody(readCode('lib/console-money-store.ts'), 'priceMap');
    assert.match(body, /stripe_price_ids_retired/);
    assert.ok(body.indexOf('retired.data') < body.indexOf('current.data', body.indexOf('retired.data')), 'current rows come last, so they win');
  });
  it('the webhook speaks up about a price no slot has ever used, and changes nothing', () => {
    const route = readCode('app/api/billing/webhook/route.ts');
    assert.match(route, /\} else if \(priceId\) \{\s*await tellOwnerOfUnrecognisedPrice\(sub, priceId, customerId\)/);
    const tell = functionBody(route, 'tellOwnerOfUnrecognisedPrice');
    assert.match(tell, /unrecognised_price:\$\{new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\}/, 'once per subscription per day');
    assert.doesNotMatch(tell, /\.update\(|subscriptions\.(cancel|update)/, 'nothing acts on it');
  });
});
