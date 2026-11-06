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

type FeeLine = {
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
const safeHref = (url: string | null) => (url && /^https:\/\//i.test(url) ? url : null);
const SEE = { kind: 'see', label: W.alertSeeInvoices, aria: W.alertSeeInvoicesAria } as const;

/** The line for what the club owes, or null when nothing is owed (the line is then absent, never empty). */
export function feeLineFor(read: FeesRead | null | undefined): FeeLine | null {
  const owed = owedInvoicesOf(read);
  if (owed.length === 0) return null;
  const overdue = owed.filter(i => i.state === 'own_overdue');
  const earliest = (list: FeeInvoice[]) => short(list.find(i => i.day)?.day ?? null);

  if (overdue.length === 1 || owed.length === 1) {
    const inv = owed[0]; // owed is overdue-first, so this is the one overdue invoice when there is one
    const isOverdue = inv.state === 'own_overdue';
    const day = short(inv.day);
    const amount = inv.total != null ? money(inv.total) : null;
    const href = safeHref(inv.payUrl);
    return {
      tone: isOverdue ? 'red' : 'amber',
      lead: isOverdue ? W.alertOverdue(inv.invoiceNo) : day ? W.alertOpen(inv.invoiceNo, day) : W.alertOpenNoDay(inv.invoiceNo),
      detail: isOverdue ? (amount && day ? W.alertOverdueDetail(amount, day) : null) : amount ? W.alertAmountDue(amount) : null,
      action: href ? { kind: 'pay', href, label: W.payInvoice, aria: W.payInvoiceAria(inv.invoiceNo) } : SEE,
    };
  }
  if (overdue.length >= 2) return { tone: 'red', lead: W.alertOverdueMany(overdue.length, earliest(overdue)), detail: null, action: SEE };
  return { tone: 'amber', lead: W.alertOpenMany(owed.length, earliest(owed)), detail: null, action: SEE };
}
