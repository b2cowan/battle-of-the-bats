import type Stripe from 'stripe';

/**
 * A CARD DISPUTE, AS STRIPE SAYS IT AND AS A SCREEN READS IT (Club Tier Stage 12d-1 Part 3; words
 * CLUB_TIER_STAGE12D_COPY.md §1; plan §0 "Stripe facts"). Pure, so the landing, the record's read and both screens give
 * one answer.
 *
 * Stripe's statuses: `warning_*` is an INQUIRY (the bank is only asking; nothing is taken, no fee when it closes);
 * `needs_response` / `under_review` a dispute; `won`, `lost`, `prevented` decided. A closed inquiry and a prevented
 * dispute read "won" (nothing was lost); a cardholder who withdraws it is closed by Stripe as won.
 */

export const DISPUTE_STATUSES = [
  'warning_needs_response', 'warning_under_review', 'warning_closed',
  'needs_response', 'under_review', 'won', 'lost', 'prevented',
] as const;
export type DisputeStatus = typeof DISPUTE_STATUSES[number];

/** The open statuses (mig 390's partial index `online_payment_disputes_open_idx` holds the same four). */
export const OPEN_DISPUTE_STATUSES = ['warning_needs_response', 'warning_under_review', 'needs_response', 'under_review'] as const;
const OPEN = new Set<string>(OPEN_DISPUTE_STATUSES);

export const isDisputeOpen = (status: string): boolean => OPEN.has(status);
export const isInquiry = (status: string): boolean => status.startsWith('warning_');
/** How a dispute reads now: still open, or decided won (a closed inquiry and a prevented dispute included) or lost. */
export function disputeOutcome(status: string): 'open' | 'won' | 'lost' {
  if (OPEN.has(status)) return 'open';
  return status === 'lost' ? 'lost' : 'won';
}

/** What `online_payment_dispute_apply` is given: Stripe's own figures at this read, never our arithmetic. */
export type DisputeRead = {
  status: DisputeStatus;
  reason: string | null;
  amount: number;
  /** What Stripe took of the disputed amount and still holds (withdrawn less reinstated), in dollars. */
  held: number;
  dueBy: string | null;
  answered: boolean;
  /** Stripe's dispute fee as Stripe charged it on the club's balance; null until Stripe reports one. */
  stripeFee: number | null;
  /** 'club' when that fee came off the club's own Stripe balance (the sandbox's card case, ruling 5): recorded, never
   *  invoiced. A fee Stripe charges FieldLogicHQ instead is read from the platform's balance (`platformDisputeFees`). */
  feePaidFrom: 'club' | null;
  livemode: boolean;
  openedAt: string;
};

const cents = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 0);
const iso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);

/**
 * Stripe's dispute (read on the club's account) as we store it. Null for a status this code does not know, so a new
 * Stripe status is acknowledged and logged rather than refused forever by the database.
 *
 * Its balance transactions are the club's own: a withdrawal is a negative amount with the dispute fee as its fee, a
 * reinstatement a positive amount. Held = withdrawn less reinstated. The fee is what the withdrawals charged (ruling 6:
 * "Stripe took its dispute fee, {disputeFee}, from the club’s Stripe balance"); an answering fee is not broken out by
 * Stripe here, so it is not separated (plan §0: none appeared in the sandbox).
 */
export function disputeFromStripe(d: Stripe.Dispute): DisputeRead | null {
  if (!(DISPUTE_STATUSES as readonly string[]).includes(d.status)) return null;
  const txns = Array.isArray(d.balance_transactions) ? d.balance_transactions : [];
  const moved = txns.reduce((s, t) => s + cents(t.amount), 0);
  const fee = txns.filter(t => cents(t.amount) < 0).reduce((s, t) => s + cents(t.fee), 0);
  const evidence = d.evidence_details;
  const answered = (evidence?.submission_count ?? 0) > 0 || d.status === 'under_review' || d.status === 'warning_under_review';
  return {
    status: d.status as DisputeStatus,
    reason: d.reason ? String(d.reason).slice(0, 60) : null,
    amount: cents(d.amount) / 100,
    held: Math.max(-moved, 0) / 100,
    dueBy: iso(evidence?.due_by),
    answered,
    stripeFee: fee > 0 ? fee / 100 : null,
    feePaidFrom: fee > 0 ? 'club' : null,
    livemode: d.livemode,
    openedAt: iso(d.created) ?? new Date().toISOString(),
  };
}

/** A dispute as the record and the row read it (`online_payment_disputes`, camel-cased by the server's read). */
export type DisputeView = {
  id: string;
  status: string;
  reason: string | null;
  amount: number;
  held: number;
  dueBy: string | null;
  answered: boolean;
  answeredAt: string | null;
  openedAt: string;
  closedAt: string | null;
  stripeFee: number | null;
  feePaidFrom: 'club' | 'platform' | null;
  stripeDisputeId: string;
  /** When a loss was booked (the returned line), and when a later win put it back. */
  lostBookedAt: string | null;
  wonBackAt: string | null;
  openedEmailedAt: string | null;
};

/**
 * A dispute as ONE reader's record shows it (words §1.2): the facts everyone who opens the record reads, and what this
 * reader may do. Amber and "Answer in Stripe" are the answerer's alone (`youAnswer`); "Copy the facts" goes to whoever
 * refunds in that flow and the owner (`canCopy`); the dispute fee line to the owner (`showFee`). The treasurer reads it
 * all with no button.
 */
export type DisputeRecord = DisputeView & {
  receiptNo: number | null;
  /** The person who set up payouts, as the club holds their name. */
  answererName: string;
  youAnswer: boolean;
  canCopy: boolean;
  showFee: boolean;
  /** `{invoiceWhere}` for a fee Stripe charged FieldLogicHQ (12d-1 Part 4): the next subscription invoice, or the club's
   *  own; null when there is no such fee or this reader doesn't read the fee line. */
  feeWhere: 'next' | 'own' | null;
  /** `{factsList}` (the sentence under the buttons) and the text "Copy the facts" puts on the clipboard (§1.3). */
  factsList: string;
  factsText: string;
  /** A payment refunded in full before the dispute (`dispute.refunded`). */
  refundedOn: string | null;
  /** The first names when one payment covered two or more children (`dispute.siblings`). */
  children: string[];
  /** First names a win could not put back because the child paid again another way (`dispute.againAfterOther`). */
  paidAgain: string[];
  /** The lost sentence's `{owesAgain}` ("Henry owes $150.00 again"). */
  owesAgain: string;
  book: 'season' | 'tournament';
};

/** The one dispute a payment's row and record speak of: the open one first, else the latest. */
export function currentDispute<T extends Pick<DisputeView, 'status' | 'openedAt'>>(list: readonly T[]): T | null {
  if (!list.length) return null;
  const open = list.filter(d => isDisputeOpen(d.status));
  const pool = open.length ? open : list;
  return [...pool].sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0];
}

/** The chip a row wears (words §1.1): an inquiry, a dispute waiting, answered and with the bank, or past due unanswered. */
export type DisputeChip = 'inquiry' | 'disputed' | 'withBank' | 'notAnswered';
export function disputeChip(d: Pick<DisputeView, 'status' | 'answered' | 'dueBy'>, now: Date = new Date()): DisputeChip | null {
  if (!isDisputeOpen(d.status)) return null;
  if (d.answered) return 'withBank';
  if (d.dueBy && new Date(d.dueBy).getTime() < now.getTime()) return 'notAnswered';
  return isInquiry(d.status) ? 'inquiry' : 'disputed';
}

/** No refund while a dispute is open (words §1.2 `dispute.noRefund`): Stripe already took the money back. An inquiry took
 *  nothing, and a refund is Stripe's own way to settle one (/review 2026-10-27), so an inquiry never blocks. */
export const blocksRefund = (status: string): boolean => isDisputeOpen(status) && !isInquiry(status);
export const refundBlockedByDispute = (list: readonly Pick<DisputeView, 'status'>[]): boolean => list.some(d => blocksRefund(d.status));
