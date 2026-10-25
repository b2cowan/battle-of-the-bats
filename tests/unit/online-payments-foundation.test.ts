import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ONLINE_PAYMENT_RATES, onlineFeeRateLabel } from '../../lib/plan-config.ts';
import { onlineFee, toCents } from '../../lib/online-payment-fee.ts';
import { hasPlanFeature } from '../../lib/plan-features.ts';
import { onlinePaymentsOn, LIVE_PAYMENTS_ALLOWED, stripeKeyIsTest } from '../../lib/online-payments-switch.ts';

/**
 * Club Tier Stage 12a, Part 1: the rates, the fee arithmetic, the gate and the launch switch.
 * Plan: docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md (§0b, §0c, §7).
 */

const ROOT = process.cwd();

/** The rates as the Facts doc states them — the canonical record. The config may not drift from it. */
function factsRates() {
  const facts = readFileSync(path.join(ROOT, 'docs/agents/strategy/PLAN_PRICING_FACTS.md'), 'utf8');
  const m = facts.match(/cards (\d+(?:\.\d+)?)% \+ \$(\d+\.\d\d) all-in · bank debit \(ACSS\/PAD\) (\d+(?:\.\d+)?)% \+ \$(\d+\.\d\d) all-in/);
  assert.ok(m, 'Facts doc: the facilitated-payments rate line was not found — the build will not invent a rate');
  return {
    card: { pctBps: Math.round(Number(m[1]) * 100), flatCents: Math.round(Number(m[2]) * 100) },
    bankDebit: { pctBps: Math.round(Number(m[3]) * 100), flatCents: Math.round(Number(m[4]) * 100) },
  };
}

describe('online payment rates are the Facts doc’s', () => {
  it('lib/plan-config.ts carries exactly the Facts doc line', () => {
    assert.deepEqual(
      { card: { ...ONLINE_PAYMENT_RATES.card }, bankDebit: { ...ONLINE_PAYMENT_RATES.bankDebit } },
      factsRates(),
    );
  });

  it('the label prints the rate from config', () => {
    const r = factsRates().card;
    assert.equal(onlineFeeRateLabel('card'), `${r.pctBps / 100}% + $${(r.flatCents / 100).toFixed(2)}`);
  });
});

describe('the fee: rate × the base + the flat part, half-up to the cent', () => {
  const r = factsRates().card;
  const expected = (baseCents: number) => Math.floor((baseCents * r.pctBps + 5_000) / 10_000) + r.flatCents;

  it('matches the Facts doc arithmetic across a range of bases', () => {
    for (const base of [1, 99, 100, 16_500, 30_000, 33_333, 80_000, 150_000, 1_234_567]) {
      assert.equal(onlineFee(base, 'family').feeCents, expected(base), `base ${base}`);
    }
  });

  it('rounds a half cent up, never down', () => {
    // Find a base whose percentage part lands exactly on a half cent, and check it went up.
    let half = 0;
    for (let b = 1; b < 100_000 && !half; b++) if ((b * r.pctBps) % 10_000 === 5_000) half = b;
    if (!half) return; // a rate with no half-cent base can't round wrongly
    const exact = (half * r.pctBps) / 10_000;
    assert.equal(onlineFee(half, 'family').feeCents - r.flatCents, exact + 0.5);
  });

  it('A14 families pay it: the payer pays base + fee, the club receives the base', () => {
    const f = onlineFee(16_500, 'family');
    assert.equal(f.totalCents, 16_500 + f.feeCents);
    assert.equal(f.clubReceivesCents, 16_500);
    assert.equal(f.applicationFeeCents, f.feeCents);
  });

  it('A14 the club pays it: the payer pays the base alone, the fee comes out of it', () => {
    const f = onlineFee(16_500, 'club');
    assert.equal(f.totalCents, 16_500);
    assert.equal(f.clubReceivesCents, 16_500 - f.feeCents);
    assert.equal(f.applicationFeeCents, f.feeCents);
  });

  it('the same rates apply whoever pays', () => {
    assert.equal(onlineFee(30_000, 'family').feeCents, onlineFee(30_000, 'club').feeCents);
  });

  it('keeps the rate used with the payment', () => {
    const f = onlineFee(30_000, 'family');
    assert.equal(f.pctBps, r.pctBps);
    assert.equal(f.flatCents, r.flatCents);
  });

  it('refuses a non-whole, zero or negative amount', () => {
    assert.throws(() => onlineFee(0, 'family'));
    assert.throws(() => onlineFee(-100, 'family'));
    assert.throws(() => onlineFee(100.5, 'family'));
  });

  it('dollars from the books convert to cents without drift', () => {
    assert.equal(toCents('165.00'), 16_500);
    assert.equal(toCents(0.29), 29);
    assert.equal(toCents(1234.56), 123_456);
  });
});

describe('the gate: every paid org plan, Tournament Plus and above', () => {
  it('is on for Tournament Plus, League Plus and both Club bands', () => {
    for (const plan of ['tournament_plus', 'league', 'club', 'club_large'] as const) {
      assert.equal(hasPlanFeature(plan, 'online_payments'), true, plan);
    }
  });
  it('is off for the free Tournament plan and the Premium Coaches Portal', () => {
    assert.equal(hasPlanFeature('tournament', 'online_payments'), false);
    assert.equal(hasPlanFeature('team', 'online_payments'), false);
  });
});

describe('the launch switch: off in production', () => {
  it('is off when the env var is absent — production does not set it', () => {
    assert.equal(onlinePaymentsOn({ STRIPE_SECRET_KEY: 'sk_test_x' }), false);
    assert.equal(onlinePaymentsOn({ STRIPE_SECRET_KEY: 'sk_live_x' }), false);
  });

  it('is off for anything but the literal "true"', () => {
    for (const v of ['1', 'TRUE', 'yes', 'on', '']) {
      assert.equal(onlinePaymentsOn({ ONLINE_PAYMENTS_ENABLED: v, STRIPE_SECRET_KEY: 'sk_test_x' }), false, v);
    }
  });

  it('a LIVE key keeps it off even with the env var set, until counsel signs off', () => {
    assert.equal(LIVE_PAYMENTS_ALLOWED, false, 'turning live payments on is its own reviewed commit, after counsel');
    assert.equal(onlinePaymentsOn({ ONLINE_PAYMENTS_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_live_x' }), false);
  });

  it('is off with no Stripe key at all', () => {
    assert.equal(onlinePaymentsOn({ ONLINE_PAYMENTS_ENABLED: 'true' }), false);
    assert.equal(stripeKeyIsTest(undefined), false);
  });

  it('is on in test mode with the env var set', () => {
    assert.equal(onlinePaymentsOn({ ONLINE_PAYMENTS_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_x' }), true);
  });

  it('production env files never set the switch', () => {
    const amplify = readFileSync(path.join(ROOT, 'amplify.yml'), 'utf8');
    assert.doesNotMatch(amplify, /ONLINE_PAYMENTS_ENABLED\s*=\s*true/, 'amplify.yml must not hard-code the switch on');
  });
});
