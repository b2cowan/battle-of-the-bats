/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **NO REVENUE FIGURE ON BUSINESS NUMBERS READS AN AMOUNT THAT INCLUDES TAX** (GST/HST Stage 3 Part 4, owner ruling
 * 2026-11-06: "revenue figures say and mean before tax; a guard keeps tax out of them").
 *
 * The monthly and yearly figures (`estimatedMrr`, `estimatedArr`) are built from the plan list prices in
 * `lib/plan-config.ts`, which are before tax (PLAN_PRICING_FACTS.md). They read no Stripe amount and no kept sale. This test
 * keeps it so: the day someone adds a "revenue" figure here that sums a charge, an invoice total or a payment, it fails and
 * says why. A tax-inclusive amount belongs in a figure that SAYS it includes tax (the Money tab's band does), never here.
 *
 *   1. `lib/platform-metrics.ts` (code only; comments ignored) names no tax-inclusive money column or Stripe amount.
 *   2. The monthly figure is built from `PLAN_CONFIG[...].monthlyPrice`, and the yearly one is that times twelve.
 *   3. Both places the figure is shown say "before tax".
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode, readSource } from './_source-code.ts';

/** Every way this codebase spells an amount that has tax in it: our kept totals, Stripe's amounts, and the payment tables. */
const TAX_INCLUSIVE = [
  'total_cents', 'cad_total_cents', 'refunded_cents', 'amount_paid', 'amount_due', 'amount_remaining', 'amount_cents', 'amountCents',
  'totalCents', 'platform_charge_tax_records', 'platform_credit_note_tax_records', 'platform_refunds', 'stripe_charges', 'payment_intents',
];

describe('Business numbers: revenue is before tax', () => {
  const metrics = readCode('lib/platform-metrics.ts'); // comments stripped: a sentence ABOUT a column must not trip the check

  it('lib/platform-metrics.ts reads no tax-inclusive amount', () => {
    const found = TAX_INCLUSIVE.filter(word => metrics.includes(word));
    assert.deepEqual(found, [], `lib/platform-metrics.ts names ${found.join(', ')}: a revenue figure here would include tax. Use before-tax amounts, or say "includes tax" where it is shown.`);
  });

  it('the monthly figure is list prices and the yearly one is that times twelve', () => {
    assert.match(metrics, /estimatedMrr \+= PLAN_CONFIG\[plan\]\?\.monthlyPrice/);
    assert.match(metrics, /estimatedArr: estimatedMrr \* 12/);
  });

  it('both screens that show it say "before tax"', () => {
    for (const page of ['app/platform-admin/business-numbers/page.tsx', 'app/platform-admin/page.tsx']) {
      assert.match(readSource(page), /a month at list price, before tax/, `${page} must say the monthly figure is before tax`);
    }
  });
});
