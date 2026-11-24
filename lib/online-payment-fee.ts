/**
 * The fee on a payment a club takes online (Club Tier Stage 12). One function, computed once on the server when the
 * payment is opened and stored on it — a screen never recomputes a stored payment's fee.
 *
 * fee = rate × the base + the flat part, on the base (never grossed up), rounded half-up to the cent. The rates live in
 * `ONLINE_PAYMENT_RATES` (`lib/plan-config.ts`), which a unit test holds to the Facts doc.
 *
 * Who pays it is the club's one choice (A14, Decided 2026-10-25):
 *   - 'family' (the default): the payer pays the base plus the fee; the club receives the base.
 *   - 'club': the payer pays the base alone; the fee comes out of it, and the club's books show it as a
 *     "Payment processing" cost — never as less fee revenue.
 * Stripe-owned pricing (rate design A, ruled 2026-11-17; plan STRIPE_OWNED_PRICING_PLAN.md): the club's account pays Stripe
 * its own fee, and the application fee FieldLogicHQ takes is the fee LESS Stripe's standard Canadian cost on the whole
 * charge (`STRIPE_STANDARD_COST`). The payer's fee and the club's net are what they were; only the split moved. The
 * application fee is stored on the payment when its Checkout opens (`online_payments.application_fee_amount`) and never
 * recomputed: Stripe's price can change, what we took cannot.
 */
import { ONLINE_PAYMENT_RATES, STRIPE_STANDARD_COST, type OnlinePaymentRail } from './plan-config';

export type OnlineFeePayer = 'family' | 'club';

export const ONLINE_FEE_PAYERS: readonly OnlineFeePayer[] = ['family', 'club'];

/**
 * Who pays the card fee on a SPONSORSHIP (Board Ready Stage 6, ask 3, ruled 2026-11-22): its own club-wide choice,
 * `org_payment_accounts.sponsor_fee_payer` (mig 525), "The club pays it" by default. The registration choice above never
 * decides it. Part 3 reads it when a sponsor pays by card.
 */
export type SponsorFeePayer = 'club' | 'sponsor';
export const SPONSOR_FEE_PAYERS: readonly SponsorFeePayer[] = ['sponsor', 'club'];

export interface OnlineFee {
  /** What the payment is for — the amount the flow's own writer records (the team's entry fee, the deposit). */
  baseCents: number;
  /** The processing fee, whoever pays it. */
  feeCents: number;
  /** What the payer is charged. */
  totalCents: number;
  /** Stripe's standard cost on what the payer is charged — Stripe takes it from the club's balance. */
  stripeCostCents: number;
  /** FieldLogicHQ's application fee: the fee less Stripe's standard cost (our margin, its GST/HST inside it, R1). */
  applicationFeeCents: number;
  /** What the club nets from this payment once Stripe's standard cost and our fee are taken (a domestic payment; Stripe's
   *  extras — a foreign card, a conversion, a dispute — come off it at Stripe). */
  clubReceivesCents: number;
  feePayer: OnlineFeePayer;
  rail: OnlinePaymentRail;
  /** The rate used, kept with the payment so a later rate change never rewrites what was charged. */
  pctBps: number;
  flatCents: number;
}

/** The largest single payment we open: matches the team payment writer's own ceiling ($1,000,000). */
export const MAX_ONLINE_BASE_CENTS = 100_000_000;

export function onlineFee(baseCents: number, feePayer: OnlineFeePayer, rail: OnlinePaymentRail = 'card'): OnlineFee {
  if (!Number.isInteger(baseCents) || baseCents <= 0 || baseCents > MAX_ONLINE_BASE_CENTS) {
    throw new Error('An online payment needs a whole number of cents above zero.');
  }
  const { pctBps, flatCents } = ONLINE_PAYMENT_RATES[rail];
  // Half-up in integers: (base × bps) / 10 000, plus a half before the floor. Exact for every cent amount.
  const pctCents = Math.floor((baseCents * pctBps + 5_000) / 10_000);
  const feeCents = pctCents + flatCents;
  const totalCents = feePayer === 'family' ? baseCents + feeCents : baseCents;
  const stripeCostCents = stripeStandardCostCents(totalCents, rail);
  return {
    baseCents,
    feeCents,
    totalCents,
    stripeCostCents,
    applicationFeeCents: feeCents - stripeCostCents,
    clubReceivesCents: totalCents - feeCents,
    feePayer,
    rail,
    pctBps,
    flatCents,
  };
}

/**
 * Stripe's standard Canadian cost on a charge (`STRIPE_STANDARD_COST`): the percentage rounded half-up to the cent, as
 * Stripe rounds it (the probe's $105.00 card charge cost exactly $3.35), plus the flat part, within the cap.
 */
export function stripeStandardCostCents(chargedCents: number, rail: OnlinePaymentRail): number {
  const { pctBps, flatCents, capCents } = STRIPE_STANDARD_COST[rail];
  const cost = Math.floor((chargedCents * pctBps + 5_000) / 10_000) + flatCents;
  return capCents === null ? cost : Math.min(cost, capCents);
}

/**
 * Whether a Checkout may open at this fee — the one rule both pay routes read. The WHOLE fee must be below what the payer
 * is charged (only a club-pays payment of a dollar or so fails: the club would net below zero once Stripe and we are
 * paid), and our margin must be above zero. On today's rates the margin never reaches zero (smallest: $0.59, a bank debit
 * of a cent; $1.15 by card — a unit test walks every base); refusing is the guard if a rate or Stripe's price ever made it.
 */
export function canOpen(fee: Pick<OnlineFee, 'feeCents' | 'totalCents' | 'applicationFeeCents'>): boolean {
  return fee.feeCents < fee.totalCents && fee.applicationFeeCents > 0;
}

/** A sponsor's card payment (Part 3b): `onlineFee`'s figures, plus the GST/HST on a fee the sponsor pays. */
export interface SponsorCardFee extends OnlineFee {
  /** The club's GST/HST on the fee when the sponsor pays it on a taxed deal (round 2: "Includes a $41.05 card processing fee
   *  and $5.34 HST on it."). Part of `baseCents` (the club keeps it to send on), never of `feeCents`. */
  feeTaxCents: number;
  /** What the sponsor's invoice says it owes before the fee (the invoice total, or what is still owing on it). */
  owingCents: number;
}

/**
 * The card fee on a sponsorship (Board Ready Stage 6 Part 3; round 2 asks 1–3, 9; owner call (3), 2026-11-23). `onlineFee` on
 * what is owed INCLUDING its GST/HST, never grossed up (F13). When the sponsor pays it, the fee is its own invoice row with the
 * club's GST/HST on it ($1,130.00 → $41.05 fee + $5.34 HST → $1,176.39; the club receives $1,135.34 and keeps $1,000.00 after
 * the $135.34 HST); when the club pays it, the sponsor pays the invoice to the cent and the fee is a Payment processing cost.
 * `issued` (an invoice already out) always makes it the club's, whatever the Payouts row says (owner call (3)).
 */
export function sponsorCardFee(owingCents: number, payer: SponsorFeePayer, taxRate: number | null, issued: boolean): SponsorCardFee {
  const sponsorPays = payer === 'sponsor' && !issued;
  const f = onlineFee(owingCents, sponsorPays ? 'family' : 'club');
  const feeTaxCents = sponsorPays && taxRate ? Math.round(f.feeCents * taxRate / 100) : 0;
  const totalCents = f.totalCents + feeTaxCents;
  const stripeCostCents = stripeStandardCostCents(totalCents, f.rail);
  return {
    ...f,
    baseCents: owingCents + feeTaxCents,
    totalCents,
    stripeCostCents,
    applicationFeeCents: f.feeCents - stripeCostCents,
    clubReceivesCents: totalCents - f.feeCents,
    feeTaxCents,
    owingCents,
  };
}

/**
 * One payment's fee split across the children it covers (Stage 12b, `online_payment_items.fee_share`): each child's share
 * is in proportion to its amount, rounded down, and the last child takes the cents left over — so the shares always sum
 * to the fee exactly. A share is what a FULL refund of that child gives back when A2's box is ticked.
 */
export function splitFeeAcross(feeCents: number, amountsCents: readonly number[]): number[] {
  const base = amountsCents.reduce((s, a) => s + a, 0);
  if (!amountsCents.length || base <= 0) return amountsCents.map(() => 0);
  const shares = amountsCents.map(a => Math.floor((feeCents * a) / base));
  shares[shares.length - 1] += feeCents - shares.reduce((s, x) => s + x, 0);
  return shares;
}

/** Dollars as stored in the books (numeric(12,2)) → cents, without float drift. */
export function toCents(dollars: number | string): number {
  const n = typeof dollars === 'string' ? Number(dollars) : dollars;
  if (!Number.isFinite(n)) throw new Error('Not an amount');
  return Math.round(n * 100);
}

/** Cents → the dollars the books store. */
export function toDollars(cents: number): number {
  return Math.round(cents) / 100;
}
