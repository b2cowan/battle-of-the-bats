/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A HOUSE-LEAGUE CARD REFUND, AS EVERY SCREEN READS IT (Club Tier Stage 12c Part 2; plan §0g; words
 * docs/projects/active/CLUB_TIER_STAGE12C_REFUND_VISIBLE_COPY.md §1–3).
 *
 * A refund to the card lives in `online_payment_refunds`; the season's book holds only its line (when the child's payment
 * was on the registration). This is the one shape the Fee cell, the record's "To the card" block, the history and the
 * Money page read, so a refund the card sent back never reads "refunded", and one that never entered the book is still
 * on the registration. Read once per screen (`loadCardRefunds`, server), never per row.
 *
 * Pure: no I/O, safe on the client.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { formatTime } from './utils';
import { utcToZonedInputs } from './timezone';
import { cardLabel } from './online-payment-words';

export interface CardRefund {
  id: string;
  /** The child (NULL once the registration is deleted). */
  regId: string | null;
  itemId: string;
  /** What went back to the card: the processing fee included when it went back. */
  amount: number;
  /** The part of `amount` that is the processing fee given back. */
  feeBack: number;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
  origin: 'app' | 'stripe_dashboard';
  /** Stripe accepted it and its lines were written (house league books at acceptance, mig 375). */
  booked: boolean;
  /** The refund's line in the season's book; NULL when the child's payment never went on the registration. */
  entryId: string | null;
  /** The child's payment went on the registration (`online_payment_items.entry_id`). */
  inBook: boolean;
  /** Why it didn't: the house-league writer's refusal code (`ended`, `already_received`, `over`, `not_accepted`, `gone`). */
  landError: string | null;
  /** Who ended it (A2): club_ended | family_left | price_corrected; NULL when the club paid the fee. */
  reason: string | null;
  partialReason: string | null;
  /** The card sent it back, and the club then sent it another way (mig 375's resolve keeps the card's failure). */
  sentAnotherWay: boolean;
  createdAt: string;
  succeededAt: string | null;
  failedAt: string | null;
  /** Stripe's refund id ("re_…"), the reference the club pastes into its dashboard. */
  reference: string | null;
  /** The person who pressed Refund (NULL for a refund made in Stripe). */
  by: string | null;
  /** The person who recorded it sent another way, after the card sent it back. */
  resolvedBy: string | null;
  rail: 'card' | 'bank_debit';
  cardBrand: string | null;
  cardLast4: string | null;
  bankLast4: string | null;
  receiptNo: number | null;
  paidAt: string | null;
  /** The child's amount and processing-fee share on that payment. */
  share: number;
  shareFee: number;
  familyPaidFee: boolean;
  emailedAt: string | null;
  emailFailedAt: string | null;
}

export type CardRefundState = 'refunded' | 'pending' | 'failed' | 'anotherWay';

/** A refund that happened (or is happening): Stripe accepted it, or it is still in flight. One Stripe refused before
 *  booking changed nothing, and the window said so — it is on no screen. */
export const isShown = (r: CardRefund) => r.booked || r.status === 'pending' || r.status === 'succeeded';

export function refundState(r: CardRefund): CardRefundState {
  if (r.sentAnotherWay) return 'anotherWay';
  if (r.status === 'failed') return 'failed';
  if (r.status === 'pending') return 'pending';
  return 'refunded';
}

export const isBank = (r: Pick<CardRefund, 'rail'>) => r.rail === 'bank_debit';

/** "Visa •••• 4242" · "the account ending 6789". */
export const refundTarget = (r: CardRefund) =>
  (isBank(r) ? `the account ending ${r.bankLast4 ?? '••••'}` : cardLabel(r.cardBrand, r.cardLast4));

/** The base that went back (the fee excluded): the figure the season's book carries for it. */
export const refundBase = (r: CardRefund) => Math.round((r.amount - r.feeBack) * 100) / 100;

/** "2:14 p.m." in the club's time zone. */
export const clockOf = (iso: string | null | undefined) => (iso ? formatTime(utcToZonedInputs(iso).time) : '');

/** Newest first, the order every list of them is read in. */
export const newestFirst = (list: readonly CardRefund[]) => [...list].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
