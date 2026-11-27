/**
 * THE CLUB'S SPONSORSHIP INVOICE — WHAT IT SAYS (Board Ready Stage 6 Part 3a; round 1 tabs 6 and 7, round 2 tab 2; asks 9
 * and 10; owner calls 2026-11-23). Pure and client-safe: the PDF (lib/club-sponsor-invoice-pdf.ts), the deal's money band,
 * the business's page and the tests read these same answers, so a figure is worked out once.
 *
 *   · The coach recipe (round 2 ask 2): every charge is a row of the one table — the sponsorship with its deliverables
 *     listed under it, then "HST 13%" when the deal carries tax — and Invoiced · Paid · Balance due carry the total.
 *   · No tax words at all on an untaxed invoice (round 1's "NO TAX WORDS": no field, line or "No GST/HST charged").
 *   · The paid invoice IS the receipt (ask 10): the same page, "Paid in full {date}" leading its subtitle, the payments
 *     received listed, no stamp. Never "donation", "gift" or "tax receipt".
 *   · A withdrawn invoice (owner call 3 at walk §562, 2026-11-23: "print Withdrawn on it"): the same page, "Withdrawn {date}"
 *     leading its subtitle as "Paid in full" does — the house has no stamps — with no How to pay and nothing owing.
 *   · The club's GST/HST number at the top only when the invoice carries tax; FieldLogicHQ's never (/accounting).
 */
import { formatStoredDate, orgDayKey } from './timezone';
import { cardLabel, money } from './online-payment-words';
import { DEAL_WORDS } from './club-sponsorship-deal-words';
import { formatGstNumber } from './club-sponsorships';
import { oneLineAddress } from './coach-sponsor-invoice';
import type { DealInvoice } from './club-sponsorship-deals';
import { DUES_PAYMENT_METHOD_LABEL, type DuesPaymentMethod } from './types';

/** A deal's recorded payment (mig 528). A voided one stays on record and counts for nothing. */
export interface DealPayment {
  id: string;
  amount: number;
  /** The part of it that is the GST/HST (its share, worked out by the database when it was recorded). */
  taxPart: number;
  receivedOn: string;
  method: DuesPaymentMethod;
  reference: string | null;
  note: string | null;
  recordedByName: string;
  /** When it was recorded (a card payment: when it landed). */
  recordedAt: string;
  voided: { at: string; byName: string; reason: string } | null;
  /** A card payment given back to the card in full (mig 531): it stays on record, and the money it held is owing again. */
  returned: boolean;
  /** The sponsor's bank took it back (a dispute the club lost, mig 532): it holds nothing, and finishing a refund on it asks
   *  nothing about the deal. Cleared if the dispute is later won. */
  disputeLost?: boolean;
  /** A card payment (Part 3b, mig 530): it landed from an online payment, is never voided, and comes off only by a refund. */
  card: DealCardFacts | null;
}

/** What a card payment carries beyond a cheque's (the payment's window, the drawing's tab 1). */
export interface DealCardFacts {
  brand: string | null;
  last4: string | null;
  /** When Stripe says it was paid (the window's "Mar 3 at 9:14 a.m."). */
  paidAt: string | null;
  /** Stripe's reference for the payment (its intent). */
  reference: string | null;
  /** Who paid the processing fee: the club (a Payment processing cost) or the sponsor (on its invoice, booked both ways). */
  feePaidBy: 'club' | 'sponsor';
  /** The processing fee. */
  fee: number;
  /** What the sponsor was charged for the fee (0 when the club paid it), and the GST/HST on that: inside amount, never refunded. */
  feeCharged: number;
  feeTax: number;
  /** The sponsor has a dispute open on it with their card company (not an inquiry): a refund is refused until it is decided, so the
   *  payment's window says so where the Refund button would be (Part 3b /ux at 390, decision 1, owner 2026-11-24). */
  disputed: boolean;
}

/** A refund to the card (Part 3b, mig 530): all of what was left or part of it. One made from the deal never includes the
 *  processing fee; one made in the club's own Stripe dashboard (mig 542, Stage 6 fixes Part A) can, after all of the sponsorship. */
export interface DealRefund {
  id: string;
  paymentId: string;
  amount: number;
  /** The GST/HST share of it (the sponsorship's tax, and on a Stripe refund that returned the fee, the fee's tax too: `feeTaxPart`). */
  taxPart: number;
  whole: boolean;
  /** It gave back the last of the deal's money, so the deal ended as Withdrawn (ask 3). */
  endsDeal: boolean;
  /** Why (the business reads it in the refund email). A refund made in Stripe has none until the club finishes it (mig 542). */
  reason: string | null;
  /** Where it was made: from the deal ('app'), or in the club's own Stripe dashboard ('stripe', mig 542). */
  origin: 'app' | 'stripe';
  /** The part of `amount` / `taxPart` that is the processing fee the sponsor was charged (only a Stripe refund returns it; else 0). */
  feePart: number;
  feeTaxPart: number;
  /** A Stripe refund: when Stripe made it, and Stripe's reason code ("requested_by_customer"). */
  stripeCreatedAt: string | null;
  stripeReason: string | null;
  /** A Stripe refund the club finished (its reason given, its credit note issued, the business emailed). */
  finished: { at: string; byName: string; outcome?: 'ended' | 'owing' | null } | null;
  /** A Stripe refund made after the sponsor's bank already took the payment back (a dispute the club lost): returned twice. */
  afterLostDispute: boolean;
  /** The credit note's own date when it was issued later than the money left (a Stripe refund finished on a later day). */
  creditOn: string | null;
  status: 'pending' | 'succeeded' | 'failed';
  failureReason: string | null;
  refundedOn: string | null;
  succeededAt: string | null;
  failedAt: string | null;
  createdAt: string;
  /** Who refunded it from the deal; nobody here made a refund in Stripe (who finished it is `finished.byName`). */
  createdByName: string | null;
  stripeRefundId: string | null;
  emailedAt: string | null;
  /** Its two ledger lines were written: a refund that failed with this false never moved anything, one that failed with it true had its lines voided. */
  booked: boolean;
  /** "2027-014-C1": the credit note a refund on a taxed invoice carries (/accounting 2026-11-23). */
  creditNumber: string | null;
}

/** A refund that moved money or is on its way (a failed one gave nothing back). */
export const refundCounts = (r: Pick<DealRefund, 'status'>): boolean => r.status !== 'failed';

/** A refund made in Stripe that went through and still needs the club: its reason, its credit note, its email (Part A, ask 1).
 *  One made after a lost dispute has nothing to finish (the money was already out of the books). */
export const refundToFinish = (r: Pick<DealRefund, 'origin' | 'status' | 'finished' | 'afterLostDispute'>): boolean =>
  r.origin === 'stripe' && r.status === 'succeeded' && !r.finished && !r.afterLostDispute;

/**
 * A refund in its four parts, to the cent (mig 542's split; the payment's window, the finish question and the credit note all
 * read these): the sponsorship before its tax, the sponsorship's tax, and — a Stripe refund that returned it — the processing
 * fee before its tax and the fee's tax. `sponsorship` is the sponsorship with its tax (what "what is left" counts).
 */
export function refundParts(r: Pick<DealRefund, 'amount' | 'taxPart' | 'feePart' | 'feeTaxPart'>): {
  sponsorship: number; sponsorshipPre: number; sponsorshipTax: number; feePre: number; feeTax: number;
} {
  const sponsorshipC = cents(r.amount) - cents(r.feePart);
  const sponsorshipTaxC = cents(r.taxPart) - cents(r.feeTaxPart);
  return {
    sponsorship: sponsorshipC / 100, sponsorshipPre: (sponsorshipC - sponsorshipTaxC) / 100, sponsorshipTax: sponsorshipTaxC / 100,
    feePre: (cents(r.feePart) - cents(r.feeTaxPart)) / 100, feeTax: cents(r.feeTaxPart) / 100,
  };
}

/** A refund made in Stripe after the sponsor's bank already took the payment back: the money went back twice. */
export const refundReturnedTwice = (r: Pick<DealRefund, 'afterLostDispute' | 'status'>): boolean => r.afterLostDispute && r.status === 'succeeded';

/** The day a refund made in Stripe was made there (Stripe's day, in club time); a refund from the deal, its own day. */
export const refundMadeOn = (r: Pick<DealRefund, 'stripeCreatedAt' | 'refundedOn' | 'createdAt'>): string =>
  r.stripeCreatedAt ? orgDayKey(r.stripeCreatedAt) : refundDay(r);

/** A refund that was booked (its credit note given), sent to the business, and then did not reach the card: its note is kept, cancelled. */
export const refundNoteCancelled = (r: Pick<DealRefund, 'status' | 'booked'>): boolean => r.status === 'failed' && r.booked;

/** A refund whose credit note can be downloaded: one that reached the card, or one whose note was cancelled. */
export const refundHasNote = (r: Pick<DealRefund, 'status' | 'booked' | 'creditNumber'>): boolean =>
  !!r.creditNumber && (r.status === 'succeeded' || refundNoteCancelled(r));

/** The day a refund went back: the day Stripe booked it, else the day it was opened (club time). */
export const refundDay = (r: Pick<DealRefund, 'refundedOn' | 'createdAt'>): string => r.refundedOn ?? orgDayKey(r.createdAt);

/** A refund that ended the deal (a whole refund of the last payment that held it — Withdrawn · refunded). */
export const refundsEndedDeal = (refunds: readonly Pick<DealRefund, 'status' | 'endsDeal'>[]): boolean =>
  refunds.some(r => r.endsDeal && refundCounts(r));

/** A withdrawn deal that money reached and that was refunded (Part 3b, ask 3) keeps its paper: its link still downloads the
 *  invoice and the credit note, and shows them. Nothing else opens on it. */
export const refundedAway = (d: { state: string; refunds?: readonly Pick<DealRefund, 'status'>[] }): boolean =>
  d.state === 'withdrawn' && !!d.refunds?.some(r => r.status === 'succeeded');

/** "2027-014-C1": an invoice's credit notes are numbered in the order they were given. */
export const creditNoteNumber = (invoiceNumber: string, seq: number): string => `${invoiceNumber}-C${seq}`;

/**
 * What a card payment can still give back (the drawing's tab 2; mig 530's `club_sponsor_card_refund_left`, the same sums):
 * its amount less the fee the sponsor paid and that fee's tax, less the sponsorship part of every refund that hasn't failed
 * (mig 542: a Stripe refund's fee part never came out of what the deal can give back). `taxLeft` is the sponsorship's tax still on it.
 */
export function refundLeft(p: Pick<DealPayment, 'id' | 'amount' | 'taxPart' | 'card'>, refunds: readonly Pick<DealRefund, 'paymentId' | 'status' | 'amount' | 'taxPart' | 'feePart' | 'feeTaxPart'>[]): {
  refundable: number; left: number; taxLeft: number;
} {
  const feeC = cents(p.card?.feeCharged ?? 0) + cents(p.card?.feeTax ?? 0);
  const mine = refunds.filter(r => r.paymentId === p.id && refundCounts(r));
  const refundableC = cents(p.amount) - feeC;
  const leftC = refundableC - mine.reduce((s, r) => s + cents(r.amount) - cents(r.feePart), 0);
  const taxLeftC = cents(p.taxPart) - cents(p.card?.feeTax ?? 0) - mine.reduce((s, r) => s + cents(r.taxPart) - cents(r.feeTaxPart), 0);
  return { refundable: refundableC / 100, left: Math.max(0, leftC) / 100, taxLeft: Math.max(0, taxLeftC) / 100 };
}

/** The GST/HST share of a refund of `amount` (mig 530's rule): in proportion, the refund that empties the payment taking the rest. */
export function refundTaxPart(p: Pick<DealPayment, 'id' | 'amount' | 'taxPart' | 'card'>, refunds: readonly DealRefund[], amount: number): number {
  const { refundable, left, taxLeft } = refundLeft(p, refunds);
  if (taxLeft <= 0 || refundable <= 0) return 0;
  const taxBaseC = cents(p.taxPart) - cents(p.card?.feeTax ?? 0);
  const t = cents(amount) === cents(left) ? cents(taxLeft) : Math.round(cents(amount) * taxBaseC / cents(refundable));
  return Math.max(0, Math.min(t, cents(taxLeft), cents(amount))) / 100;
}

/** Does giving back all of what is left on this payment end the deal? Only when no other payment still holds money on it
 *  (a cheque never comes back by card; a card payment already given back holds nothing). */
export function refundEndsDeal(payments: readonly DealPayment[], refunds: readonly DealRefund[], paymentId: string): boolean {
  return payments.every(o => o.id === paymentId || !!o.voided || o.returned || (!!o.card && refundLeft(o, refunds).left <= 0));
}

/**
 * Does finishing this refund made in Stripe ask what happens to the deal (Part A, ask 2)? Only when it gave back the last of the
 * deal's money: every refundable dollar of its payment back by refunds that went through (mig 542's `club_sponsor_card_returned`),
 * and no other payment still standing, on a deal not already withdrawn. The database asks the same and refuses a mismatch.
 */
export function finishAsksOutcome(payments: readonly DealPayment[], refunds: readonly DealRefund[], refund: Pick<DealRefund, 'paymentId'> & { id?: string }, dealState: string): boolean {
  const p = payments.find(x => x.id === refund.paymentId);
  if (!p?.card || p.disputeLost || dealState === 'withdrawn') return false;
  // Asked once per payment: a later refund on it never asks again.
  if (refunds.some(r => r.paymentId === p.id && r.id !== refund.id && r.status === 'succeeded' && r.finished?.outcome)) return false;
  // Back means went through: "what is left" over the refunds that succeeded only (one on its way is not back yet).
  return refundLeft(p, refunds.filter(r => r.status === 'succeeded')).left <= 0 && payments.every(o => o.id === p.id || !!o.voided || o.returned);
}

/**
 * What a finish that asks nothing leaves the deal reading (mig 542): a paid deal whose standing money no longer covers the
 * invoice, once a payment given back in full stops counting, owes again; a paid deal still covered stays paid. A deal already
 * invoiced owes that payment's money too once it is all back (unless the bank took it: a lost dispute). Anything else is not
 * moved, so nothing is said about it.
 */
export function finishLeavesDeal(payments: readonly DealPayment[], refunds: readonly DealRefund[], refund: Pick<DealRefund, 'paymentId'>, dealState: string, total: number): 'paid' | 'owing' | null {
  const p = payments.find(x => x.id === refund.paymentId);
  const full = !!p?.card && refundLeft(p, refunds.filter(r => r.status === 'succeeded')).left <= 0;
  if (dealState !== 'paid' && !(dealState === 'invoiced' && full && !p?.disputeLost)) return null;
  const standingC = payments.filter(o => !o.voided && !o.returned && !(full && o.id === p?.id)).reduce((s, o) => s + cents(o.amount), 0);
  return standingC >= cents(total) ? 'paid' : 'owing';
}

/**
 * Why "They still owe it" can't be chosen yet (mig 542, owner 2026-11-26), or null when it can. 'fee': part of what the
 * sponsor paid on that payment (the processing fee) is still with the club, so owing it all again would charge it twice;
 * `left` is how much. 'noted': an earlier refund on the payment already has a credit note, which reduced the invoice.
 */
export function owingBlock(payments: readonly DealPayment[], refunds: readonly DealRefund[], refund: Pick<DealRefund, 'paymentId'> & { id?: string }):
  { why: 'fee'; left: number } | { why: 'noted' } | null {
  const p = payments.find(x => x.id === refund.paymentId);
  if (!p) return null;
  const mine = refunds.filter(r => r.paymentId === p.id && r.status === 'succeeded');
  if (mine.some(r => r.id !== refund.id && r.creditNumber)) return { why: 'noted' };
  const leftC = cents(p.amount) - mine.reduce((s, r) => s + cents(r.amount), 0);
  return leftC > 0 ? { why: 'fee', left: leftC / 100 } : null;
}

/** Does finishing leave the money owed again, so that no credit note is given (mig 542's `v_owed_again`)? `outcome` is the
 *  club's choice when it is asked. */
export function finishOwesAgain(payments: readonly DealPayment[], refunds: readonly DealRefund[], refund: Pick<DealRefund, 'paymentId'> & { id?: string }, dealState: string, total: number, outcome: 'ended' | 'owing' | null): boolean {
  if (refunds.some(r => r.paymentId === refund.paymentId && r.id !== refund.id && r.status === 'succeeded' && r.finished?.outcome === 'owing')) return true;
  return finishAsksOutcome(payments, refunds, refund, dealState) ? outcome === 'owing' : finishLeavesDeal(payments, refunds, refund, dealState, total) === 'owing';
}

/** The credit note a refund finished now would carry ("2027-014-C2"): the deal's next number, on a taxed invoice only. */
export function nextCreditNumber(invoiceNumber: string, taxed: boolean, refunds: readonly Pick<DealRefund, 'creditNumber'>[]): string | null {
  if (!taxed) return null;
  const seqs = refunds.map(r => Number(/-C(\d+)$/.exec(r.creditNumber ?? '')?.[1] ?? 0));
  return creditNoteNumber(invoiceNumber, Math.max(0, ...seqs) + 1);
}

/** What has gone back to the card on a deal (refunds on their way included; a failed one gave nothing back). */
export const refundedTotal = (refunds: readonly DealRefund[]): number =>
  refunds.filter(refundCounts).reduce((s, r) => s + cents(r.amount), 0) / 100;

/** "Cheque 004417" — how it arrived, with its number when there is one. */
export const paymentHow = (p: Pick<DealPayment, 'method' | 'reference'> & { card?: DealPayment['card'] }): string =>
  // A card payment names its card (the drawing's tab 1: "Card, Visa •••• 4242").
  p.card ? `Card, ${cardLabel(p.card.brand, p.card.last4)}`
    : [DUES_PAYMENT_METHOD_LABEL[p.method] ?? p.method, p.reference?.trim() || null].filter(Boolean).join(' ');

/** The invoice's row for a processing fee the sponsor paid by card (round 2 tab 2). */
export const CARD_FEE_ROW = 'Processing fee';

const cents = (n: number) => Math.round(n * 100);

/** What has arrived against an invoice: paid, still owing, and the day it was paid in full (the last arrival's). */
export function invoiceStanding(total: number, payments: readonly DealPayment[]): {
  paid: number; owing: number; paidInFull: boolean; paidOn: string | null; live: DealPayment[]; listed: DealPayment[];
} {
  // `listed`: every payment not voided, for the paper. `live`: those that still HOLD money. A card payment given back in full
  // (mig 531) or lost to a dispute (mig 532) stays on record, listed, but holds none: it is owing again.
  const listed = payments.filter(p => !p.voided).sort((a, b) => a.receivedOn.localeCompare(b.receivedOn));
  const live = listed.filter(p => !p.returned);
  const paidC = live.reduce((s, p) => s + cents(p.amount), 0);
  const owingC = Math.max(0, cents(total) - paidC);
  const paidInFull = live.length > 0 && owingC === 0;
  return { paid: paidC / 100, owing: owingC / 100, paidInFull, paidOn: paidInFull ? live[live.length - 1].receivedOn : null, live, listed };
}

/** One line of the sum on the sponsor's page, from the invoice total to what is owing: a payment takes money off, a refund or a
 *  reversed card payment puts it back. */
export interface OwingRow {
  kind: 'paid' | 'refunded' | 'reversed';
  amount: number;
  /** The payment's or refund's day; a reversal has none (the only day on record is the one the loss was booked). */
  on: string | null;
  method?: DuesPaymentMethod;
}

/** An invoice that owes money AGAIN, as the sponsor's page says it (owner 2026-11-27, all A). */
export interface OwingAgain {
  /** What the page may say happened. 'other': it can't name one cause (the lines would not add up, a refund and a reversal
   *  are both on the deal, or a voided payment may be why it owes), so it says only that the invoice is owing. */
  cause: 'refund' | 'reversal' | 'other';
  refundCount: number;
  /** Null when the lines would not add up to what is owing (a part refund on a payment that still counts, a refund on its way,
   *  money that went back twice): the page then shows the total and what is owing, and lists the refunds without a sum. */
  rows: OwingRow[] | null;
  /** The processing fee the sponsor paid by card, with its tax: said only when the lines add up, the whole invoice is owed and
   *  the invoice was never revised (a revision keeps the old fee figure though the new total doesn't include it). */
  fee: { amount: number; taxed: boolean } | null;
}

/** Null unless money is owing after a refund went through, or after a card payment the sponsor's bank took back. */
export function owingAgain(
  invoice: Pick<DealInvoice, 'total' | 'cardFee' | 'cardFeeTax'>, payments: readonly DealPayment[], refunds: readonly DealRefund[], owing: number,
  revised: boolean,
): OwingAgain | null {
  const listed = invoiceStanding(invoice.total, payments).listed;
  const done = refunds.filter(r => r.status === 'succeeded');
  const lost = listed.filter(p => p.disputeLost);
  if (owing <= 0 || (!done.length && !lost.length)) return null;
  const rows: OwingRow[] = [
    ...listed.map(p => ({ kind: 'paid' as const, amount: p.amount, on: p.receivedOn, method: p.method })),
    ...done.map(r => ({ kind: 'refunded' as const, amount: r.amount, on: refundDay(r) })),
    ...lost.map(p => ({ kind: 'reversed' as const, amount: p.amount, on: null })),
  ];
  const sumC = rows.reduce((s, r) => s + (r.kind === 'paid' ? -cents(r.amount) : cents(r.amount)), cents(invoice.total));
  const addsUp = sumC === cents(owing) && !refunds.some(r => r.status === 'pending');
  const feeC = cents(invoice.cardFee ?? 0) + cents(invoice.cardFeeTax ?? 0);
  return {
    cause: !addsUp || (lost.length && done.length) || payments.some(p => p.voided) ? 'other' : lost.length ? 'reversal' : 'refund',
    refundCount: done.length,
    rows: addsUp ? rows : null,
    fee: addsUp && !revised && feeC > 0 && cents(owing) === cents(invoice.total) ? { amount: feeC / 100, taxed: !!invoice.cardFeeTax } : null,
  };
}

/** The payments the PAPER lists: every one not voided, except a payment that no longer holds money and has no refund to show for it (a
 *  dispute the club lost: the bank took it, nothing was refunded, and the invoice reads as owing again). */
export const paymentsOnPaper = (listed: readonly DealPayment[], refunds: readonly Pick<DealRefund, 'paymentId' | 'status'>[]): DealPayment[] =>
  listed.filter(p => !p.returned || refunds.some(r => r.paymentId === p.id && r.status === 'succeeded'));

/** "Mar 3 to Aug 31, 2027" — the year once when both days share it. */
export function periodLabel(from: string, to: string): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${formatStoredDate(from, { withYear: !sameYear })} to ${formatStoredDate(to, { withYear: true })}`;
}

export interface ClubInvoiceInput {
  club: { name: string; mailingAddress: string | null; gstHstNumber: string | null; contactName: string | null; contactEmail: string | null };
  howToPay: { etransferTo: string | null; chequesPayableTo: string | null };
  /** `withdrawnAt`: the deal was withdrawn after its invoice was issued (owner call 3 at walk §562: the club's paper still
   *  downloads, saying "Withdrawn" so nobody pays it by mistake). */
  deal: { packageName: string; placeName: string | null; bullets: string[]; endsOn: string | null; revisedOn: string | null; withdrawnAt?: string | null };
  invoice: DealInvoice;
  billTo: { name: string; contactName: string | null; address: string | null; email: string | null };
  payments: readonly DealPayment[];
  /** Its card refunds (Part 3b, ask 7: "the invoice lists the refund"); a failed one gave nothing back and isn't listed. */
  refunds?: readonly DealRefund[];
}

/** The page's content (the PDF's settings — colour, crest, footer — are added by the server). */
export function clubInvoiceLayout(i: ClubInvoiceInput) {
  const inv = i.invoice;
  const standing = invoiceStanding(inv.total, i.payments);
  const taxed = !!inv.taxKind && inv.tax > 0;
  const what = `Sponsorship: ${i.deal.packageName}${i.deal.placeName ? `, ${i.deal.placeName}` : ''}`;
  const rows: { description: string; sub?: string[]; amount: string }[] = [
    {
      description: i.deal.endsOn && i.deal.endsOn >= inv.issuedOn ? `${what} · ${periodLabel(inv.issuedOn, i.deal.endsOn)}` : what,
      sub: i.deal.bullets,
      amount: money((cents(inv.total) - cents(inv.tax) - cents(inv.cardFee ?? 0)) / 100),
    },
    // The fee the sponsor paid by card is its own row, its tax inside the tax row (round 2 tab 2).
    ...(inv.cardFee ? [{ description: CARD_FEE_ROW, amount: money(inv.cardFee) }] : []),
    ...(taxed ? [{ description: `${inv.taxKind} ${inv.taxRate}%`, amount: money(inv.tax) }] : []),
  ];
  const refunds = (i.refunds ?? []).filter(refundCounts);
  const who = [i.club.contactName, i.club.contactEmail].filter(Boolean).join(', ');
  const mailed = oneLineAddress(i.club.mailingAddress) || null;
  // A withdrawn invoice owes nothing, so its balance reads $0.00: one never paid (mig 528's guard), or one refunded in full,
  // which ended the deal (Part 3b, ask 3) — "Withdrawn" leads it then, with the payment and the refund both listed.
  const withdrawn = !!i.deal.withdrawnAt && (!standing.paidInFull || refunds.length > 0);
  return {
    clubName: i.club.name,
    fromLine: mailed,
    number: inv.number,
    issuedLabel: formatStoredDate(inv.issuedOn),
    dueLabel: formatStoredDate(inv.dueOn),
    revisedLabel: i.deal.revisedOn ? formatStoredDate(i.deal.revisedOn) : null,
    paidInFull: standing.paidInFull && !withdrawn,
    paidInFullLabel: standing.paidOn ? formatStoredDate(standing.paidOn) : null,
    partPaid: !standing.paidInFull && standing.paid > 0,
    withdrawnLabel: withdrawn ? formatStoredDate(i.deal.withdrawnAt) : null,
    invoiced: money(inv.total),
    paid: money(standing.paid),
    balance: money(withdrawn ? 0 : standing.owing),
    billTo: { name: i.billTo.name, attention: i.billTo.contactName, address: i.billTo.address, email: i.billTo.email },
    rows,
    taxNumberLine: taxed && i.club.gstHstNumber ? `GST/HST no. ${formatGstNumber(i.club.gstHstNumber)}` : null,
    payments: paymentsOnPaper(standing.listed, i.refunds ?? []).map(p => [formatStoredDate(p.receivedOn), paymentHow(p), money(p.amount)]),
    refunds: refunds.map(r => {
      const p = i.payments.find(x => x.id === r.paymentId);
      const to = p?.card ? `To ${cardLabel(p.card.brand, p.card.last4)}` : 'To the card';
      // The day the money left: Stripe's own day for a refund made there.
      return [formatStoredDate(refundMadeOn(r)), r.status === 'pending' ? `${to} (on its way)` : to, `−${money(r.amount)}`];
    }),
    // The coach builder prints "payable to {payee}"; a club that set its own cheque payee is that name.
    howToPay: { etransferEmail: i.howToPay.etransferTo, chequeAddress: mailed },
    chequesPayableTo: i.howToPay.chequesPayableTo ?? i.club.name,
    questionsTo: who || null,
  };
}

export type ClubInvoiceLayout = ReturnType<typeof clubInvoiceLayout>;

/**
 * A REFUND'S CREDIT NOTE (Part 3b; /accounting 2026-11-23, CRA Memo 12.2 ¶15–23): the club reduces the GST/HST it collected
 * only with a credit note, so every refund that succeeds on a taxed invoice has one — the invoice's own page, titled
 * "Credit note", carrying what the Memo prescribes: that it is a credit note, the club's name and GST/HST number, the
 * business's name, the day it was issued, and the tax given back with its rate; plus the invoice it reduces and what stands
 * paid after it. Never a separate document type of the house (no stamp); the invoice still lists the refund (ask 7).
 */
export function creditNoteLayout(i: ClubInvoiceInput, refund: DealRefund) {
  const inv = i.invoice;
  const base = clubInvoiceLayout(i);
  const number = refund.creditNumber ?? creditNoteNumber(inv.number, 1);
  const what = `${i.deal.packageName}${i.deal.placeName ? `, ${i.deal.placeName}` : ''}`;
  // What stands paid once this refund (and every refund given before it) is taken off.
  const upTo = (i.refunds ?? []).filter(r => refundCounts(r) && (r.id === refund.id || r.createdAt <= refund.createdAt));
  // Paid, then the refunds taken off: from what was LISTED, since a payment given back in full no longer counts as paid and its refund would come off twice.
  const netPaidC = paymentsOnPaper(invoiceStanding(inv.total, i.payments).listed, i.refunds ?? []).reduce((sum, p) => sum + cents(p.amount), 0) - upTo.reduce((sum, r) => sum + cents(r.amount), 0);
  const kind = inv.taxKind ?? 'GST/HST';
  const cancelled = refundNoteCancelled(refund);
  const row = (description: string) => (cancelled ? DEAL_WORDS.card.creditNoteCancelledRow(description) : description);
  // The day the note was ISSUED. A failed refund loses its booking day (the database clears it), so a cancelled note reads the day its
  // refund email went, which is the day it was booked and sent; never the day the refund was merely opened.
  // A refund made in Stripe and finished on a later day carries that day (`creditOn`, mig 542); the money left on `refundedOn`.
  const issuedDay: string = cancelled && refund.emailedAt ? orgDayKey(refund.emailedAt)
    : refund.creditOn ?? (cancelled && refund.finished ? orgDayKey(refund.finished.at) : refundDay(refund));
  // The day the money left: Stripe's own day for a refund made there (its booking day moves when that year is closed).
  const madeOn = refundMadeOn(refund);
  // A refund made in Stripe can return the processing fee too, after all of the sponsorship (Part A, ask 3): its own rows.
  const parts = refundParts(refund);
  return {
    ...base,
    number,
    paidInFull: false,
    withdrawnLabel: null,
    rows: [
      // A refund made in Stripe that returned only the fee has no sponsorship row.
      ...(parts.sponsorship > 0 ? [{ description: row(`Refund of the sponsorship: ${what}`), amount: money(parts.sponsorshipPre) }] : []),
      ...(parts.sponsorshipTax > 0 ? [{ description: row(`${kind} ${inv.taxRate}% refunded`), amount: money(parts.sponsorshipTax) }] : []),
      ...(refund.feePart > 0 ? [{ description: row(`Refund of the ${CARD_FEE_ROW.toLowerCase()}`), amount: money(parts.feePre) }] : []),
      ...(parts.feeTax > 0 ? [{ description: row(`${kind} ${inv.taxRate}% on the fee refunded`), amount: money(parts.feeTax) }] : []),
    ],
    payments: [] as string[][],
    refunds: [] as string[][],
    credit: {
      // A refund that was booked, sent to the business, and then did not reach the card: its note is kept, never reused,
      // and says it is cancelled (owner 2026-11-24).
      title: cancelled ? DEAL_WORDS.card.creditNoteCancelledTitle : 'Credit note',
      subtitle: [`No. ${number}`, `Issued ${formatStoredDate(issuedDay)}`,
        ...(cancelled ? [DEAL_WORDS.card.creditNoteCancelledSub(formatStoredDate(orgDayKey(refund.failedAt ?? refund.createdAt)))] : []),
        `For invoice ${inv.number}, issued ${formatStoredDate(inv.issuedOn)}`],
      stats: [
        { n: money(refund.amount), label: cancelled ? 'not refunded' : 'refunded' },
        { n: money(refund.taxPart), label: cancelled ? `${kind} not refunded` : `${kind} refunded` },
        { n: money(Math.max(0, netPaidC) / 100), label: 'paid, after refunds' },
      ],
      closing: cancelled ? DEAL_WORDS.card.creditNoteCancelledClosing(inv.number, money(refund.amount))
        : `This credit note reduces invoice ${inv.number} by ${money(refund.amount)}, including ${money(refund.taxPart)} ${kind} at ${inv.taxRate}%. ${
          refund.origin === 'stripe' && madeOn !== issuedDay
            ? `The amount went back on ${formatStoredDate(madeOn)} to the card it was paid with.`
            : 'The amount went back to the card it was paid with.'} ${
          // A refund made in Stripe CAN return some or all of the fee, so only one made from the deal says it never does.
          refund.feePart > 0 ? `${money(refund.feePart)} of it is the processing fee you paid, tax included.` : refund.origin === 'stripe' ? '' : 'This refund doesn’t include the processing fee.'}`.trim(),
    },
  };
}

/** "credit-note-2027-014-C1-harbour-dental.pdf". */
export const creditNoteFilename = (number: string, business: string): string => invoiceFilename(number, business).replace(/^invoice-/, 'credit-note-');

/**
 * Can the club email a deal's invoice? It needs its mailing address (the invoice's cheque address) and a contact for sponsors
 * (the email's reply-to) — the sender's own refusal (lib/sponsor-invoice-email.ts) and the business's page (owner call 4 at
 * walk §562: never promise an email that can't go) ask this one question.
 */
export const clubCanEmailInvoice = (mailingAddress: string | null | undefined, contactEmail: string | null | undefined): boolean =>
  !!mailingAddress?.trim() && !!contactEmail?.trim();

/** "invoice-2027-014-harbour-dental.pdf" — the download's name, ASCII only. */
export function invoiceFilename(number: string, business: string): string {
  const slug = business.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40);
  return `invoice-${number}${slug ? `-${slug}` : ''}.pdf`;
}
