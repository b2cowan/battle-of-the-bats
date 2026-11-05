import {
  BILLING_ADDRESS_REQUIRED,
  BILLING_LOCATION_WORDS,
  storedLocationStillValid,
  toStripeAddress,
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

/** The one setting every taxed Stripe call spreads. tests/unit/billing-tax-guard.test.ts fails the build on a charging call without it. */
export const AUTOMATIC_TAX = { enabled: true } as const;

/** The stable code a held buyer's paid step is refused with (409), beside `billing_address_required`. */
export const BILLING_REVIEW_HOLD = 'billing_review_hold';

export const BILLING_TAX_WORDS = {
  /** Ask 1's hold. No claim that anyone was told: nothing emails (Stage 1 ruling). */
  held: `We need to look at your account before you can pay. Email us at ${PLATFORM_CONTACT_EMAIL} and we’ll sort it out.`,
  /** A quote Stripe could not place (the address did not reach it, or it could not use it). */
  notWorkedOut: 'We couldn’t work out the tax for your billing address. Check the address on Plan & billing and try again.',
  /** T4: beside every quoted price. One spelling everywhere. */
  plusTax: 'plus applicable taxes',
} as const;

export type BuyerTax =
  | { ok: true; location: BillingLocation; stripeAddress: ReturnType<typeof toStripeAddress> }
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
  return { ok: true, location, stripeAddress: toStripeAddress(location) };
}

/** Stripe's tax answer on a preview, invoice or session: true only when it placed the buyer and worked the tax out. */
export function taxWasWorkedOut(automaticTax: { enabled?: boolean | null; status?: string | null } | null | undefined): boolean {
  return automaticTax?.enabled === true && automaticTax.status === 'complete';
}
