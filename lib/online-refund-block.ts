/**
 * THE REFUND BLOCK (Club Tier Stage 12c Part 3; words docs/projects/active/CLUB_TIER_STAGE12C_REFUND_VISIBLE_COPY.md §4):
 * one block, the same in every email that carries a refund, in both flows — the house-league refund email, the ending
 * email's refund, a price correction's, the "still enrolled" pay link, and a tournament team's refund. Label then value:
 * Refunded · For (one row per child, only when the payment covered two or more) · To · On · Refund reference · Your
 * receipt; then the fee line and how long it takes to appear.
 *
 * **On is the refund's own date, never the day we heard of it** (Stripe's `created` when we have it), so an email sent
 * late, or for a refund made in Stripe whose event arrived late, still reads right (the F3 class of bug).
 *
 * Pure: no I/O. The HTML is the warm envelope's panel (its styles are fixed values, never the product's theme).
 */
import { REFUND_BLOCK_WORDS as B, ONLINE_EMAIL_WORDS as E, cardLabel, money, receiptLabel } from './online-payment-words';
import { formatStoredDate, orgDayKey } from './timezone';
import { WARM_EMAIL, WARM_EMAIL_STYLE, warmPanelStyle } from './email-envelope-warm';

export interface RefundBlockInput {
  /** What went back (the processing fee included when it went back). */
  refundCents: number;
  /** Each child and their part, named only when the payment covered two or more children. */
  children?: ReadonlyArray<{ name: string; cents: number }>;
  bank: boolean;
  cardBrand: string | null;
  cardLast4: string | null;
  bankLast4: string | null;
  /** The refund's own moment (Stripe's), as an ISO instant or a club day. */
  refundedAt: string;
  reference: string | null;
  receiptNo: number | null;
  /** The day the payment was made (the receipt's). */
  paidOn: string | null;
  /** The processing fee that went back with it (0 when it didn't). */
  feeBackCents: number;
  /** The processing fee the payer paid on what is refunded, to name when it did NOT go back (0 when the club paid it). */
  feeKeptCents: number;
}

const day = (v: string | null) => (v ? formatStoredDate(v.length > 10 ? orgDayKey(v) : v) : '');

/** The block's rows, label then value, in the words' order. */
export function refundBlockRows(i: RefundBlockInput): Array<[string, string]> {
  const rows: Array<[string, string]> = [[B.amount, money(i.refundCents / 100)]];
  if (i.children && i.children.length >= 2) for (const c of i.children) rows.push([B.forLabel, B.forValue(c.name, money(c.cents / 100))]);
  rows.push([B.to, i.bank ? B.bankTarget(i.bankLast4) : cardLabel(i.cardBrand, i.cardLast4)]);
  rows.push([B.on, day(i.refundedAt)]);
  if (i.reference) rows.push([B.ref, i.reference]);
  if (i.receiptNo != null) rows.push([B.receipt, B.receiptValue(receiptLabel(i.receiptNo), day(i.paidOn))]);
  return rows;
}

/** The lines under the block: the processing fee (when it went back, or when the payer paid one that didn't), then how long. */
export function refundBlockFoot(i: RefundBlockInput): string[] {
  const out: string[] = [];
  if (i.feeBackCents > 0) out.push(E.refundFeeIncluded(money(i.feeBackCents / 100)));
  else if (i.feeKeptCents > 0) out.push(E.refundFeeKept(money(i.feeKeptCents / 100)));
  out.push(B.arrives(i.bank));
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The block as the warm envelope's panel (label column, value column), then its foot lines as paragraphs. */
export function refundBlockHtml(i: RefundBlockInput): string {
  const W = WARM_EMAIL;
  const cell = `padding:3px 0;font-family:${W.font};font-size:15px;line-height:1.5;vertical-align:top;`;
  const rows = refundBlockRows(i).map(([label, value]) =>
    `<tr><td style="${cell}color:${W.secondary};padding-right:16px;white-space:nowrap;">${esc(label)}</td>`
    + `<td style="${cell}color:${W.ink};font-weight:700;">${esc(value)}</td></tr>`).join('');
  const table = `<div style="${warmPanelStyle('olive', { padding: '14px 18px', margin: '14px 0' })}">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table></div>`;
  return [table, ...refundBlockFoot(i).map(l => `<p style="${WARM_EMAIL_STYLE.paragraph}">${esc(l)}</p>`)].join('\n');
}
