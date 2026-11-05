import type { OrgPlan } from './types';

/**
 * THE PREVIEW'S OWN LINES — what Stripe's invoice preview is made of, so the move window can draw "Due today" as lines that add up
 * (Plan & billing Stage 4b, Part 2; plan §3.3, ruling 4): the new plan for the rest of the period, and the credit for the time
 * left on the old one.
 *
 * PURE, and STRICT. The lines are drawn from Stripe's response and nothing else, but a line is only SHOWN when every one of these
 * holds, because a partial or reworded breakdown is worse than none (the shipped total-only preview stays as the fallback — `null`):
 *   · every line is a proration of a subscription item, in the invoice's own currency, a whole number of cents;
 *   · there is no discount and no customer balance in play (either and the lines no longer add up to the amount due), and any
 *     tax is ADDED ON TOP (GST/HST Stage 2 Part 3: a line's amount is then before tax, and the window draws the tax as its own
 *     row from `quoteTax`, lib/billing-tax.ts; an included tax would hide inside the lines);
 *   · each line is on the NEW price (a charge) or on the OLD price (a credit), by the price id Stripe reports — never by its
 *     wording, which is Stripe's and changes — and its sign agrees (a charge is positive, a credit is negative);
 *   · the lines plus the tax add up to the amount due, exactly, and the list is complete (`has_more` is not set).
 * Lines of one price are added together, so the screen gets at most one charge and one credit.
 */

export type MovePreviewLine = {
  kind: 'charge' | 'credit';
  /** The plan the line is for: the target for a charge, the plan being left for a credit. */
  plan: OrgPlan;
  /** Cents, always positive; `kind` carries the sign. */
  amount: number;
};

type PriceRef = string | { id?: string } | null | undefined;

export type PreviewInvoiceLike = {
  amount_due: number;
  currency: string;
  starting_balance?: number | null;
  total_taxes?: Array<{ amount: number; tax_behavior?: string | null }> | null;
  total_discount_amounts?: unknown[] | null;
  lines?: {
    has_more?: boolean;
    data?: Array<{
      amount: number;
      currency: string;
      discount_amounts?: unknown[] | null;
      parent?: { type?: string; subscription_item_details?: { proration?: boolean } | null } | null;
      pricing?: { price_details?: { price?: PriceRef } | null } | null;
    }> | null;
  } | null;
};

const priceIdOf = (ref: PriceRef): string | null => (typeof ref === 'string' ? ref : ref?.id ?? null);
const none = (list: unknown[] | null | undefined): boolean => !list || list.length === 0;

export function trustedPreviewLines(
  invoice: PreviewInvoiceLike,
  p: { fromPriceId: string; toPriceId: string; fromPlan: OrgPlan; toPlan: OrgPlan },
): MovePreviewLine[] | null {
  const lines = invoice.lines?.data;
  if (!lines || lines.length === 0 || invoice.lines?.has_more) return null;
  if (p.fromPriceId === p.toPriceId) return null;
  if (!none(invoice.total_discount_amounts) || (invoice.starting_balance ?? 0) !== 0) return null;
  const taxes = invoice.total_taxes ?? [];
  if (taxes.some(t => t.tax_behavior !== 'exclusive' || !Number.isInteger(t.amount))) return null;
  const tax = taxes.reduce((sum, t) => sum + t.amount, 0);

  let charge = 0;
  let credit = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.amount) || line.currency !== invoice.currency) return null;
    if (!none(line.discount_amounts)) return null;
    if (line.parent?.type !== 'subscription_item_details' || line.parent.subscription_item_details?.proration !== true) return null;
    const price = priceIdOf(line.pricing?.price_details?.price);
    if (price === p.toPriceId && line.amount > 0) charge += line.amount;
    else if (price === p.fromPriceId && line.amount < 0) credit += -line.amount;
    else return null;
  }
  if (charge - credit + tax !== invoice.amount_due) return null;

  const out: MovePreviewLine[] = [];
  if (charge > 0) out.push({ kind: 'charge', plan: p.toPlan, amount: charge });
  if (credit > 0) out.push({ kind: 'credit', plan: p.fromPlan, amount: credit });
  return out.length > 0 ? out : null;
}
