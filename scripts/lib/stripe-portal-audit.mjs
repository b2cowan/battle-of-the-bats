/**
 * Our Stripe customer-portal configuration, asserted (Plans & pricing Stage 0 S8; Plans end at renewal G13). The ONE copy of
 * these assertions: `scripts/audit-stripe-billing.mjs` (the read-only audit, test or live) and
 * `scripts/rehearse-plan-ending.mjs` (the test-clock rehearsal's case 0) both call it. What the portal should offer lives in
 * `lib/stripe-portal-settings.ts` (the constants the app creates the configuration from), so the app, the audit and the
 * rehearsal read one thing.
 *
 * Read-only: it lists configurations and never creates or changes one.
 */
import { PORTAL_CONFIG_VERSION, PORTAL_FEATURES, portalConfigVersion } from '../../lib/stripe-portal-settings.ts';

export function check(status, area, key, detail, extra = {}) {
  return { status, area, key, detail, ...extra };
}

/** Every check is `{ status: 'PASS' | 'WARN' | 'FAIL', area: 'portal', key, detail }`; `configuration` WARN = ours is missing. */
export async function auditPortal(stripe) {
  const checks = [];
  const ours = [];
  for await (const config of stripe.billingPortal.configurations.list({ active: true, limit: 100 })) {
    if (portalConfigVersion(config) !== null) ours.push(config);
  }
  const config = ours.find(item => portalConfigVersion(item) === PORTAL_CONFIG_VERSION);

  if (!config) {
    const older = ours.map(item => `${item.id} (v${portalConfigVersion(item)})`).join(', ');
    return [check('WARN', 'portal', 'configuration', `Our portal configuration v${PORTAL_CONFIG_VERSION} does not exist in this mode yet; the app creates it the first time anyone opens the portal.${older ? ` Active older versions: ${older}.` : ''}`)];
  }
  checks.push(check('PASS', 'portal', 'configuration', `${config.id} is ours (v${PORTAL_CONFIG_VERSION}) and active.`));
  const stale = ours.filter(item => item.id !== config.id);
  if (stale.length > 0) {
    checks.push(check('WARN', 'portal', 'old_versions', `Older configurations of ours are still active: ${stale.map(item => item.id).join(', ')}. The app deactivates them on the next portal open.`));
  }

  const features = config.features ?? {};
  const assert = (key, ok, pass, fail) => checks.push(check(ok ? 'PASS' : 'FAIL', 'portal', key, ok ? pass : fail));
  const wanted = PORTAL_FEATURES.customer_update.allowed_updates;
  const allowed = features.customer_update?.enabled ? features.customer_update.allowed_updates ?? [] : [];
  const missing = wanted.filter(item => !allowed.includes(item));
  const cancel = features.subscription_cancel;

  assert('payment_method_update', !!features.payment_method_update?.enabled, 'Customers can update payment methods.', 'Payment method updates are disabled.');
  assert('invoice_history', !!features.invoice_history?.enabled, 'Invoice history is enabled.', 'Invoice history is disabled.');
  assert('customer_update', missing.length === 0, `Customer updates enabled for ${allowed.join(', ')}.`,
    `Customer updates are missing: ${missing.join(', ')} (the tax ID is needed for GST/HST).`);
  assert('subscription_update', !features.subscription_update?.enabled, 'Plan switching is off.',
    'Plan switching is enabled in our portal configuration; plan moves belong to the app.');
  assert('subscription_cancel', !!cancel?.enabled && cancel.mode === PORTAL_FEATURES.subscription_cancel.mode
      && cancel.proration_behavior === PORTAL_FEATURES.subscription_cancel.proration_behavior,
    'Cancel is on and ends the subscription at its period end, with no proration (owner ruling 2026-10-31).',
    `Cancel must be on at period end with no proration; it is ${cancel?.enabled ? `on, mode ${cancel.mode}, proration ${cancel.proration_behavior}` : 'off'}.`);
  assert('subscription_pause', !features.subscription_pause?.enabled, 'Subscription pause is off.',
    'Subscription pause is enabled; the app does not model a paused subscription.');
  return checks;
}
