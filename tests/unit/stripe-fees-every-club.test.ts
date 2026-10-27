import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { foreignCardFeeCents, onlineFee } from '../../lib/online-payment-fee.ts';
import { FOREIGN_CARD_EXTRA_BPS } from '../../lib/plan-config.ts';
import { FEE_INVOICE_META, STRIPE_FEE_WORDS as W, isFeeCredit } from '../../lib/online-payment-words.ts';
import { findPatterns, paidForWords, type MoneyCharge } from '../../lib/console-money.ts';

/**
 * CLUB TIER STAGE 12d-1 PART 4: EVERY CLUB PAYS ITS STRIPE FEES (owner 2026-10-26: "comped clubs do not get any reprieve on
 * stripe fees in any capacity"; 2026-10-27: a club with no subscription invoice gets ONE of its own a month, in our email;
 * ruling 5: bill only what Stripe charged us). Words CLUB_TIER_STAGE12D_COPY.md §1.7, §3.4, §6.1.
 */
const FEES = 'lib/platform-stripe-fees.ts';

describe('one billing path for every fee kind', () => {
  it('a live, undiscounted CAD subscription carries the line; every other club (comped, free, cancelled, discounted) waits for its own invoice', () => {
    const src = readCode(FEES);
    const ride = /async function subscriptionToRide[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
    assert.match(ride, /if \(!org\?\.stripe_customer_id \|\| !org\.stripe_subscription_id\) return null;/, 'no subscription → its own invoice');
    assert.match(ride, /if \(!LIVE_SUBSCRIPTION\.has\(sub\.status\) \|\| sub\.cancel_at_period_end\) return null;/, 'cancelled → its own invoice');
    assert.match(ride, /if \(\(sub\.discounts\?\.length \?\? 0\) > 0\) return null;/, 'a discount would eat the line → its own invoice');
    // /review 4b: a subscription in another currency, or one Stripe no longer has, sends the fee to the club's own invoice
    // (it was an error retried five times, then never billed).
    assert.match(ride, /if \(sub\.currency !== 'cad'\) return null;/);
    assert.match(ride, /code === 'resource_missing'\) return null;/);
    const bill = /export async function billFee[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
    assert.match(bill, /if \(!ride\) \{[\s\S]*?return 'own_invoice';/);
    assert.match(bill, /subscription: ride\.subscription, amount: signedCents\(f\)/);
  });

  it('comped and free clubs are billed: the only exemption written is test mode', () => {
    const src = readCode(FEES);
    assert.doesNotMatch(src, /workspaceHoldsFoundingComp|freeTime/, 'a comp never decides billing');
    assert.doesNotMatch(src, /exempt_reason: '(comped|no_subscription)'/);
    assert.match(src, /if \(f\.livemode !== LIVE_KEY\(\)\) \{[\s\S]{0,200}exempt_reason: 'test_mode'/);
  });

  it('a returned answering fee is a credit: a negative line wherever it is billed, and a credits-only month sends nothing', () => {
    assert.equal(isFeeCredit('dispute_answer_returned'), true);
    assert.equal(isFeeCredit('dispute'), false);
    const src = readCode(FEES);
    assert.match(src, /const signedCents = \(f: [^)]*\) => Math\.round\(Number\(f\.amount\) \* 100\) \* \(isFeeCredit\(f\.kind\) \? -1 : 1\);/);
    assert.match(src, /if \(ours\.reduce\(\(s, f\) => s \+ signedCents\(f\), 0\) <= 0\) return false;/);
  });

  it('a dispute is billed only at what Stripe charged FieldLogicHQ, read from the platform balance by the dispute', () => {
    const src = readCode(FEES);
    assert.match(src, /stripe\.balanceTransactions\.list\(\{ source: stripeDisputeId, limit: 100 \}\)/);
    assert.match(src, /source: 'stripe' as const/);
    const land = readCode('lib/online-payment-landing.ts');
    // A fee from the club's own balance stays the club's (ruling 6): the platform's figure is used only when that is empty.
    assert.match(land, /const platformFee = read\.stripeFee == null && platformFees && platformFees\.dispute > 0/);
    assert.match(land, /p_fee_paid_from: platformFee != null \? 'platform' : read\.feePaidFrom/);
  });

  it('the monthly invoice: Stripe’s own email is off, one invoice per club and month, one line per fee read back first', () => {
    const src = readCode(FEES);
    assert.match(src, /collection_method: 'send_invoice', days_until_due: FEE_INVOICE_DAYS_DUE, auto_advance: false/);
    assert.match(src, /pending_invoice_items_behavior: 'exclude'/);
    assert.match(src, /finalizeInvoice\(invoiceId, \{ auto_advance: false \}\)/);
    assert.doesNotMatch(src, /sendInvoice\(/, 'Stripe never sends it; we do');
    assert.match(src, /metadata: \{ \[FEE_INVOICE_META\]: row\.id, org_id: orgId \}/);
    assert.match(src, /idempotencyKey: `fee-invoice:\$\{row\.id\}`/);
    assert.match(src, /const existing = await stripe\.invoiceItems\.list\(\{ invoice: invoiceId, limit: 100 \}\)\.autoPagingToArray\(/);
    assert.match(src, /kind: 'stripe_fee_invoice', orgId: row\.org_id, idempotencyKey: `fee-invoice-email:\$\{row\.id\}`/);
    assert.match(src, /kind: 'stripe_fee_invoice_reminder'[\s\S]{0,80}idempotencyKey: `fee-invoice-reminder:\$\{row\.id\}`/);
  });

  it('a run that stopped at any step finishes on the next (/review 4b)', () => {
    const src = readCode(FEES);
    const done = /async function completeInvoice[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
    // Fees are stamped billed only after the finalize, so a run that stopped before it leaves them for the next run.
    assert.ok(done.indexOf('finalizeInvoice(') > 0 && done.indexOf("billed_on: 'own_invoice'") > done.indexOf('finalizeInvoice('), 'billed after the finalize');
    assert.equal((src.match(/billed_on: 'own_invoice'/g) ?? []).length, 1, 'one place stamps an own-invoice fee billed');
    // Stripe's own state decides: an invoice already finalized takes no new line and is never finalized twice.
    assert.match(done, /const draft = inv\.status === 'draft';/);
    assert.match(done, /if \(draft\) inv = await stripe\.invoices\.finalizeInvoice\(/);
    // An invoice whose email failed is emailed by the next run, whatever its club's fees.
    const monthly = /export async function sendMonthlyFeeInvoices[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
    assert.match(monthly, /\.eq\('status', 'open'\)\.eq\('livemode', live\)\.is\('emailed_at', null\)/);
    // A subscription line is read back before it is added (Stripe's key lasts 24 hours).
    const bill = /export async function billFee[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
    assert.ok(bill.indexOf('invoiceItems.list(') > 0 && bill.indexOf('invoiceItems.list(') < bill.indexOf('invoiceItems.create('), 'read back first');
  });

  it('the billing webhook writes a fee invoice to its own row before the subscription cases can read it', () => {
    const hook = readCode('app/api/billing/webhook/route.ts');
    const intercept = hook.indexOf('syncFeeInvoiceFromEvent(');
    const sw = hook.indexOf('switch (event.type)');
    assert.ok(intercept > 0 && intercept < sw, 'a comped club paying a fee invoice must never turn "active"');
  });
});

describe('a card issued outside the club’s country', () => {
  it('the published rate on what the card was charged; the family’s total never changes', () => {
    assert.equal(foreignCardFeeCents(10_000), Math.round(10_000 * FOREIGN_CARD_EXTRA_BPS / 10_000));
    assert.equal(foreignCardFeeCents(0), 0);
    // The pay page's total is the processing fee's arithmetic alone: nothing about the card's country.
    const pay = onlineFee(16_500, 'family');
    assert.equal(pay.totalCents, pay.baseCents + pay.feeCents);
    const totalFn = /export function onlineFee[\s\S]*?\n}\n/.exec(readCode('lib/online-payment-fee.ts'))?.[0] ?? '';
    assert.ok(totalFn, 'the pay total is found');
    assert.doesNotMatch(totalFn, /FOREIGN_CARD|foreignCard|country/i);
    assert.doesNotMatch(readCode('lib/team-pay-options.ts'), /FOREIGN_CARD|foreignCard/);
  });

  it('compares with the club’s connected account’s country, never a typed "CA"', () => {
    const src = readCode(FEES);
    const fn = /export async function recordForeignCardFee[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
    assert.match(fn, /from\('org_payment_accounts'\)\.select\('country'\)/);
    assert.match(fn, /if \(!home \|\| home === String\(op\.card_country\)\.toUpperCase\(\)\) return;/);
    assert.doesNotMatch(fn, /'CA'/);
  });

  it('recorded in both flows once Stripe says paid, and on a replay', () => {
    const land = readCode('lib/online-payment-landing.ts');
    const body = /export async function landCheckoutSession[\s\S]*?\n}\n/.exec(land)?.[0] ?? '';
    const split = body.indexOf("if (op.flow === 'league_signup') {");
    assert.ok(split > 0 && body.indexOf('await recordForeignCardFee(op.id);') < split, 'before the flows split');
    assert.equal((body.match(/await recordForeignCardFee\(op\.id\)/g) ?? []).length, 2, 'the landing and the replay');
  });

  it('a dispute lost before the payment landed is booked at the landing: both flows, and on a replay (Part 4b)', () => {
    const land = readCode('lib/online-payment-landing.ts');
    const body = /export async function landCheckoutSession[\s\S]*?\n}\n/.exec(land)?.[0] ?? '';
    assert.equal((body.match(/await bookDisputesLostBeforeLanding\(stripeAccountId, op\.id\)/g) ?? []).length, 3, 'replay, house league, tournament');
  });
});

describe('the words', () => {
  it('the invoice lines name the receipt, never a child', () => {
    assert.equal(W.line('dispute', '1041', 'Nov 11'), 'Card dispute fee · receipt 1041 · Nov 11');
    assert.equal(W.line('dispute_answer_returned', '1041', 'Nov 11'), 'Card dispute answering fee returned · receipt 1041 · Nov 11');
    assert.equal(W.line('foreign_card', '1041', 'Nov 11'), 'Extra fee for a card issued outside your country · receipt 1041 · Nov 11');
    assert.equal(W.line('returned', '1041', 'Nov 11'), 'Returned bank debit · receipt 1041 · Nov 11');
  });

  it('the email’s reason lists only the kinds on the invoice', () => {
    assert.equal(W.emailWhy(['foreign_card']), 'Stripe charges this fee when a card issued outside your country is used.');
    assert.equal(W.emailWhy(['dispute', 'returned', 'foreign_card']),
      'Stripe charges these fees when a card payment is disputed, a bank debit comes back or a card issued outside your country is used.');
  });

  it('"outside your country", never "outside Canada"; "fraud" never printed', () => {
    const words = readCode('lib/online-payment-words.ts');
    assert.doesNotMatch(words, /outside Canada/);
    assert.doesNotMatch(words, /\bfraud\b/i);
  });
});

describe('platform admin', () => {
  const charge = (inv: Partial<MoneyCharge['invoice']> | null): MoneyCharge => ({
    id: 'ch_1', createdAt: '2026-11-01T12:00:00Z', amountCents: 500, currency: 'cad', status: 'succeeded', refundedCents: 0,
    disputed: false, failureCode: null, card: null, refunds: [],
    invoice: inv ? { id: 'in_1', number: 'F-0001', billingReason: 'manual', subscriptionId: null, periodStart: null, periodEnd: null, planId: null, cycle: null, fromPlanId: null, description: null, ...inv } : null,
  });

  it('a fee invoice is named as one, never the "not the subscription’s" warning', () => {
    const c = charge({ feeInvoice: true });
    assert.equal(paidForWords(c).main, W.paCharge('F-0001'));
    assert.equal(findPatterns({ charges: [c], subscriptions: [] }, null).flags.has('ch_1'), false);
    // A one-off invoice made in Stripe's dashboard still carries the warning.
    assert.equal(findPatterns({ charges: [charge({})], subscriptions: [] }, null).flags.get('ch_1')?.kind, 'not_subscription');
    assert.equal(FEE_INVOICE_META, 'fieldlogichq_fee_invoice_id');
  });

  it('Retry is the billing power’s and only for this club’s failed fee', () => {
    const r = readCode('app/api/platform-admin/orgs/[id]/money/stripe-fees/[feeId]/retry/route.ts');
    assert.match(r, /requirePlatformPower\('club_billing'\)/);
    assert.match(r, /if \(!fee \|\| fee\.org_id !== id\)/);
    assert.match(r, /if \(fee\.billed_at \|\| fee\.exempt_reason \|\| !fee\.bill_error\) return/);
  });
});
