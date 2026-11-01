import type Stripe from 'stripe';
import { stripeEnvironment } from './stripe-mode';
import { PORTAL_CONFIG_KEY, PORTAL_CONFIG_VERSION, PORTAL_FEATURES, portalConfigVersion } from './stripe-portal-settings';

/**
 * Our own Stripe customer-portal configuration, found or created (Plans & pricing Stage 0, Part 3, S8). The portal route
 * passes it on every session, so a toggle in Stripe's dashboard can no longer change what a customer may do there. What
 * it offers, and the version rule, live in lib/stripe-portal-settings.ts.
 *
 * The first portal opened in a mode creates that mode's configuration: in LIVE mode, the first live portal open writes it
 * to the live Stripe account.
 */

type PortalStripe = {
  billingPortal: {
    configurations: {
      list(params: Stripe.BillingPortal.ConfigurationListParams): AsyncIterable<Stripe.BillingPortal.Configuration>;
      create(params: Stripe.BillingPortal.ConfigurationCreateParams): Promise<Stripe.BillingPortal.Configuration>;
      update(id: string, params: Stripe.BillingPortal.ConfigurationUpdateParams): Promise<Stripe.BillingPortal.Configuration>;
    };
  };
};

// One lookup per mode for the life of the process; concurrent first opens share one.
const cache = new Map<string, Promise<string>>();

/** Forgets the cached ids (tests; a version bump in a running process is a deploy, which starts a new one anyway). */
export function resetPortalConfigurationCache() {
  cache.clear();
}

async function findOrCreate(stripe: PortalStripe): Promise<string> {
  const ours: Stripe.BillingPortal.Configuration[] = [];
  for await (const config of stripe.billingPortal.configurations.list({ active: true, limit: 100 })) {
    if (portalConfigVersion(config) !== null) ours.push(config);
  }

  const current = ours.find(c => portalConfigVersion(c) === PORTAL_CONFIG_VERSION)
    ?? await stripe.billingPortal.configurations.create({
      name: `FieldLogicHQ portal v${PORTAL_CONFIG_VERSION}`,
      features: PORTAL_FEATURES,
      metadata: { [PORTAL_CONFIG_KEY]: PORTAL_CONFIG_VERSION },
    });

  // An older version of ours is switched off, never edited. A failure here costs nothing a customer sees: the session
  // names the current configuration explicitly.
  for (const old of ours.filter(c => portalConfigVersion(c) !== PORTAL_CONFIG_VERSION)) {
    await stripe.billingPortal.configurations.update(old.id, { active: false })
      .catch(error => console.error(`[portal config] could not deactivate ${old.id}:`, error));
  }
  return current.id;
}

/**
 * The id of our portal configuration in the current Stripe mode, created when it does not exist yet. Throws when Stripe
 * cannot be asked or refuses: the portal route then answers "not configured" and NEVER falls back to the dashboard default
 * (that fallback is what this replaces).
 */
export function ourPortalConfigurationId(stripe: PortalStripe): Promise<string> {
  const mode = stripeEnvironment();
  let pending = cache.get(mode);
  if (!pending) {
    pending = findOrCreate(stripe);
    cache.set(mode, pending);
    pending.catch(() => cache.delete(mode));
  }
  return pending;
}
