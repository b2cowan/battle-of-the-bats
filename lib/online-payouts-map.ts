/**
 * A STRIPE PAYOUT, READ AS PEOPLE (Club Tier Stage 12d-2 Part 2 — frame 3, words CLUB_TIER_STAGE12D_COPY.md §3).
 *
 * Pure: the server read (`lib/online-payouts.ts`) hands in Stripe's payouts and the balance transactions inside each, and
 * our own rows for the payments they came from; this names every line. Stripe's facts (plan §0, 12d-2 state, and the
 * sandbox probe there): a card payment is a `charge` line and a bank debit a `payment` line, each with the charge as its
 * source (`ch_` / `py_`); a refund is `refund` / `payment_refund` (source `re_`); a bank debit returned after Stripe
 * counted it is `payment_failure_refund` (or `payment_reversal`), with our fee given back as an `adjustment` of category
 * `fee`; a dispute is an `adjustment` of category `dispute` (Stripe's fee on it rides as its `fee`), won back as
 * `dispute_reversal`. ⚠ Never a bare Stripe type on screen: a line we cannot tie to a row of ours is "Not from
 * FieldLogicHQ", named by what we know and never by a guessed person.
 * Amounts are what reached the club (Stripe's `net`, in cents here, dollars out).
 */

export type PayoutStatus = 'on_its_way' | 'paid' | 'failed';
/** What a payout's contents can be read as: listed; a manual payout (Stripe lists automatic ones only); one Stripe is
 *  still matching (`reconciliation_status: in_progress`); none (a payout that didn't arrive carries its money back). */
export type PayoutContents = 'listed' | 'manual' | 'matching' | 'none';
export type PayoutFailReason = 'closed' | 'invalid' | null;

export type PayoutLineKind =
  | 'payment' | 'refund' | 'refund_back' | 'returned' | 'fee_back' | 'dispute' | 'dispute_won'
  | 'stripe_fee' | 'payout_back' | 'not_ours';

/** One balance transaction, as the read hands it in. `sourceCharge` is the charge behind a refund or a dispute source
 *  (from the expanded source), so a refund or dispute of ours with no row of its own still finds its payment. */
export interface BtIn {
  id: string;
  type: string;
  reportingCategory: string | null;
  net: number;
  created: number;
  sourceId: string | null;
  sourceCharge: string | null;
}

/** One payment of ours, already named (who paid, what for). */
export interface OurPayment {
  id: string;
  chargeId: string | null;
  paymentIntentId: string | null;
  /** A bank debit's reversing dispute (12c keeps it on the payment). */
  disputeId: string | null;
  receiptNo: number | null;
  rail: 'card' | 'bank_debit';
  who: string;
  /** "House league" or "{tournamentName} balance" — the rail is added here. */
  what: string;
}

export interface OurIndex {
  payments: readonly OurPayment[];
  /** Stripe refund id → our payment id. */
  refunds: Readonly<Record<string, string>>;
  /** Stripe dispute id → our payment id (card disputes, 12d-1's table). */
  disputes: Readonly<Record<string, string>>;
  /** Only for the bank check (Bank reconciliation R2a): the club-book lines behind each of our rows. Absent for the
   *  Payouts tab, whose lines then carry no `entryIds`. */
  entries?: PayoutEntryIndex;
}

/**
 * THE BOOK LINES BEHIND A PAYOUT'S LINES (Bank reconciliation R2a; census of the writers 2026-11-04, latest definitions):
 * - a payment: the tournament receipt (`tournament_team_payments.entry_id` by `online_payment_id`) or each child's
 *   house-league receipt (`online_payment_items.entry_id`), plus a club-pays "Payment processing" cost
 *   (`online_payments.processing_cost_entry_id`, both flows);
 * - a refund: `online_payment_refunds.refund_entry_id` + `processing_cost_entry_id` (a fee paid back);
 * - a card dispute lost: `online_payment_disputes.taken_back` (`entryId` for a team, `children[].entryId` for a
 *   league); won after a loss: `won_back.back[].entryId`;
 * - a bank debit reversed after it landed: not stored by its writer, so found by source (tournament: the payment's
 *   "Returned by the bank" line; league: each child's `registration_returned` line).
 * A Stripe fee, a fee given back, a refund that bounced and a failed payout carried back have NO book line.
 */
export interface PayoutEntryIndex {
  /** Our payment id → its receipt line(s) and its club-pays processing cost. */
  payments: Readonly<Record<string, readonly string[]>>;
  /** Stripe refund id → the refund's lines. */
  refunds: Readonly<Record<string, readonly string[]>>;
  /** Our payment id → the lines a bank debit's reversal booked. */
  reversals: Readonly<Record<string, readonly string[]>>;
  /** Stripe dispute id → what our book holds for it (card disputes). */
  disputes: Readonly<Record<string, DisputeFacts>>;
}

export interface DisputeFacts {
  /** The disputed amount and Stripe's dispute fee, as stored (cents). */
  amountCents: number;
  feeCents: number;
  /** The lines a loss booked (empty until it is lost and booked: the "held" case). */
  lostEntryIds: readonly string[];
  /** The lines a win after a loss booked. */
  wonEntryIds: readonly string[];
}

export interface PayoutLine {
  id: string;
  kind: PayoutLineKind;
  /** The day Stripe recorded it (an instant; the screen prints the club's day). */
  at: string;
  who: string | null;
  what: string;
  receiptNo: number | null;
  amount: number;
  /** Bank check only (`OurIndex.entries` given): the club-book lines this Stripe line booked. */
  entryIds?: string[];
  /** Bank check only: the card dispute of ours a `dispute` / `dispute_won` line is, with our stored amount and fee. */
  dispute?: { id: string; amountCents: number; feeCents: number };
}

export const PAYOUT_LINE_WORDS = {
  rail: { card: 'card', bank_debit: 'bank debit' } as Record<OurPayment['rail'], string>,
  refund: { card: 'Refund to the card', bank_debit: 'Refund to the bank account' } as Record<OurPayment['rail'], string>,
  // Derived (no words-doc key), owed to /marketing: a refund Stripe couldn't deliver, which came back to the club.
  refundBack: 'Refund didn’t reach the card',
  // 12c's own word for a debit the bank took back (`BANK_DEBIT_WORDS.receiptReversedTitle`).
  returned: 'Returned by the bank',
  // Derived, owed to /marketing: our processing fee given back with a returned debit.
  feeBack: 'Processing fee returned',
  dispute: 'Dispute',
  disputeWon: 'Dispute won',
  // Derived, owed to /marketing: a Stripe fee taken from the club's own balance (12d-1 ruling 5).
  stripeFee: 'Stripe fee',
  // Derived, owed to /marketing: an earlier payout that didn't arrive, carried by this one (words §3.2's tip).
  payoutBack: 'From a payout that didn’t arrive',
  notOurs: 'Not from FieldLogicHQ',
} as const;

const cents = (n: number) => Math.round(n) / 100;

/** Stripe's payout status, as the list's chip. Pending and in transit are both on their way. */
export function payoutStatus(status: string): PayoutStatus {
  if (status === 'paid') return 'paid';
  if (status === 'failed' || status === 'canceled') return 'failed';
  return 'on_its_way';
}

/** Mapped failure codes only (words §3.2): anything else prints no reason. */
export function payoutFailReason(code: string | null | undefined): PayoutFailReason {
  if (code === 'account_closed') return 'closed';
  if (code === 'no_account' || code === 'invalid_account_number' || code === 'bank_account_restricted') return 'invalid';
  return null;
}

/** What Stripe can tell us is inside a payout. */
export function payoutContents(p: { status: string; automatic: boolean; reconciliationStatus: string | null }): PayoutContents {
  if (p.status === 'failed' || p.status === 'canceled') return 'none';
  if (!p.automatic || p.reconciliationStatus === 'not_applicable') return 'manual';
  if (p.reconciliationStatus === 'in_progress') return 'matching';
  return 'listed';
}

/** Name every line of one payout. The payout's own balance transaction is not a line (it IS the payout). */
export function mapPayoutLines(bts: readonly BtIn[], ours: OurIndex): PayoutLine[] {
  const byCharge = new Map<string, OurPayment>();
  const byId = new Map<string, OurPayment>();
  const byBankDispute = new Map<string, OurPayment>();
  for (const p of ours.payments) {
    byId.set(p.id, p);
    if (p.chargeId) byCharge.set(p.chargeId, p);
    if (p.disputeId) byBankDispute.set(p.disputeId, p);
  }
  const ofCharge = (id: string | null) => (id ? byCharge.get(id) ?? null : null);
  const ofRefund = (b: BtIn) => (b.sourceId && ours.refunds[b.sourceId] ? byId.get(ours.refunds[b.sourceId]) ?? null : null) ?? ofCharge(b.sourceCharge);
  const ofDispute = (b: BtIn) =>
    (b.sourceId && ours.disputes[b.sourceId] ? byId.get(ours.disputes[b.sourceId]) ?? null : null)
    ?? (b.sourceId ? byBankDispute.get(b.sourceId) ?? null : null)
    ?? ofCharge(b.sourceCharge);

  const ent = ours.entries;
  /** The book lines behind one Stripe line, only when the bank check asked (the Payouts tab's lines stay as they were). */
  const booked = (kind: PayoutLineKind, b: BtIn, p: OurPayment | null): Pick<PayoutLine, 'entryIds' | 'dispute'> => {
    if (!ent) return {};
    const sid = b.sourceId;
    const d = sid ? ent.disputes[sid] : undefined;
    const reversed = p ? ent.reversals[p.id] ?? [] : [];
    const ids: readonly string[] =
      (kind === 'payment' ? p && ent.payments[p.id]
        : kind === 'refund' ? sid && ent.refunds[sid]
        : kind === 'dispute' ? (d ? d.lostEntryIds : reversed)
        : kind === 'dispute_won' ? d?.wonEntryIds
        : kind === 'returned' ? reversed
        : null) || [];
    return { entryIds: [...ids], ...(sid && d && (kind === 'dispute' || kind === 'dispute_won') ? { dispute: { id: sid, amountCents: d.amountCents, feeCents: d.feeCents } } : {}) };
  };

  const lines: PayoutLine[] = [];
  for (const b of bts) {
    if (b.type === 'payout') continue;
    const at = new Date(b.created * 1000).toISOString();
    const line = (kind: PayoutLineKind, p: OurPayment | null, what: string): PayoutLine =>
      ({ id: b.id, kind, at, who: p?.who ?? null, what, receiptNo: p?.receiptNo ?? null, amount: cents(b.net), ...booked(kind, b, p) });
    const notOurs = () => line('not_ours', null, PAYOUT_LINE_WORDS.notOurs);

    switch (b.type) {
      case 'charge':
      case 'payment': {
        const p = ofCharge(b.sourceId);
        lines.push(p ? line('payment', p, `${p.what} · ${PAYOUT_LINE_WORDS.rail[p.rail]}`) : notOurs());
        break;
      }
      case 'refund':
      case 'payment_refund': {
        const p = ofRefund(b);
        lines.push(p ? line('refund', p, PAYOUT_LINE_WORDS.refund[p.rail]) : notOurs());
        break;
      }
      case 'refund_failure': {
        const p = ofRefund(b);
        lines.push(p ? line('refund_back', p, PAYOUT_LINE_WORDS.refundBack) : notOurs());
        break;
      }
      case 'payment_failure_refund':
      case 'payment_reversal': {
        const p = ofCharge(b.sourceId) ?? ofCharge(b.sourceCharge);
        lines.push(p ? line('returned', p, PAYOUT_LINE_WORDS.returned) : notOurs());
        break;
      }
      case 'adjustment': {
        if (b.reportingCategory === 'dispute' || b.reportingCategory === 'dispute_reversal') {
          const p = ofDispute(b);
          const won = b.reportingCategory === 'dispute_reversal';
          lines.push(p ? line(won ? 'dispute_won' : 'dispute', p, won ? PAYOUT_LINE_WORDS.disputeWon : PAYOUT_LINE_WORDS.dispute) : notOurs());
        } else if (b.reportingCategory === 'fee') {
          const p = ofCharge(b.sourceId) ?? ofCharge(b.sourceCharge);
          lines.push(p ? line('fee_back', p, PAYOUT_LINE_WORDS.feeBack) : notOurs());
        } else {
          lines.push(notOurs());
        }
        break;
      }
      case 'stripe_fee': {
        const p = b.sourceId ? ofDispute(b) ?? ofCharge(b.sourceId) : null;
        lines.push(line('stripe_fee', p, PAYOUT_LINE_WORDS.stripeFee));
        break;
      }
      case 'payout_failure':
      case 'payout_cancel':
        lines.push(line('payout_back', null, PAYOUT_LINE_WORDS.payoutBack));
        break;
      default:
        lines.push(notOurs());
    }
  }
  // Newest first, as the list is.
  return lines.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** The quiet count beside "Paid" (words §3.1 `payouts.counts`). */
export function payoutCounts(lines: readonly PayoutLine[]): { payments: number; refunds: number } {
  return {
    payments: lines.filter(l => l.kind === 'payment').length,
    refunds: lines.filter(l => l.kind === 'refund').length,
  };
}

/** Find (words §3.1 `payouts.find`): an amount ("1284.50", "$1,284.50") matches a payout's own amount or a line's; any
 *  other text matches a line's name or receipt. */
export function payoutMatches(p: { amount: number; lines: readonly PayoutLine[] }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const asAmount = q.replace(/[$,\s]/g, '').replace(/^−|^-/, '');
  if (/^\d+(\.\d{1,2})?$/.test(asAmount)) {
    const n = Number(asAmount);
    if (Math.abs(p.amount - n) < 0.005) return true;
    if (p.lines.some(l => Math.abs(Math.abs(l.amount) - n) < 0.005)) return true;
  }
  // A receipt is matched whole ("1084" finds receipt 1084, never 10840); a name by any part of it.
  return p.lines.some(l => (l.who ?? '').toLowerCase().includes(q) || (l.receiptNo != null && String(l.receiptNo) === q));
}

/** "Henry and Lily Grant" (one surname), "Ava Chen and Theo Grant" (two), "Ava, Ben and Cal Smith" (three, one surname). */
export function childrenWho(children: readonly { first: string; last: string }[]): string {
  if (children.length === 0) return '';
  const lasts = new Set(children.map(c => c.last));
  const join = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  if (lasts.size === 1) return `${join(children.map(c => c.first))} ${children[0].last}`.trim();
  return join(children.map(c => `${c.first} ${c.last}`.trim()));
}

/** The owner's card summary (words §3.3): what's on its way, and the last payout that arrived. */
export function payoutsSummary(payouts: readonly { status: PayoutStatus; amount: number; arrives: string | null; sent: string }[]): {
  onItsWay: number | null; lastPaid: { amount: number; day: string } | null;
} {
  const way = payouts.filter(p => p.status === 'on_its_way');
  const paid = payouts.find(p => p.status === 'paid');
  return {
    onItsWay: way.length ? Math.round(way.reduce((s, p) => s + p.amount, 0) * 100) / 100 : null,
    lastPaid: paid ? { amount: paid.amount, day: paid.arrives ?? paid.sent.slice(0, 10) } : null,
  };
}
