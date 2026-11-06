/**
 * Fee invoice alerts, Part 2 — the signal that tells the owner a FieldLogicHQ fee invoice (or a failed plan payment) waits.
 *
 * ONE small, client-safe module so the rail's pill, the phone's More pill and (Part 4) the banner read the same answer:
 *   • `FeesOwed` — what `/api/admin/club-brief` carries as `feesOwed` (owner only; ABSENT for anyone without billing access).
 *   • `feeAlertFor` — turns that, and a failed plan payment, into the pill: how many, which tone, what a screen reader says.
 *   • `FEE_ALERT_WORDS` — the spoken labels (owner accepted 2026-11-05). Components never type them
 *     (`plan-billing-source-guard`); `PLAN_BILLING_WORDS.feeAlert` is this same object.
 *
 * ⚖ Amber while an invoice is open; RED once one is overdue (Ask 3). A failed plan payment (`past_due`) is an AMBER pill on
 * the same door (Ask 7) read from the org itself — no fetch. The page line and button are Part 3, the banner Part 4.
 */
import { pluralize } from './utils';
import { hasBillingAccess } from './roles';
import type { OrgRole } from './types';

/** ⚖ Owner only (Ask 6): the figure rides the brief only for someone who holds the billing door — `hasBillingAccess`, the rule
 *  `kitBillingLink` and the Plan & billing route use. A treasurer or admin without it gets the key ABSENT, not a zero. */
export function canSeeFeesOwed(role: OrgRole | null | undefined, capabilities: Record<string, boolean> | null): boolean {
  return hasBillingAccess(role, capabilities);
}

/** The one overdue invoice, as the Part 4 banner names it (owner Q6, 2026-11-05). `day` is the stored due date. */
/** The one place a pay link is vetted: only a secure web address leaves the server or becomes a button (it goes straight into an href). */
export const httpsOnly = (url: string | null | undefined): string | null => (url && /^https:\/\//i.test(url) ? url : null);

export type OverdueInvoice = { invoiceNo: string; day: string | null; total: number | null; payUrl: string | null };
/** `earliestOverdue` (the stored due date of the oldest overdue one) is present whenever something is overdue; `overdueInvoice`
 *  only when EXACTLY ONE is overdue and it has its number. Both are absent otherwise, so the plain `{ count, overdue }` stays plain. */
export type FeesOwed = { count: number; overdue: number; earliestOverdue?: string; overdueInvoice?: OverdueInvoice };
export type FeeAlertTone = 'amber' | 'red';
export type FeeAlert = { count: number; tone: FeeAlertTone; label: string };

export const FEE_ALERT_WORDS = {
  toPay: (n: number) => `${pluralize(n, 'invoice')} to pay`,
  overdue: (n: number) => `${pluralize(n, 'invoice')} overdue`,
  planPaymentFailed: 'Plan payment didn’t go through',
} as const;

/** The status of a fee invoice the club still owes. Only `open` (owner, 2026-11-05): a voided, paid or `uncollectible` row drops out. */
export const FEE_INVOICE_OWED_STATUS = 'open';

export type FeeInvoiceOwedRow = {
  due_at: string | null; invoice_number?: string | null; total?: number | null; amount_due?: number | null; hosted_invoice_url?: string | null;
};

/** Shape the route's rows into the brief's field. `overdue` = open with a due date already past (`dueAt` null never counts). */
export function feesOwedFrom(rows: readonly FeeInvoiceOwedRow[], now: Date = new Date()): FeesOwed {
  const overdueRows = rows
    .filter((r): r is FeeInvoiceOwedRow & { due_at: string } => r.due_at != null && Date.parse(r.due_at) < now.getTime())
    .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
  const out: FeesOwed = { count: rows.length, overdue: overdueRows.length };
  if (overdueRows.length === 0) return out;
  out.earliestOverdue = overdueRows[0].due_at;
  const only = overdueRows.length === 1 ? overdueRows[0] : null;
  if (only?.invoice_number) {
    const total = only.total ?? only.amount_due ?? null;
    out.overdueInvoice = {
      invoiceNo: only.invoice_number, day: only.due_at, total: total == null ? null : Number(total),
      payUrl: httpsOnly(only.hosted_invoice_url),
    };
  }
  return out;
}

/**
 * The pill, or null when nothing waits. Red when any invoice is overdue — and then the number is the OVERDUE ones, so
 * the figure, the tone and the spoken label say one thing; otherwise amber with the invoices to pay. A failed plan payment
 * adds one to the number and its own phrase. `planPastDue` and `feesOwed` are both owner-only facts: the caller passes
 * them only when the person has the billing door (`billingLink != null`).
 */
export function feeAlertFor(feesOwed: FeesOwed | null | undefined, planPastDue: boolean): FeeAlert | null {
  const owed = feesOwed && feesOwed.count > 0 ? feesOwed : null;
  const parts: string[] = [];
  let count = 0;
  if (owed) {
    const n = owed.overdue > 0 ? owed.overdue : owed.count;
    count += n;
    parts.push(owed.overdue > 0 ? FEE_ALERT_WORDS.overdue(n) : FEE_ALERT_WORDS.toPay(n));
  }
  if (planPastDue) {
    count += 1;
    parts.push(FEE_ALERT_WORDS.planPaymentFailed);
  }
  if (count === 0) return null;
  return { count, tone: owed && owed.overdue > 0 ? 'red' : 'amber', label: parts.join(', ') };
}
