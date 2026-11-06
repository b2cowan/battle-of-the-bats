/**
 * Fee invoice alerts, Part 3 — what the fees list and the one line at the top of Plan & billing both read.
 *
 * ONE read (`/api/billing/stripe-fees`) feeds both, so the line and the list can never disagree on how many invoices are owed:
 * `owedInvoicesOf` is the list's own "owed first" rule, lifted here, and `feeLineFor` turns the same answer into the line.
 * Nothing is computed in the browser from fee amounts: the figure on the line is the invoice's own total from the server.
 *
 * ⚖ Rulings (drawings 2026-11-05, asks 4–6): amber while open and not due, red once overdue; the owner alone sees it (the page
 * and its route are behind the billing door); fee invoices never switch an account off, so the words never say what waiting costs.
 * One overdue invoice is named even when others are open (its own Pay invoice button; the open ones stay in the list).
 */
import { STRIPE_FEE_WORDS as W, money } from './online-payment-words';
import { formatStoredDate } from './timezone';
import { httpsOnly, type FeesOwed, type OverdueInvoice } from './fee-invoice-alert';
// Type-only: erased at build, so nothing server-side reaches the browser. The route sends these shapes (minus legacy_exempt rows).
import type { ClubFeeInvoiceView, ClubFeeView } from './platform-stripe-fees';

export type FeeRow = Pick<ClubFeeView, 'id' | 'line' | 'createdAt' | 'amount' | 'credit' | 'invoiceNo' | 'invoiceDay' | 'payUrl'>
  & { state: Exclude<ClubFeeView['state'], 'legacy_exempt'> };
export type FeeInvoice = ClubFeeInvoiceView;
export type FeesRead = { fees: FeeRow[]; invoices?: FeeInvoice[]; planFree: boolean };

const ON_AN_INVOICE: ReadonlySet<FeeRow['state']> = new Set(['own_open', 'own_overdue', 'own_paid']);

/** A fee is "on" an invoice only when the server also described that invoice (else it falls back to its plain line). */
export function feeIsOnInvoice(fee: FeeRow, invoices: readonly FeeInvoice[]): boolean {
  return !!fee.invoiceNo && ON_AN_INVOICE.has(fee.state) && invoices.some(i => i.invoiceNo === fee.invoiceNo);
}

/** The invoices still owed with at least one fee under them: overdue before open, soonest due first. Paid ones are not owed. */
export function owedInvoicesOf(read: FeesRead | null | undefined): FeeInvoice[] {
  if (!read) return [];
  const invoices = read.invoices ?? [];
  const withFees = new Set(read.fees.filter(f => feeIsOnInvoice(f, invoices)).map(f => f.invoiceNo));
  return invoices
    .filter(i => i.state !== 'own_paid' && withFees.has(i.invoiceNo))
    .sort((a, b) => (a.state === b.state ? (a.day ?? '').localeCompare(b.day ?? '') : a.state === 'own_overdue' ? -1 : 1));
}

export type FeeLine = {
  tone: 'amber' | 'red';
  /** The bold first sentence. */
  lead: string;
  /** The second sentence (amount, or the earliest day); null when there is nothing true to add. */
  detail: string | null;
  /** One invoice with a Stripe page: Pay invoice (opens a new tab). Otherwise the line points at the list. */
  action: { kind: 'pay'; href: string; label: string; aria: string } | { kind: 'see'; label: string; aria: string };
};

/** "Dec 1" for a stored day; null when there is none. The list wears this too. */
export const shortDay = (v: string | null) => (v ? formatStoredDate(v, { withYear: false }) : null);
const short = shortDay;
// Only an https address leaves the page (the list already refuses anything else server-side; this is the line's own belt).
const SEE = { kind: 'see', label: W.alertSeeInvoices, aria: W.alertSeeInvoicesAria } as const;

/** ONE invoice named: its number, day and total, and Pay invoice when Stripe gave a secure page. Shared by the page line and the banner. */
function oneInvoiceLine(inv: OverdueInvoice, isOverdue: boolean): FeeLine {
  const day = short(inv.day);
  const amount = inv.total != null ? money(inv.total) : null;
  const href = httpsOnly(inv.payUrl);
  return {
    tone: isOverdue ? 'red' : 'amber',
    lead: isOverdue ? W.alertOverdue(inv.invoiceNo) : day ? W.alertOpen(inv.invoiceNo, day) : W.alertOpenNoDay(inv.invoiceNo),
    detail: isOverdue ? (amount && day ? W.alertOverdueDetail(amount, day) : null) : amount ? W.alertAmountDue(amount) : null,
    action: href ? { kind: 'pay', href, label: W.payInvoice, aria: W.payInvoiceAria(inv.invoiceNo) } : SEE,
  };
}

/**
 * The line for what the club owes, or null when nothing is owed (the line is then absent, never empty).
 * `overdue: false` is Plan & billing's own line while the pinned banner is up (Part 4, ask 5: "the banner replaces the separate line"):
 * it describes only what is open and not yet due, and the banner speaks for anything overdue. A CANCELLED club has no banner (the
 * brief is never read for it), so its page keeps the default and draws both tones.
 */
export function feeLineFor(read: FeesRead | null | undefined, opts: { overdue?: boolean } = {}): FeeLine | null {
  const owed = owedInvoicesOf(read).filter(i => opts.overdue !== false || i.state !== 'own_overdue');
  if (owed.length === 0) return null;
  const overdue = owed.filter(i => i.state === 'own_overdue');
  const earliest = (list: FeeInvoice[]) => short(list.find(i => i.day)?.day ?? null);

  // owed is overdue-first, so owed[0] is the one overdue invoice when there is one.
  if (overdue.length === 1 || owed.length === 1) return oneInvoiceLine(owed[0], owed[0].state === 'own_overdue');
  if (overdue.length >= 2) return { tone: 'red', lead: W.alertOverdueMany(overdue.length, earliest(overdue)), detail: null, action: SEE };
  return { tone: 'amber', lead: W.alertOpenMany(owed.length, earliest(owed)), detail: null, action: SEE };
}

/**
 * The pinned banner's line (Part 4): red, overdue only, from the club brief's `feesOwed` (owner only). One overdue invoice names itself
 * with its Pay invoice, the very sentences the page line wears; two or more (or one the brief could not name) say how many and the
 * earliest day and point at Plan & billing. Null when nothing is overdue: an invoice that is only open never raises the banner (ask 4).
 */
export function overdueBannerFor(owed: FeesOwed | null | undefined): FeeLine | null {
  if (!owed || owed.overdue <= 0) return null;
  if (owed.overdueInvoice) return oneInvoiceLine(owed.overdueInvoice, true);
  return { tone: 'red', lead: W.alertOverdueMany(owed.overdue, short(owed.earliestOverdue ?? null)), detail: null, action: SEE };
}
