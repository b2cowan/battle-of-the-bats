import {
  BILLING_ADDRESS_REQUIRED,
  BILLING_LOCATION_WORDS,
  storedLocationStillValid,
  type BillingLocation,
  type ReviewReason,
  type StoredBillingLocation,
} from './billing-location';
import { PLATFORM_CONTACT_EMAIL } from './online-payment-words';

/**
 * HOW A BUYER IS TAXED (GST/HST Stage 2; build prompt docs/projects/active/GST_HST_STAGE2_BUILD_PROMPT.md, owner rulings
 * 2026-11-05). Pure: no I/O, no env. The one answer every paid path asks before it touches Stripe, through
 * `requireBillingLocation` (lib/billing-location-server.ts), and every quote asks of Stripe's answer after.
 *
 *   · Tax follows the buyer's billing address on our own records (Stage 1), which every Stripe customer carries. Stripe Tax
 *     decides the rate from the PROVINCE or state (verified in test mode 2026-11-05), so the address check refuses a Canadian
 *     postal code from another province (Ask 4, lib/billing-location.ts).
 *   · Ask 1: a flagged CANADIAN address is taxed by that address (it already is Canadian). A flagged US address — its card or
 *     payouts point at Canada, or its country changed after paying — is HELD: no paid step, a plain sentence, the existing
 *     platform-admin flag, no email. Relaxing it is a Stage 8 choice. US sales closed (production) means no US address passes.
 *   · Prices are tax-exclusive and the account's default is exclusive (T4): tax is added on top.
 *   · ⚠ Stripe answers "no address it can place" with a SILENT $0 in a preview (`automatic_tax.status`
 *     `requires_location_inputs`, verified 2026-11-05); Checkout refuses the same customer. A quote that is not `complete` is
 *     never shown (`taxWasWorkedOut`).
 */

/** The one setting every taxed Stripe call spreads. tests/unit/billing-location-every-path-guard.test.ts fails the build on a charging call without it. */
export const AUTOMATIC_TAX = { enabled: true } as const;

/**
 * What every subscription Checkout session adds (paths A, B and C, Part 2). Tax by the address already on the customer (Stage 1
 * put it there; Checkout refuses a customer it cannot place, verified 2026-11-05). Ask 6: the buyer may enter a GST/HST number,
 * which Stripe only allows on an existing customer with `customer_update.name = 'auto'` (Checkout then writes the business name
 * typed onto the customer; owner accepted). ⚠ NEVER `customer_update.address`: the address changes only in our own window (Stage
 * 1), and `auto` would let Checkout replace it with what the card form collects.
 */
export const TAXED_CHECKOUT = {
  automatic_tax: AUTOMATIC_TAX,
  tax_id_collection: { enabled: true },
  customer_update: { name: 'auto' },
} as const;

/**
 * A RECOVERED STRIPE FEE's tax (Ask 3, owner 2026-11-05; docs/agents/accounting/RECOVERED_STRIPE_FEES_TAX.md): consideration for our
 * payment service, taxed on top at the club's province rate. The code is `txcd_90050001` ("Platform Fee"), never the account's
 * SaaS preset, which describes the subscription. ⚠⚠ The code decides WHERE Stripe Tax places the supply: Part 6 (test mode
 * 2026-11-05, `.probe/gst2/part6-fee-code-2-run1.txt`) found `txcd_20030000` "General - Services" is ORIGIN-sourced in Canada, so
 * every club paid our head office's Ontario 13%; "Platform Fee" is destination-sourced (5 / 13 / 14 / 15 by the club's province,
 * US 0), which is the place of supply the accounting topic names (the club's address, Memo 3-3-6). Pick a new code only after
 * checking its sourcing with a tax calculation. ⚠ Club Stage 5's online-payment fee takes the SAME treatment and must share this
 * constant: if the payment service is ever ruled exempt (D1), both lose their tax together.
 */
export const RECOVERED_FEE_TAX = { tax_behavior: 'exclusive', tax_code: 'txcd_90050001' } as const;

/** Where we keep the name WE put on a Stripe customer, so a name the buyer typed on Stripe's page is never overwritten. */
export const BUYER_NAME_META = 'fieldlogic_buyer_name';

/**
 * The buyer's name on the Stripe customer (accounting review 2026-11-05, 6b: an invoice of $500 or more must show it; every yearly
 * club plan is one). Ours follows our records (the club's name; the coach's own for Premium). A name the buyer typed on Stripe's
 * page (Checkout's business name, Ask 6) differs from the one we stored, so it is theirs and is kept. Null = nothing to change.
 */
export function buyerNameUpdate(
  customer: { name?: string | null; metadata?: Record<string, string> | null },
  name: string | null | undefined,
): { name?: string; metadata: Record<string, string> } | null {
  const want = name?.trim();
  if (!want) return null;
  const current = customer.name?.trim() ?? '';
  const ours = customer.metadata?.[BUYER_NAME_META] ?? null;
  if (current === want) return ours === want ? null : { metadata: { [BUYER_NAME_META]: want } };
  if (current && current !== ours) return null;
  return { name: want, metadata: { [BUYER_NAME_META]: want } };
}

/**
 * After a subscription Checkout (paths A, B, C; GST/HST Stage 2 Part 6b, owner 2026-11-05): the club's name goes back on its Stripe
 * customer unless the buyer typed a business name on Stripe's page. `customer_update.name: 'auto'` (TAXED_CHECKOUT, needed for the
 * GST/HST number field) makes Checkout write the CARDHOLDER's name onto the customer when no business name is typed, and
 * `buyerNameUpdate` would then read that name as the buyer's own and keep it on every later invoice. Part 0 (test mode 2026-11-05):
 * a typed name arrives as `collected_information.business_name` (and becomes the customer's name); none typed leaves it null and
 * `customer_details.name` = the cardholder. A typed name is kept with `BUYER_NAME_META` left as ours, so it stays "theirs".
 * Null = change nothing: a business name was typed; no name of ours is stored (an old customer: we never invent one); the name is
 * already ours; or the customer's name is not the one Checkout wrote (someone set it after Checkout, so a late or replayed event
 * never overwrites it). ⚠ R4 (owner 2026-11-05): an invoice made INSIDE Checkout (a returning club, no second trial; Premium) is
 * already finalized and may name the cardholder; this fixes every invoice after it.
 */
export function buyerNameAfterCheckout(
  session: {
    collected_information?: { business_name?: string | null } | null;
    customer_details?: { name?: string | null; business_name?: string | null } | null;
  },
  customer: { name?: string | null; metadata?: Record<string, string> | null },
): { name: string } | null {
  // A payload with no `collected_information` at all (a webhook endpoint on an older API version) cannot say whether a name was
  // typed, and a typed one would look like the cardholder's (Part 0: `customer_details.name` = the typed business name), so it
  // changes nothing (/review 2026-11-06). The test endpoint is pinned to 2026-04-22.dahlia, which always carries the object.
  if (!session.collected_information) return null;
  if (session.collected_information.business_name?.trim() || session.customer_details?.business_name?.trim()) return null;
  const ours = customer.metadata?.[BUYER_NAME_META]?.trim();
  if (!ours) return null;
  const current = customer.name?.trim() ?? '';
  if (current === ours) return null;
  const written = session.customer_details?.name?.trim() ?? '';
  if (!written || current !== written) return null;
  return { name: ours };
}

/** One tax on an invoice, as a buyer reads it: "HST 13%". From Stripe's tax rate (Stripe Tax makes one per jurisdiction). */
export function taxLineLabel(rate: { display_name?: string | null; percentage?: number | null; effective_percentage?: number | null }): string {
  const pct = rate.effective_percentage ?? rate.percentage;
  const name = rate.display_name?.trim() || 'Tax';
  return pct == null ? name : `${name} ${Number(pct.toFixed(3))}%`;
}

/**
 * An invoice's (or preview's, or credit note's) taxes, named and summed per name, in the order Stripe lists them. `rateOf` reads a
 * tax rate by id (the caller's Stripe; injected so this file stays pure). A tax with no rate behind it reads as "Tax".
 */
export async function namedTaxLines(
  totalTaxes: ReadonlyArray<{ amount: number; tax_rate_details?: { tax_rate?: string | { id: string } | null } | null }> | null | undefined,
  rateOf: (id: string) => Promise<{ display_name?: string | null; percentage?: number | null; effective_percentage?: number | null }>,
): Promise<Array<{ label: string; cents: number }>> {
  const taxed = (totalTaxes ?? []).filter(t => t.amount).map(t => {
    const ref = t.tax_rate_details?.tax_rate;
    return { amount: t.amount, id: typeof ref === 'string' ? ref : ref?.id ?? null };
  });
  const ids = [...new Set(taxed.map(t => t.id).filter((id): id is string => !!id))];
  const labels = new Map(await Promise.all(ids.map(async id => [id, taxLineLabel(await rateOf(id))] as const)));
  const out = new Map<string, number>();
  for (const t of taxed) {
    const label = t.id ? labels.get(t.id)! : 'Tax';
    out.set(label, (out.get(label) ?? 0) + t.amount);
  }
  return [...out].map(([label, cents]) => ({ label, cents }));
}

/** The stable code a held buyer's paid step is refused with (409), beside `billing_address_required`. */
export const BILLING_REVIEW_HOLD = 'billing_review_hold';

export const BILLING_TAX_WORDS = {
  /** Ask 1's hold. No claim that anyone was told: nothing emails (Stage 1 ruling). */
  held: `We need to look at your account before you can pay. Email us at ${PLATFORM_CONTACT_EMAIL} and we’ll sort it out.`,
  /** A quote Stripe could not place (the address did not reach it, or it could not use it). Names no place: it shows in the
   *  "Start your club" window (the address is right above it) and in the move window alike (drawing tab 3, frame 5). */
  notWorkedOut: 'We couldn’t work out the tax for this billing address. Check the address and try again.',
  /** T4: beside every quoted price. One spelling everywhere. */
  plusTax: 'plus applicable taxes',
  /** GST/HST Stage 2 Part 4 (drawing tab 7): the ONE new sentence, under a block of prices whose buttons keep their short
   *  price (the Founding choice buttons, the Change plan table, a sign-up's billing choice). */
  pricesPlusTax: 'Prices are plus applicable taxes.',
} as const;

export type BuyerTax =
  | { ok: true; location: BillingLocation }
  | { ok: false; code: typeof BILLING_ADDRESS_REQUIRED | typeof BILLING_REVIEW_HOLD; error: string };

/**
 * The answer. `stored` is the buyer's row as read; `review` is `currentReview` for that row (never the stored reason alone: the
 * card and payout evidence is worked out when read); `usSalesOpen` is the US switch.
 */
export function decideBuyerTax(facts: {
  stored: StoredBillingLocation | null;
  review: { reason: ReviewReason } | null;
  usSalesOpen: boolean;
}): BuyerTax {
  const location = facts.stored ? storedLocationStillValid(facts.stored, facts.usSalesOpen) : null;
  if (!location) return { ok: false, code: BILLING_ADDRESS_REQUIRED, error: BILLING_LOCATION_WORDS.required };
  if (location.country === 'US' && facts.review) return { ok: false, code: BILLING_REVIEW_HOLD, error: BILLING_TAX_WORDS.held };
  return { ok: true, location };
}

/** Stripe's tax answer on a preview, invoice or session: true only when it placed the buyer and worked the tax out. */
export function taxWasWorkedOut(automaticTax: { enabled?: boolean | null; status?: string | null } | null | undefined): boolean {
  return automaticTax?.enabled === true && automaticTax.status === 'complete';
}

/** Where Stripe placed the buyer for a quote, spelled as our records spell it ("CA", "ON"). */
export type TaxedFor = { country: string; region: string | null };

/**
 * A QUOTE'S TAX, as the paying windows draw it (Part 3; drawings tabs 2–4, ruled 2026-11-05):
 *   · `taxed` — Stripe worked it out. `lines` are named ("HST 13%"); `beforeTax` is the amount the tax sits on, only when the
 *     figures add up exactly (every tax added on top, no customer balance), else null and the window shows the tax and the total
 *     alone; `taxedFor` is the place Stripe used, so a window whose address changes knows its figures are for another province.
 *   · `needs_address` — a "Start your club" quote asked before the club's address was complete: the figures wait for it.
 *   · `not_worked_out` — Stripe could not place the address. The window shows the sentence and Check again, never a figure
 *     without its tax.
 */
export type QuoteTax =
  | { status: 'taxed'; lines: Array<{ label: string; cents: number }>; beforeTax: number | null; taxedFor: TaxedFor | null }
  | { status: 'needs_address' }
  | { status: 'not_worked_out'; error: string };

export type TaxedPreviewLike = {
  amount_due: number;
  total_excluding_tax?: number | null;
  starting_balance?: number | null;
  automatic_tax?: { enabled?: boolean | null; status?: string | null } | null;
  customer_address?: { country?: string | null; state?: string | null } | null;
  total_taxes?: ReadonlyArray<{ amount: number; tax_behavior?: string | null; tax_rate_details?: { tax_rate?: string | { id: string } | null } | null }> | null;
};

/** Stripe's preview, read as a `QuoteTax`. `rateOf` as for `namedTaxLines`. */
export async function quoteTax(
  invoice: TaxedPreviewLike,
  rateOf: Parameters<typeof namedTaxLines>[1],
): Promise<QuoteTax> {
  if (!taxWasWorkedOut(invoice.automatic_tax)) return { status: 'not_worked_out', error: BILLING_TAX_WORDS.notWorkedOut };
  const taxes = invoice.total_taxes ?? [];
  const lines = await namedTaxLines(taxes, rateOf);
  const taxSum = taxes.reduce((sum, t) => sum + t.amount, 0);
  const before = invoice.total_excluding_tax;
  const addsUp = typeof before === 'number'
    && taxes.every(t => t.tax_behavior === 'exclusive')
    && (invoice.starting_balance ?? 0) === 0
    && before + taxSum === invoice.amount_due;
  const place = invoice.customer_address;
  return {
    status: 'taxed', lines, beforeTax: addsUp ? before : null,
    taxedFor: place?.country ? { country: place.country.toUpperCase(), region: place.state ? place.state.toUpperCase() : null } : null,
  };
}
