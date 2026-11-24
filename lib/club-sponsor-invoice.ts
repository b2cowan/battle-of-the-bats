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
}

/** A refund to the card (Part 3b, mig 530): all of what was left or part of it, never the processing fee. */
export interface DealRefund {
  id: string;
  paymentId: string;
  amount: number;
  /** The GST/HST share of it (the sponsorship's tax only). */
  taxPart: number;
  whole: boolean;
  /** It gave back the last of the deal's money, so the deal ended as Withdrawn (ask 3). */
  endsDeal: boolean;
  reason: string;
  status: 'pending' | 'succeeded' | 'failed';
  failureReason: string | null;
  refundedOn: string | null;
  succeededAt: string | null;
  failedAt: string | null;
  createdAt: string;
  createdByName: string;
  stripeRefundId: string | null;
  emailedAt: string | null;
  /** Its two ledger lines were written: a refund that failed with this false never moved anything, one that failed with it true had its lines voided. */
  booked: boolean;
  /** "2027-014-C1": the credit note a refund on a taxed invoice carries (/accounting 2026-11-23). */
  creditNumber: string | null;
}

/** A refund that moved money or is on its way (a failed one gave nothing back). */
export const refundCounts = (r: Pick<DealRefund, 'status'>): boolean => r.status !== 'failed';

/** The day a refund went back: the day Stripe booked it, else the day it was opened (club time). */
export const refundDay = (r: Pick<DealRefund, 'refundedOn' | 'createdAt'>): string => r.refundedOn ?? orgDayKey(r.createdAt);

/** A refund that ended the deal (a whole refund of the last payment that held it — Withdrawn · refunded). */
export const refundsEndedDeal = (refunds: readonly Pick<DealRefund, 'status' | 'endsDeal'>[]): boolean =>
  refunds.some(r => r.endsDeal && refundCounts(r));

/** A withdrawn deal that money reached and that was refunded (Part 3b, ask 3) keeps its paper: its link still downloads the
 *  invoice and the credit note, and shows them. Nothing else opens on it. */
export const refundedAway = (d: { state: string; payments?: readonly { voided: unknown }[] }): boolean =>
  d.state === 'withdrawn' && !!d.payments?.some(p => !p.voided);

/** "2027-014-C1": an invoice's credit notes are numbered in the order they were given. */
export const creditNoteNumber = (invoiceNumber: string, seq: number): string => `${invoiceNumber}-C${seq}`;

/**
 * What a card payment can still give back (the drawing's tab 2; mig 530's `club_sponsor_card_refund_left`, the same sums):
 * its amount less the fee the sponsor paid and that fee's tax, less every refund that hasn't failed. `taxLeft` is the
 * sponsorship's tax still on it.
 */
export function refundLeft(p: Pick<DealPayment, 'id' | 'amount' | 'taxPart' | 'card'>, refunds: readonly DealRefund[]): {
  refundable: number; left: number; taxLeft: number;
} {
  const feeC = cents(p.card?.feeCharged ?? 0) + cents(p.card?.feeTax ?? 0);
  const mine = refunds.filter(r => r.paymentId === p.id && refundCounts(r));
  const refundableC = cents(p.amount) - feeC;
  const leftC = refundableC - mine.reduce((s, r) => s + cents(r.amount), 0);
  const taxLeftC = cents(p.taxPart) - cents(p.card?.feeTax ?? 0) - mine.reduce((s, r) => s + cents(r.taxPart), 0);
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
  return payments.every(o => o.id === paymentId || !!o.voided || (!!o.card && refundLeft(o, refunds).left <= 0));
}

/** What has gone back to the card on a deal (refunds on their way included; a failed one gave nothing back). */
export const refundedTotal = (refunds: readonly DealRefund[]): number =>
  refunds.filter(refundCounts).reduce((s, r) => s + cents(r.amount), 0) / 100;

/** "How it was paid" on a deal: the product's one method list (DUES_PAYMENT_METHODS), "E-transfer" as ruled (round 2 ask 6). */
export const DEAL_METHOD_LABEL: Record<DuesPaymentMethod, string> = { ...DUES_PAYMENT_METHOD_LABEL, etransfer: 'E-transfer' };

/** "Cheque 004417" — how it arrived, with its number when there is one. */
export const paymentHow = (p: Pick<DealPayment, 'method' | 'reference'> & { card?: DealPayment['card'] }): string =>
  // A card payment names its card (the drawing's tab 1: "Card, Visa •••• 4242").
  p.card ? `Card, ${cardLabel(p.card.brand, p.card.last4)}`
    : [DEAL_METHOD_LABEL[p.method] ?? p.method, p.reference?.trim() || null].filter(Boolean).join(' ');

/** The invoice's row for a processing fee the sponsor paid by card (round 2 tab 2). */
export const CARD_FEE_ROW = 'Processing fee';

const cents = (n: number) => Math.round(n * 100);

/** What has arrived against an invoice: paid, still owing, and the day it was paid in full (the last arrival's). */
export function invoiceStanding(total: number, payments: readonly DealPayment[]): {
  paid: number; owing: number; paidInFull: boolean; paidOn: string | null; live: DealPayment[];
} {
  const live = payments.filter(p => !p.voided).sort((a, b) => a.receivedOn.localeCompare(b.receivedOn));
  const paidC = live.reduce((s, p) => s + cents(p.amount), 0);
  const owingC = Math.max(0, cents(total) - paidC);
  const paidInFull = live.length > 0 && owingC === 0;
  return { paid: paidC / 100, owing: owingC / 100, paidInFull, paidOn: paidInFull ? live[live.length - 1].receivedOn : null, live };
}

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
    payments: standing.live.map(p => [formatStoredDate(p.receivedOn), paymentHow(p), money(p.amount)]),
    refunds: refunds.map(r => {
      const p = i.payments.find(x => x.id === r.paymentId);
      const to = p?.card ? `To ${cardLabel(p.card.brand, p.card.last4)}` : 'To the card';
      return [formatStoredDate(refundDay(r)), r.status === 'pending' ? `${to} (on its way)` : to, `−${money(r.amount)}`];
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
  const netPaidC = cents(invoiceStanding(inv.total, i.payments).paid) - upTo.reduce((sum, r) => sum + cents(r.amount), 0);
  const kind = inv.taxKind ?? 'GST/HST';
  return {
    ...base,
    number,
    paidInFull: false,
    withdrawnLabel: null,
    rows: [
      { description: `Refund of the sponsorship: ${what}`, amount: money((cents(refund.amount) - cents(refund.taxPart)) / 100) },
      ...(refund.taxPart > 0 ? [{ description: `${kind} ${inv.taxRate}% refunded`, amount: money(refund.taxPart) }] : []),
    ],
    payments: [] as string[][],
    refunds: [] as string[][],
    credit: {
      title: 'Credit note',
      subtitle: [`No. ${number}`, `Issued ${formatStoredDate(refundDay(refund))}`,
        `For invoice ${inv.number}, issued ${formatStoredDate(inv.issuedOn)}`],
      stats: [
        { n: money(refund.amount), label: 'refunded' },
        { n: money(refund.taxPart), label: `${kind} refunded` },
        { n: money(Math.max(0, netPaidC) / 100), label: 'paid, after refunds' },
      ],
      closing: `This credit note reduces invoice ${inv.number} by ${money(refund.amount)}, including ${money(refund.taxPart)} ${kind} at ${inv.taxRate}%. The amount went back to the card it was paid with. A refund never includes the processing fee.`,
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
