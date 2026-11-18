import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type Stripe from 'stripe';
import { readFileSync } from 'node:fs';
import { chargeBalanceTransaction, disputeFeeCents, STAGE3_LINE_PREFIX, standaloneFeeOf, stripeFeeCents } from '../../lib/online-payment-stripe-fees.ts';
import { stripeStandardCostCents } from '../../lib/online-payment-fee.ts';

describe('the Money page reads each Stage 3 line by the start the database writes', () => {
  const sql = readFileSync('supabase/migrations/501_the_books_meet_what_stripe_takes.sql', 'utf8');
  for (const [k, prefix] of Object.entries(STAGE3_LINE_PREFIX)) {
    it(`${k}: "${prefix}" is written by mig 501`, () => assert.ok(sql.includes(`'${prefix}`), `mig 501 never writes "${prefix}"`));
  }
});

/** Stripe-owned pricing Stage 3: the figures are the test-mode probe's (.probe/s3/, plan "Stage 3 probe results"). */
const bt = (fee_details: { type: string; amount: number }[]): Stripe.BalanceTransaction =>
  ({ fee: fee_details.reduce((n, d) => n + d.amount, 0), fee_details }) as unknown as Stripe.BalanceTransaction;

describe('Stripe’s own fee on a charge is its stripe_fee detail, never the transaction’s fee', () => {
  it('a Canadian card: $3.35 of the $5.00 fee (ours is $1.65), equal to our standard cost', () => {
    const t = bt([{ type: 'application_fee', amount: 165 }, { type: 'stripe_fee', amount: 335 }]);
    assert.equal(t.fee, 500);
    assert.equal(stripeFeeCents(t), 335);
    assert.equal(stripeFeeCents(t), stripeStandardCostCents(10_500, 'card'));
  });
  it('a US card: $4.19, so the extra is $0.84 (0.8%)', () => {
    const t = bt([{ type: 'stripe_fee', amount: 419 }, { type: 'application_fee', amount: 165 }]);
    assert.equal(stripeFeeCents(t)! - stripeStandardCostCents(10_500, 'card'), 84);
  });
  it('the probe’s half-cent amounts round as ours does (cards $5, $15, $25, $35; debits $10.50, $20.50, the $5 cap)', () => {
    for (const [c, fee] of [[500, 45], [1_500, 74], [2_500, 103], [3_500, 132], [12_345, 388], [99_999, 2_930]]) {
      assert.equal(stripeStandardCostCents(c, 'card'), fee, `card ${c}`);
    }
    for (const [c, fee] of [[1_050, 51], [2_050, 61], [60_000, 500]]) assert.equal(stripeStandardCostCents(c, 'bankDebit'), fee, `debit ${c}`);
  });
  it('not there yet (unexpanded or null) reads as null, so the landing leaves it for the daily job', () => {
    assert.equal(stripeFeeCents(null), null);
    assert.equal(stripeFeeCents('txn_123'), null);
    assert.equal(chargeBalanceTransaction({ balance_transaction: null } as unknown as Stripe.Charge), null);
    assert.equal(chargeBalanceTransaction({ balance_transaction: 'txn_1' } as unknown as Stripe.Charge), null);
    assert.equal(chargeBalanceTransaction('ch_1'), null);
  });
});

describe('a dispute’s fee is the stripe_fee on its withdrawal', () => {
  it('card $15, debit $5; a reversal returns the amount with no fee', () => {
    const d = (bts: { amount: number; fee_details: { type: string; amount: number }[] }[]) =>
      ({ balance_transactions: bts }) as unknown as Stripe.Dispute;
    assert.equal(disputeFeeCents(d([{ amount: -10_500, fee_details: [{ type: 'stripe_fee', amount: 1_500 }] },
      { amount: 10_500, fee_details: [] }])), 1_500);
    assert.equal(disputeFeeCents(d([{ amount: -10_350, fee_details: [{ type: 'stripe_fee', amount: 500 }] }])), 500);
    assert.equal(disputeFeeCents(d([])), 0);
  });
});

describe('a stand-alone Stripe fee line is read from Stripe’s own wording, never guessed', () => {
  const created = Date.UTC(2026, 10, 18, 7, 9) / 1000;
  it('the two the probe saw', () => {
    assert.deepEqual(standaloneFeeOf('Pre-Authorized Debit in Canada (2026-11-18): Payment Failure', created), { kind: 'debit_failure', day: '2026-11-18' });
    assert.deepEqual(standaloneFeeOf('Card Dispute Countered Fee (2026-11-17)', created), { kind: 'dispute_countered', day: '2026-11-17' });
  });
  it('a return or a credit, or anything new, is "other" (left unmatched)', () => {
    assert.equal(standaloneFeeOf('Card Dispute Countered Fee Refund (2026-11-18)', created).kind, 'other');
    assert.equal(standaloneFeeOf('Connect account fee', created).kind, 'other');
    assert.equal(standaloneFeeOf(null, created).kind, 'other');
  });
  it('no day in the words: the day Stripe made it (UTC)', () => {
    assert.equal(standaloneFeeOf('Pre-Authorized Debit in Canada: Payment Failure', created).day, '2026-11-18');
  });
});
