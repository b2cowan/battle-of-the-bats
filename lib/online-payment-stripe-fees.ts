/**
 * Stripe-owned pricing, Stage 3 (mig 501): reading what Stripe really took from a club's balance. Pure — no Stripe call,
 * no database — so the landing, the daily job and the tests share one reading.
 *
 * Probe (test mode, 2026-11-18, `.probe/s3/`, plan "Stage 3 probe results"):
 * - A charge's balance transaction has `fee` = Stripe's fee PLUS our application fee; Stripe's own cost is only the
 *   `stripe_fee` fee detail. It appears about a second after the payment succeeds, so it may be missing at the landing.
 * - Stripe bills some fees LATER as stand-alone `stripe_fee` balance transactions with no source, worded with the product
 *   and the day: "Pre-Authorized Debit in Canada (2026-11-18): Payment Failure" ($5, a debit that failed before it
 *   cleared) and "Card Dispute Countered Fee (2026-11-18)" ($15, a dispute the club answered). Ruling (d): matched to their
 *   payment by that wording and day, and booked once.
 */
import type Stripe from 'stripe';

/** Stripe's own processing fee on a charge's balance transaction, in cents: the `stripe_fee` details only, never `fee`.
 *  null when the transaction is not there yet (or not expanded). */
export function stripeFeeCents(bt: Stripe.BalanceTransaction | string | null | undefined): number | null {
  if (!bt || typeof bt !== 'object') return null;
  return (bt.fee_details ?? []).filter(d => d.type === 'stripe_fee').reduce((n, d) => n + d.amount, 0);
}

/** The balance transaction on a session's charge, when Stripe has made it and the read expanded it. */
export function chargeBalanceTransaction(charge: Stripe.Charge | string | null | undefined): Stripe.BalanceTransaction | null {
  if (!charge || typeof charge !== 'object') return null;
  const bt = charge.balance_transaction;
  return bt && typeof bt === 'object' ? bt : null;
}

/** Stripe's fee attached to a dispute, in cents: the `stripe_fee` details on its withdrawals (its "Dispute fee"). */
export function disputeFeeCents(dispute: Pick<Stripe.Dispute, 'balance_transactions'>): number {
  return (dispute.balance_transactions ?? [])
    .filter(b => b.amount < 0)
    .flatMap(b => b.fee_details ?? [])
    .filter(d => d.type === 'stripe_fee')
    .reduce((n, d) => n + d.amount, 0);
}

export type StandaloneFeeKind = 'debit_failure' | 'dispute_countered' | 'other';

/**
 * What a stand-alone Stripe fee line is, from Stripe's own wording, and the day it names (else the day Stripe made it,
 * UTC). Only the two the probe saw are recognised; anything else — a credit, a returned countered fee, a fee Stripe adds
 * later — is 'other' and stays unmatched, for the bank check to name. Never guessed.
 */
export function standaloneFeeOf(description: string | null | undefined, createdUnix: number): { kind: StandaloneFeeKind; day: string } {
  const text = description ?? '';
  const named = /\((\d{4}-\d{2}-\d{2})\)/.exec(text)?.[1];
  const day = named ?? new Date(createdUnix * 1000).toISOString().slice(0, 10);
  if (/refund|return|reversal|credit/i.test(text)) return { kind: 'other', day };
  if (/pre-authori[sz]ed debit/i.test(text) && /payment failure/i.test(text)) return { kind: 'debit_failure', day };
  if (/dispute countered fee/i.test(text)) return { kind: 'dispute_countered', day };
  return { kind: 'other', day };
}

/**
 * The start of each Stage 3 book line, as the database writes it (mig 501: `online_payment_stripe_fee_set`,
 * `online_payment_dispute_fee_book`, `online_payment_stripe_fee_line_take`). The house-league Money page reads a line's
 * kind from these; they must match the migration letter for letter (`tests/unit/online-payment-stripe-fees.test.ts`).
 */
export const STAGE3_LINE_PREFIX = {
  extra: 'Stripe’s extra · ',
  disputeFee: 'Dispute fee · ',
  failureFee: 'Returned debit fee · ',
} as const;
