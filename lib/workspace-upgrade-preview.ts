import { getStripe } from './stripe';
import { getStripePriceId } from './stripe-prices';
import { getPlanConfigOverride } from './plan-config-db';
import { hadSubscriptionBefore, isoFromUnix, stripeTaxRate, unitAmount, type MoveOrg, type MoveRefusal, type QuotePlace } from './plan-move';
import { AUTOMATIC_TAX, quoteTax } from './billing-tax';
import { workspaceCannotBecomeClub } from './workspace-upgrade-status';
import type { BillingCycle } from './plan-config';
import type { ClubCheckoutPreview } from './workspace-upgrade';
import { PLAN_BILLING_WORDS as W } from './plan-billing-words';

/**
 * No customer/session/subscription is created here. Checkout still rechecks history when submitted.
 * GST/HST Stage 2 Part 3 (drawing tab 4): with no trial the quote is taxed for `place` (the club address typed in the window;
 * checkout stamps that same address on the customer before Stripe's page), so Due today is what Stripe's page charges. With the
 * trial nothing is charged today and nothing is taxed (`tax: null`); Stripe taxes the first charge by the address on that day.
 */
export async function previewClubCheckout(
  org: MoveOrg, toPlan: 'club' | 'club_large', billingCycle: BillingCycle, place: QuotePlace = { kind: 'customer' },
): Promise<ClubCheckoutPreview | MoveRefusal> {
  try {
    const [blocked, priceId, config] = await Promise.all([
      workspaceCannotBecomeClub(org.id), getStripePriceId(toPlan, billingCycle), getPlanConfigOverride(toPlan),
    ]);
    if (blocked) return { code: 'cannot_become_club', error: blocked };
    if (!priceId) return { code: 'price_missing', error: W.clubUpgrade.priceMissing };
    // Same rule checkout applies at submission: a trial only for a customer who has never held a subscription.
    const [price, hadBefore] = await Promise.all([
      unitAmount(priceId),
      config.trialDays > 0 && org.stripeCustomerId ? hadSubscriptionBefore(org.stripeCustomerId) : false,
    ]);
    if (!price.amount) return { code: 'price_missing', error: W.clubUpgrade.priceMissing };
    const trialDays = config.trialDays > 0 && !hadBefore ? config.trialDays : 0;
    const stripe = getStripe();
    // For a returning customer Stripe's invoice preview also accounts for an existing customer balance.
    const invoice = trialDays > 0 ? null : await stripe.invoices.createPreview({
      ...(org.stripeCustomerId ? { customer: org.stripeCustomerId } : {}),
      subscription_details: { items: [{ price: priceId, quantity: 1 }] },
      ...(place.kind === 'wait' ? {} : { automatic_tax: AUTOMATIC_TAX }),
      ...(place.kind === 'typed' ? { customer_details: { address: place.address } } : {}),
    });
    const periodEnd = invoice?.lines.data.find(line => {
      const price = line.pricing?.price_details?.price;
      return (typeof price === 'string' ? price : price?.id) === priceId;
    })?.period.end;
    return {
      toPlan, billingCycle, trialDays,
      amountDueToday: invoice?.amount_due ?? 0,
      nextAmount: price.amount,
      currency: invoice?.currency ?? price.currency,
      firstChargeAt: trialDays > 0 ? new Date(Date.now() + trialDays * 86400_000).toISOString() : null,
      renewsAt: isoFromUnix(periodEnd),
      tax: !invoice ? null : place.kind === 'wait' ? { status: 'needs_address' } : await quoteTax(invoice, stripeTaxRate),
    };
  } catch (error) {
    console.error('[workspace-upgrade-preview] checkout preview failed:', error);
    return { code: 'stripe_error', error: W.clubUpgrade.previewFailed };
  }
}
