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
 * Either way the application fee FieldLogicHQ takes is the whole fee: FieldLogicHQ pays Stripe's own processing fee out
 * of it (the 2026-07-28 model, plan §0c).
 */
import { FOREIGN_CARD_EXTRA_BPS, ONLINE_PAYMENT_RATES, type OnlinePaymentRail } from './plan-config';

export type OnlineFeePayer = 'family' | 'club';

export const ONLINE_FEE_PAYERS: readonly OnlineFeePayer[] = ['family', 'club'];

export interface OnlineFee {
  /** What the payment is for — the amount the flow's own writer records (the team's entry fee, the deposit). */
  baseCents: number;
  /** The processing fee, whoever pays it. */
  feeCents: number;
  /** What the payer is charged. */
  totalCents: number;
  /** FieldLogicHQ's application fee: the whole fee. */
  applicationFeeCents: number;
  /** What reaches the club's Stripe balance from this payment. */
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
  return {
    baseCents,
    feeCents,
    totalCents,
    applicationFeeCents: feeCents,
    clubReceivesCents: totalCents - feeCents,
    feePayer,
    rail,
    pctBps,
    flatCents,
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

/**
 * Stripe's extra on a card issued outside the club's country (12d-1 Part 4), billed to the CLUB from the published rate on
 * what the card was charged, rounded to the cent. Never added to what a family or team pays.
 */
export function foreignCardFeeCents(chargedCents: number): number {
  return Math.round((chargedCents * FOREIGN_CARD_EXTRA_BPS) / 10000);
}

/** Cents → the dollars the books store. */
export function toDollars(cents: number): number {
  return Math.round(cents) / 100;
}
