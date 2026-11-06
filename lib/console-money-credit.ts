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
 *     whole is capped at the NET OF THE INVOICE'S LINES (a proration invoice's positive line is larger than what was paid, 5b);
 *   · a note line's `amount` is in the invoice LINE's units: BEFORE any discount as well as before tax. Stripe takes the line's
 *     discount off inside the note (Part 4 matrix 2026-11-06, `part6b-part4-refunds-run1.txt` J: 25% off, a 219000 line by its
 *     own amount → the whole 185603 paid). So every cap here is in line units, never the after-discount `total_excluding_tax`
 *     (that cap credited a discounted invoice 75% of the way and refused it every time);
 *   · the tax is Stripe's: a note's total is asked of `creditNotes.preview`, never worked out here. The total never falls as the
 *     before-tax amount rises, so the planner steps by the gap to the NEAREST TOTAL NOT ABOVE the typed figure (R1: never refund more than staff
 *     typed). About 1 card figure in 9 has no before-tax cent that hits it exactly (1g), so the window shows Stripe's figure;
 *   · the last note on a line takes the line's remaining tax exactly (2h), so "all that is left" is always exact;
 *   · Stripe's PREVIEW does not refuse more than is left on the charge (3b); the charge-remainder check in `decideRefund` stays the guard.
 */

/** Each read's time limit (the Money tab's reads, the refund's re-reads and every preview). */
export const READ_OPTS = { timeout: 8000, maxNetworkRetries: 1 } as const;
/**
 * A plan never asks Stripe more than this many previews. Step by the gap closes the bracket in 2–3 on an undiscounted invoice;
 * a 90%-off line or a coupon on one line of two takes up to 7 (Part 7 sweeps, `.probe/gst2/part7-q1-*`: 0 wrong of 11,298
 * figures, 3 refused at 8). Past it the plan refuses: a figure not proven the nearest is never stated.
 */
export const MAX_PREVIEWS = 8;

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
  /**
   * The net of ALL its lines' amounts, in line units: before discounts and tax (a proration invoice nets its negative "unused
   * time" line here). Never the after-discount `total_excluding_tax`: a note line's amount is before the discount (Part 4, J).
   */
  linesNetCents: number;
  /** What issued notes already credited, tax included (pre- and post-payment). */
  creditedCents: number;
  /** What issued notes already credited, in line units (every line of theirs, incl. a custom line no invoice line carries). */
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
    linesNetCents: lines.reduce((s, l) => s + l.amount, 0),
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
  const pool = Math.min(order.reduce((s, l) => s + l.room, 0), target.linesNetCents - target.creditedBeforeTaxCents);
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

/** A line amount Stripe previewed, and the note total it answered. */
type CreditSeen = { b: number; total: number };

/**
 * The next line amount to ask Stripe about ("step by the gap", owner Q1 2026-11-06), strictly inside the bracket so every
 * preview narrows it. Every guess aims at the figure's last half-cent (the edge between "fits" and "one cent over"):
 *   · the first step: the last preview's distance to the figure, scaled by that preview's OWN ratio (line units per card cent:
 *     on a discounted line a unit is worth less than a cent, and on a line-level coupon the invoice's average ratio is wrong for
 *     the line being credited — Part 4's J3 ran out of previews stepping one unit at a time);
 *   · after it: the straight line through the last two previews (the ratio AT THE MARGIN, which differs from a preview's own
 *     ratio once the note spills from a full-price line onto a discounted one);
 *   · the middle, once both sides are known and their totals are at most two cents apart: the edge then sits somewhere in a run
 *     of amounts that make the same total (a unit worth less than a cent), where no ratio can say where; halving finds it;
 *   · a guess that would cross a SPILL POINT (where the note moves onto the next line, `spills`: a full-price line and a
 *     discounted one have different ratios) asks about the spill point first, so no ratio is carried across lines.
 */
function nextCreditAmount(last: CreditSeen, prev: CreditSeen | null, lo: CreditSeen | null, hi: CreditSeen | null, cardCents: number, pool: number, spills: readonly number[]): number {
  const floor = lo?.b ?? 0;
  const ceil = hi?.b ?? pool + 1;
  const aim = cardCents + 0.5;
  const sameLine = (a: number, z: number) => !spills.some(k => Math.min(a, z) < k && k < Math.max(a, z));
  let guess = lo && hi && hi.total - lo.total <= 2 ? Math.floor((floor + ceil) / 2)
    : prev && prev.total !== last.total && sameLine(prev.b, last.b) ? last.b + Math.round((aim - last.total) * (last.b - prev.b) / (last.total - prev.total))
    : last.total > 0 ? last.b + Math.round((aim - last.total) * (last.b / last.total))
    : last.b * 2;
  const crossed = spills.filter(k => k > floor && k < ceil && Math.min(last.b, guess) < k && k < Math.max(last.b, guess));
  if (crossed.length) guess = guess > last.b ? crossed[0] : crossed[crossed.length - 1];
  return Math.min(ceil - 1, Math.max(floor + 1, guess));
}

/**
 * The credit note for a card figure (tax included): the LARGEST before-tax amount whose previewed total is not above it.
 * Starts from the invoice's own ratio (all that is left → every line's room, exact, one preview), then steps by the gap
 * (`nextCreditAmount`) inside a bracket: `lo` the largest amount seen that fits, `hi` the smallest seen above (none = past the
 * pool). It answers only once the two are one unit apart, i.e. once Stripe has shown that one unit more would go above.
 * That proof is what makes the plan DETERMINISTIC: the refund re-plans on the figure the window showed, and the largest amount
 * fitting that figure is the same amount (the total never falls as the amount rises), so the split cannot move between the
 * look and the confirm (the 409 loop of Part 4's J3). Throws when Stripe cannot be asked; refuses when nothing is left to
 * credit, or when MAX_PREVIEWS ends before the bracket closes — a figure that is not proven the nearest is never stated (R1).
 */
export async function planCreditNote(stripe: Stripe, target: CreditTarget, cardCents: number): Promise<CreditPlan | CreditRefusal> {
  const { order, pool } = creditRoom(target);
  if (pool <= 0 || cardCents <= 0) return { ok: false, status: 409, error: REFUND_WORDS.nothingToCredit };
  const notWorkedOut: CreditRefusal = { ok: false, status: 409, error: REFUND_WORDS.noteNotWorkedOut };
  const leftOnInvoice = target.total - target.creditedCents;
  let previews = 0;
  const preview = (b: number) => {
    previews++;
    return stripe.creditNotes.preview({ invoice: target.invoiceId, lines: creditLines(order, b) }, READ_OPTS);
  };

  let lo: (CreditSeen & { note: Stripe.CreditNote }) | null = null;
  let hi: CreditSeen | null = null;
  let prev: CreditSeen | null = null;
  // Where the note moves onto the next line (the running total of the rooms, largest line first).
  const spills: number[] = [];
  for (let i = 0, at = 0; i < order.length - 1; i++) { at += order[i].room; if (at < pool) spills.push(at); }
  let b = leftOnInvoice <= 0 || cardCents >= leftOnInvoice ? pool
    : Math.min(pool, Math.max(1, Math.round(cardCents * pool / leftOnInvoice)));
  for (;;) {
    const note = await preview(b);
    const seen = { b, total: note.total };
    if (note.total <= cardCents) lo = { ...seen, note }; else hi = seen;
    if ((hi?.b ?? pool + 1) - (lo?.b ?? 0) <= 1) break;
    if (previews >= MAX_PREVIEWS) return notWorkedOut;
    b = nextCreditAmount(seen, prev, lo, hi, cardCents, pool, spills);
    prev = seen;
  }
  // Nothing fits, or Stripe's note is not all after payment (`refund_amount` must equal its total exactly or Stripe refuses it).
  if (!lo || lo.note.total <= 0 || lo.note.post_payment_amount !== lo.note.total) return notWorkedOut;
  return {
    ok: true,
    lines: creditLines(order, lo.b),
    cardCents: lo.note.total,
    beforeTaxCents: lo.note.total_excluding_tax ?? lo.note.subtotal,
    taxes: lo.note.total_taxes ?? [],
    capped: lo.b === pool && lo.note.total < cardCents,
  };
}
