import type Stripe from 'stripe';

/**
 * WHAT our Stripe customer portal offers (Plans & pricing Stage 0, Part 3, S8; owner sequence ruling (1), 2026-10-31:
 * "portal settings live in our code"). lib/stripe-portal-config.ts finds or creates the configuration from this; the
 * audit (scripts/audit-stripe-billing.mjs) asserts against the same constants. No runtime imports, so the audit loads it
 * under plain node.
 *
 *   · payment method update, invoice history: the two jobs the billing page sends people there for.
 *   · customer update (name, email, address, tax ID): the GST/HST plan's Stage 2 needs address and tax ID editable.
 *   · cancel AT PERIOD END, no proration: the owner's ruling. The subscription runs to its renewal date and the
 *     webhook's `customer.subscription.deleted` arm ends the plan then (retention for a club, Coaches Portal retention).
 *   · NO plan switching: plan moves are the app's own. Pause is not a portal feature Stripe offers in this API version,
 *     so it is off by omission; the audit still checks it.
 *
 * ⚠ CHANGING ANY OF THIS = BUMP `PORTAL_CONFIG_VERSION`. A new version creates a new configuration and deactivates the old
 * one; a configuration is never edited in place, so Stripe's own history shows what customers were offered when.
 */

export const PORTAL_CONFIG_KEY = 'fieldlogichq_portal_version';
export const PORTAL_CONFIG_VERSION = '1';

export const PORTAL_FEATURES: Stripe.BillingPortal.ConfigurationCreateParams['features'] = {
  customer_update: { enabled: true, allowed_updates: ['name', 'email', 'address', 'tax_id'] },
  invoice_history: { enabled: true },
  payment_method_update: { enabled: true },
  subscription_cancel: { enabled: true, mode: 'at_period_end', proration_behavior: 'none' },
  subscription_update: { enabled: false },
};

/** Ours, by the metadata key; the value says which version. Null for any configuration we did not make. */
export function portalConfigVersion(config: { metadata?: Record<string, string> | null }): string | null {
  return config.metadata?.[PORTAL_CONFIG_KEY] ?? null;
}
