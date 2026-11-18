import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ONLINE_PAYMENT_RATES, STRIPE_STANDARD_COST, onlineFeeRateLabel } from '../../lib/plan-config.ts';
import { canOpen, onlineFee, stripeStandardCostCents, toCents } from '../../lib/online-payment-fee.ts';
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

/** Stripe's standard cost as the Facts doc states it (Stripe-owned pricing, rate design A, 2026-11-17). */
function factsStripeCost() {
  const facts = readFileSync(path.join(ROOT, 'docs/agents/strategy/PLAN_PRICING_FACTS.md'), 'utf8');
  const m = facts.match(/Stripe standard cost: card (\d+(?:\.\d+)?)% \+ \$(\d+\.\d\d) · pre-authorized debit (\d+(?:\.\d+)?)% \+ \$(\d+\.\d\d), capped at \$(\d+\.\d\d)/);
  assert.ok(m, 'Facts doc: the Stripe standard cost line was not found — the build will not invent Stripe’s price');
  return {
    card: { pctBps: Math.round(Number(m[1]) * 100), flatCents: Math.round(Number(m[2]) * 100), capCents: null },
    bankDebit: { pctBps: Math.round(Number(m[3]) * 100), flatCents: Math.round(Number(m[4]) * 100), capCents: Math.round(Number(m[5]) * 100) },
  };
}

describe('online payment rates are the Facts doc’s', () => {
  it('lib/plan-config.ts carries exactly the Facts doc line', () => {
    assert.deepEqual(
      { card: { ...ONLINE_PAYMENT_RATES.card }, bankDebit: { ...ONLINE_PAYMENT_RATES.bankDebit } },
      factsRates(),
    );
  });

  it('Stripe’s standard cost in lib/plan-config.ts is the Facts doc’s (Stripe’s published price, not ours)', () => {
    assert.deepEqual(
      { card: { ...STRIPE_STANDARD_COST.card }, bankDebit: { ...STRIPE_STANDARD_COST.bankDebit } },
      factsStripeCost(),
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
    // Stripe-owned pricing: Stripe's cost is on the whole charge, and the rest of the fee is ours.
    assert.equal(f.stripeCostCents, stripeStandardCostCents(f.totalCents, 'card'));
    assert.equal(f.applicationFeeCents + f.stripeCostCents, f.feeCents);
  });

  it('A14 the club pays it: the payer pays the base alone, the fee comes out of it', () => {
    const f = onlineFee(16_500, 'club');
    assert.equal(f.totalCents, 16_500);
    assert.equal(f.clubReceivesCents, 16_500 - f.feeCents);
    assert.equal(f.stripeCostCents, stripeStandardCostCents(16_500, 'card'));
    assert.equal(f.applicationFeeCents + f.stripeCostCents, f.feeCents);
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

  it('a LIVE key keeps it off even with the env var set, until the owner switches it on', () => {
    assert.equal(LIVE_PAYMENTS_ALLOWED, false, 'turning live payments on is its own reviewed commit, made when the owner switches it on');
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

/**
 * Stripe-owned pricing, rate design A (ruled 2026-11-17; plan STRIPE_OWNED_PRICING_PLAN.md "Rate design: A"). The cases
 * are the plan's table, as `.probe/sop/sop-7-margin.cjs` computed them and the probe charged them at $100 (card $3.35,
 * debit $1.44 to Stripe). Cents: [base, rail, payer, fee, Stripe's cost, our application fee].
 */
describe('Stripe-owned pricing: our application fee is the fee less Stripe’s standard cost', () => {
  const TABLE: [number, 'card' | 'bankDebit', 'family' | 'club', number, number, number][] = [
    [10_000, 'card', 'family', 500, 335, 165], [10_000, 'bankDebit', 'family', 350, 144, 206],
    [40_000, 'card', 'family', 1550, 1235, 315], [40_000, 'bankDebit', 'family', 1100, 451, 649],
    [80_000, 'card', 'family', 2950, 2436, 514], [80_000, 'bankDebit', 'family', 2100, 500, 1600],
    [100_000, 'card', 'family', 3650, 3036, 614], [100_000, 'bankDebit', 'family', 2600, 500, 2100],
    [10_000, 'card', 'club', 500, 320, 180], [10_000, 'bankDebit', 'club', 350, 140, 210],
    [40_000, 'card', 'club', 1550, 1190, 360], [40_000, 'bankDebit', 'club', 1100, 440, 660],
    [80_000, 'card', 'club', 2950, 2350, 600], [80_000, 'bankDebit', 'club', 2100, 500, 1600],
    [100_000, 'card', 'club', 3650, 2930, 720], [100_000, 'bankDebit', 'club', 2600, 500, 2100],
  ];
  for (const [base, rail, payer, fee, cost, app] of TABLE) {
    it(`$${base / 100} ${rail}, ${payer} pays: fee ${fee}, Stripe ${cost}, ours ${app}`, () => {
      const f = onlineFee(base, payer, rail);
      assert.equal(f.feeCents, fee);
      assert.equal(f.stripeCostCents, cost);
      assert.equal(f.applicationFeeCents, app);
      // The club nets what it netted before Stripe-owned pricing: the base when families pay, the base less the fee when
      // the club pays. Only the split between Stripe and us moved.
      assert.equal(f.clubReceivesCents, payer === 'family' ? base : base - fee);
      assert.ok(canOpen(f));
    });
  }

  it('rounds Stripe’s percentage half-up to the cent, as Stripe does ($105.00 by card costs exactly $3.35)', () => {
    assert.equal(stripeStandardCostCents(10_500, 'card'), 335);
    assert.equal(stripeStandardCostCents(10_350, 'bankDebit'), 144);
  });

  it('caps a bank debit’s Stripe cost at $5.00, and never a card’s', () => {
    assert.equal(stripeStandardCostCents(46_000, 'bankDebit'), 500);
    assert.equal(stripeStandardCostCents(10_000_000, 'bankDebit'), 500);
    assert.equal(stripeStandardCostCents(10_000_000, 'card'), 290_030);
  });

  it('a tiny payment: families pay — it opens with a margin above zero; the club pays — it is refused', () => {
    const fam = onlineFee(100, 'family');
    assert.equal(fam.feeCents, 154);
    assert.equal(fam.totalCents, 254);
    assert.equal(fam.stripeCostCents, 37);
    assert.equal(fam.applicationFeeCents, 117);
    assert.ok(canOpen(fam));
    // $1.40 paid by the club: our fee alone ($1.21) is below the charge, but the WHOLE fee ($1.55) is not — the club would
    // net below zero once Stripe took its cost. The old test (application fee ≥ total) would have let it through.
    const club = onlineFee(140, 'club');
    assert.equal(club.applicationFeeCents, 121);
    assert.ok(club.applicationFeeCents < club.totalCents);
    assert.equal(canOpen(club), false);
  });

  it('our margin is above zero on every base, both rails, both payers (the guard never fires on today’s rates)', () => {
    for (const rail of ['card', 'bankDebit'] as const) for (const payer of ['family', 'club'] as const) {
      for (let b = 1; b <= 200_000; b++) {
        const f = onlineFee(b, payer, rail);
        if (f.feeCents < f.totalCents) assert.ok(f.applicationFeeCents > 0, `${rail} ${payer} ${b}`);
      }
    }
  });

  it('a margin of zero or less is refused', () => {
    assert.equal(canOpen({ feeCents: 300, totalCents: 10_300, applicationFeeCents: 0 }), false);
    assert.equal(canOpen({ feeCents: 300, totalCents: 10_300, applicationFeeCents: -5 }), false);
  });
});

describe('Stripe-owned pricing: an account under the old fee setting takes no payment (owner 2026-11-18)', async () => {
  const { takesPayments, takesBankDebit, oldFeeSetting, factsFromRow } = await import('../../lib/online-payment-account.ts');
  const live = {
    stripeAccountId: 'acct_x', livemode: false, cardPayments: 'active' as const, cardPaymentsReason: null,
    onboardingFinishedAt: '2026-11-01T00:00:00Z', requirementsDue: [], requirementsDeadline: null, feePayer: 'family' as const,
    refundPolicy: 'Full refund before the season starts.', disconnectedAt: null, bankDebit: 'active' as const,
  };
  it('a Stripe-owned account takes payments; an old-setting one takes none, by card or bank', () => {
    assert.equal(takesPayments({ ...live, feesCollector: 'stripe' }), true);
    assert.equal(takesPayments({ ...live, feesCollector: 'application' }), false);
    assert.equal(takesBankDebit({ ...live, feesCollector: 'application' }), false);
    assert.equal(oldFeeSetting({ feesCollector: 'application' }), true);
    assert.equal(oldFeeSetting({ feesCollector: 'stripe' }), false);
  });
  it('the row’s setting reaches the facts', () => {
    const row = {
      org_id: 'o', stripe_account_id: 'acct_x', livemode: false, card_payments_status: 'active' as const, card_payments_reason: null,
      onboarding_finished_at: null, requirements_due: [], requirements_deadline: null, fee_payer: 'family' as const,
      refund_policy: 'x', disconnected_at: null, fees_collector: 'application' as const,
    };
    assert.equal(factsFromRow(row)!.feesCollector, 'application');
    assert.equal(takesPayments(factsFromRow(row)), false);
  });
});
