/**
 * The one place a Stripe key's prefix is read (Plans & pricing Stage 0, S7). Live is `sk_live_` or a restricted `rk_live_`;
 * test is `sk_test_` or `rk_test_`. Anything else, including no key at all, is the sandbox: price lookups, the billing
 * webhook's mode check and the fee rows all agree on that, so a restricted live key can never route production to test
 * prices. No imports, so scripts (`scripts/audit-*.mjs`) load it directly.
 *
 * The one deliberate exception is `onlinePaymentsOn` (lib/online-payments-switch.ts): it stays on `sk_live_` alone, as a
 * family-payments safety switch. Widening it is a different decision. `tests/unit/stripe-mode.test.ts` pins both.
 */

const LIVE = /^(sk|rk)_live_/;
const TEST = /^(sk|rk)_test_/;

/** True when the key is a LIVE key (`sk_live_` or `rk_live_`). A Stripe object is this site's only when its `livemode` matches. */
export function stripeKeyIsLive(key: string | undefined = process.env.STRIPE_SECRET_KEY): boolean {
  return !!key && LIVE.test(key);
}

/** True when the key is a test key (`sk_test_` or `rk_test_`). A missing key is not a test key. */
export function stripeKeyIsTest(key: string | undefined = process.env.STRIPE_SECRET_KEY): boolean {
  return !!key && TEST.test(key);
}

/** The `stripe_prices.environment` value for the key: 'live' for a live key, otherwise 'sandbox' (an empty key too). */
export function stripeEnvironment(key: string | undefined = process.env.STRIPE_SECRET_KEY): 'live' | 'sandbox' {
  return stripeKeyIsLive(key) ? 'live' : 'sandbox';
}
