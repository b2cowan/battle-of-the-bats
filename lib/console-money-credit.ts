// No `server-only` marker on purpose (like console-money-stripe.ts): this module holds no key and no client. Every function
// takes its Stripe client as an argument, so the guards run the real planner against a fake.
import type Stripe from 'stripe';
import { REFUND_WORDS } from './console-money';
import { FEE_INVOICE_META } from './online-payment-words';

/**
 * A platform-admin refund of a charge that paid an invoice goes through a Stripe CREDIT NOTE (GST/HST Stage 2 Part 6b; owner
 * R1–R3 2026-11-05; accounting review 6c: the Excise Tax Act s.232 document that shows the tax reversed). This file plans the
 * note; `makeRefund` (console-money-stripe.ts) makes it. What Stripe answered in test mode (Part 0, 2026-11-05,
 * `.probe/gst2/part6b-credit-notes-run1.txt`) decides every rule here:
 *   · a top-level `amount` on a paid taxed invoice is ACCEPTED and reverses NO tax (1a), so a note is always made of
 *     invoice lines, each by its before-tax `amount`. Never `quantity`: Stripe refuses it on a proration line (5a, 5c);
 *   · a negative line cannot be credited (5d); each line is capped at its own amount less earlier notes on it (2i); the
 *     whole is capped at the invoice's net before-tax total (a proration invoice's positive line is larger than what was paid, 5b);
 *   · the tax is Stripe's: a note's total is asked of `creditNotes.preview`, never worked out here. The total rises with the
 *     before-tax amount, so the planner walks to the NEAREST TOTAL NOT ABOVE the typed figure (R1: never refund more than staff
 *     typed). About 1 card figure in 9 has no before-tax cent that hits it exactly (1g), so the window shows Stripe's figure;
 *   · the last note on a line takes the line's remaining tax exactly (2h), so "all that is left" is always exact;
 *   · Stripe's PREVIEW does not refuse more than is left on the charge (3b); the charge-remainder check in `decideRefund` stays the guard.
 */

/** Each read's time limit (the Money tab's reads, the refund's re-reads and every preview). */
export const READ_OPTS = { timeout: 8000, maxNetworkRetries: 1 } as const;
/** A plan never asks Stripe more than this many previews (the estimate is within a cent or two: ≤ 3 in practice). */
const MAX_PREVIEWS = 6;

export const idOf = (v: string | { id?: string } | null | undefined): string | null => (v == null ? null : typeof v === 'string' ? v : v.id ?? null);

/** The refund a credit note made (its first and only one: a note's `refund_amount` is one refund). Creation and recovery read it the same way. */
export const refundIdOfNote = (n: Stripe.CreditNote): string | null => idOf(n.refunds?.[0]?.refund as string | { id?: string } | undefined);

/** The note's id and number as our record stores them; nothing for a bare refund. */
export const noteFacts = (n: { id: string; number: string | null } | null | undefined): { stripe_credit_note_id?: string; stripe_credit_note_number?: string | null } =>
  n ? { stripe_credit_note_id: n.id, stripe_credit_note_number: n.number } : {};

/** Whose invoice it must be: the club's own Stripe customer, in this site's mode. */
export type CreditOwner = { customerId: string; live: boolean };

/** One positive invoice line we may credit, and how much (before tax) earlier issued notes already took from it. */
export type CreditLine = { id: string; amount: number; creditedCents: number };

/** The invoice a charge paid, as the planner needs it. Read fresh in the same request as the refund (`readCreditTarget`). */
export type CreditTarget = {
  invoiceId: string;
  currency: string;
  /** The invoice's total, tax included. */
  total: number;
  /** Its net before-tax total (a proration invoice nets its negative "unused time" line here). */
  beforeTax: number;
  /** What issued notes already credited, tax included (pre- and post-payment). */
  creditedCents: number;
  /** What issued notes already credited, before tax (every line of theirs, incl. a custom line no invoice line carries). */
  creditedBeforeTaxCents: number;
  /** The positive lines, as on the invoice. */
  lines: CreditLine[];
  /** True for our own monthly Stripe-fee invoice (its `FEE_INVOICE_META`): the window says so beside the note. */
  isFeeInvoice: boolean;
};

export type CreditNoteLine = { type: 'invoice_line_item'; invoice_line_item: string; amount: number };

export type CreditPlan = {
  ok: true;
  lines: CreditNoteLine[];
  /** The note's total = what goes back to the card (`refund_amount` must equal it exactly, Part 0 §7). */
  cardCents: number;
  beforeTaxCents: number;
  /** The tax the note reverses, as Stripe lists it (named for the window by `namedTaxLines`). */
  taxes: NonNullable<Stripe.CreditNote['total_taxes']>;
  /** True when the invoice has less left to credit than the figure typed: the plan is everything that is left. */
  capped: boolean;
};
export type CreditRefusal = { ok: false; status: number; error: string };

/** The invoice ids a payment paid: 0 = no invoice (R3, a bare refund), 1 = a credit note, 2 = refused (we never make it). */
async function invoiceIdsForCharge(stripe: Stripe, paymentIntentId: string | null): Promise<string[]> {
  if (!paymentIntentId) return [];
  const res = await stripe.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: paymentIntentId }, limit: 2 }, READ_OPTS);
  return [...new Set(res.data.map(p => idOf(p.invoice as string | { id?: string } | null)).filter((v): v is string => !!v))];
}

async function allPages<T extends { id?: string }>(first: Stripe.ApiList<T>, next: (after: string) => Promise<Stripe.ApiList<T>>): Promise<T[]> {
  const items = [...first.data];
  let page = first;
  for (let i = 0; page.has_more && page.data.length > 0 && i < 10; i++) {
    page = await next(page.data[page.data.length - 1].id!);
    items.push(...page.data);
  }
  return items;
}

/** An invoice's ISSUED credit notes, all pages: the planner's read and the charge window's list are the same list. */
export async function listIssuedCreditNotes(stripe: Stripe, invoiceId: string): Promise<Stripe.CreditNote[]> {
  const first = await stripe.creditNotes.list({ invoice: invoiceId, limit: 100 }, READ_OPTS);
  const all = await allPages(first, after => stripe.creditNotes.list({ invoice: invoiceId, limit: 100, starting_after: after }, READ_OPTS));
  return all.filter(n => n.status === 'issued');
}

/**
 * The invoice as the planner needs it, or a refusal: an invoice Stripe does not show as paid, or one paid by more than one
 * payment (a credit note's refund would go to Stripe's choice of payment), is refunded in Stripe, never here.
 */
async function readCreditTarget(stripe: Stripe, invoiceId: string, owner: CreditOwner): Promise<CreditTarget | CreditRefusal> {
  const [inv, lines, issued] = await Promise.all([
    stripe.invoices.retrieve(invoiceId, { expand: ['payments'] }, READ_OPTS),
    stripe.invoices.listLineItems(invoiceId, { limit: 100 }, READ_OPTS)
      .then(first => allPages(first, after => stripe.invoices.listLineItems(invoiceId, { limit: 100, starting_after: after }, READ_OPTS))),
    listIssuedCreditNotes(stripe, invoiceId),
  ]);
  // The invoice is learned from the charge's payment, so it is the club's by Stripe's own links; this is the check that does not
  // rest on that inference (a credit note is emailed to the invoice's customer).
  if (idOf(inv.customer as string | { id?: string } | null) !== owner.customerId || inv.livemode !== owner.live) return { ok: false, status: 404, error: REFUND_WORDS.notOurs };
  if (inv.status !== 'paid') return { ok: false, status: 409, error: REFUND_WORDS.invoiceNotPaid };
  if ((inv.payments?.data ?? []).filter(p => p.status === 'paid').length > 1) return { ok: false, status: 409, error: REFUND_WORDS.manyPayments };
  const takenByLine = new Map<string, number>();
  let creditedBeforeTaxCents = 0;
  for (const n of issued) {
    const noteLines = n.lines.has_more
      ? await allPages(n.lines, after => stripe.creditNotes.listLineItems(n.id, { limit: 100, starting_after: after }, READ_OPTS))
      : n.lines.data;
    for (const l of noteLines) {
      creditedBeforeTaxCents += l.amount;
      if (l.invoice_line_item) takenByLine.set(l.invoice_line_item, (takenByLine.get(l.invoice_line_item) ?? 0) + l.amount);
    }
  }
  return {
    invoiceId,
    currency: inv.currency,
    total: inv.total,
    beforeTax: inv.total_excluding_tax ?? inv.subtotal,
    creditedCents: (inv.pre_payment_credit_notes_amount ?? 0) + (inv.post_payment_credit_notes_amount ?? 0),
    creditedBeforeTaxCents,
    lines: lines.filter(l => l.amount > 0).map(l => ({ id: l.id, amount: l.amount, creditedCents: takenByLine.get(l.id) ?? 0 })),
    isFeeInvoice: !!inv.metadata?.[FEE_INVOICE_META],
  };
}

/**
 * What a charge's refund goes through, read by the refund route and its preview alike: `target` null = it paid no invoice
 * (R3, a bare refund); a target = a credit note; a refusal = more than one invoice, or an invoice refunded in Stripe.
 */
export async function creditTargetForCharge(stripe: Stripe, paymentIntentId: string | null, owner: CreditOwner): Promise<{ ok: true; target: CreditTarget | null } | CreditRefusal> {
  const ids = await invoiceIdsForCharge(stripe, paymentIntentId);
  if (ids.length > 1) return { ok: false, status: 409, error: REFUND_WORDS.manyInvoices };
  if (ids.length === 0) return { ok: true, target: null };
  const target = await readCreditTarget(stripe, ids[0], owner);
  return 'error' in target ? target : { ok: true, target };
}

/** The lines with room, largest room first, and the most that can still be credited before tax. */
export function creditRoom(target: CreditTarget): { order: Array<{ id: string; room: number }>; pool: number } {
  const order = target.lines
    .map(l => ({ id: l.id, room: l.amount - l.creditedCents }))
    .filter(l => l.room > 0)
    .sort((a, b) => b.room - a.room);
  const pool = Math.min(order.reduce((s, l) => s + l.room, 0), target.beforeTax - target.creditedBeforeTaxCents);
  return { order, pool: Math.max(0, pool) };
}

/** A before-tax amount as note lines: on the largest line first, spilling to the next only past that line's room. */
export function creditLines(order: ReadonlyArray<{ id: string; room: number }>, beforeTaxCents: number): CreditNoteLine[] {
  const out: CreditNoteLine[] = [];
  let left = beforeTaxCents;
  for (const l of order) {
    if (left <= 0) break;
    const amount = Math.min(left, l.room);
    out.push({ type: 'invoice_line_item', invoice_line_item: l.id, amount });
    left -= amount;
  }
  return out;
}

/**
 * The credit note for a card figure (tax included): the largest before-tax amount whose previewed total is not above it.
 * Starts from the invoice's own ratio (all that is left → every line's room, exact), then steps a cent at a time.
 * Throws when Stripe cannot be asked; refuses when nothing is left to credit or no total fits.
 */
export async function planCreditNote(stripe: Stripe, target: CreditTarget, cardCents: number): Promise<CreditPlan | CreditRefusal> {
  const { order, pool } = creditRoom(target);
  if (pool <= 0 || cardCents <= 0) return { ok: false, status: 409, error: REFUND_WORDS.nothingToCredit };
  const leftOnInvoice = target.total - target.creditedCents;
  let previews = 0;
  const preview = (b: number) => {
    previews++;
    return stripe.creditNotes.preview({ invoice: target.invoiceId, lines: creditLines(order, b) }, READ_OPTS);
  };

  let b = leftOnInvoice <= 0 || cardCents >= leftOnInvoice ? pool
    : Math.min(pool, Math.max(1, Math.round(cardCents * pool / leftOnInvoice)));
  let note = await preview(b);
  let best: { b: number; note: Stripe.CreditNote } | null = null;
  if (note.total <= cardCents) {
    best = { b, note };
    // Below the figure: one more cent before tax may still fit (each cent adds at least one to the total).
    while (best.note.total < cardCents && best.b < pool && previews < MAX_PREVIEWS) {
      const next = await preview(best.b + 1);
      if (next.total > cardCents) break;
      best = { b: best.b + 1, note: next };
    }
  } else {
    while (b > 1 && previews < MAX_PREVIEWS) {
      b--;
      note = await preview(b);
      if (note.total <= cardCents) { best = { b, note }; break; }
    }
  }
  if (!best) return { ok: false, status: 409, error: REFUND_WORDS.noteNotWorkedOut };
  // A paid invoice's note is all after payment; `refund_amount` must equal this figure exactly or Stripe refuses it.
  if (best.note.post_payment_amount !== best.note.total) return { ok: false, status: 409, error: REFUND_WORDS.noteNotWorkedOut };
  return {
    ok: true,
    lines: creditLines(order, best.b),
    cardCents: best.note.total,
    beforeTaxCents: best.note.total_excluding_tax ?? best.note.subtotal,
    taxes: best.note.total_taxes ?? [],
    capped: best.b === pool && best.note.total < cardCents,
  };
}
