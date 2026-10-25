/**
 * The launch switch for online payments (Club Tier Stage 12). Counsel's sign-off is the launch gate (Decided 2026-07-28),
 * so the feature has TWO locks, and both must open:
 *
 *  1. `ONLINE_PAYMENTS_ENABLED` — a server-only env var, the `GUARDIAN_TIER_ENABLED` convention: absent or anything other
 *     than the literal 'true' means OFF. Deliberately not `NEXT_PUBLIC_`: the browser learns the answer from the server.
 *     Production does not set it.
 *  2. `LIVE_PAYMENTS_ALLOWED` — a code constant, false. While it is false, a LIVE Stripe key turns the feature off even
 *     with the env var set, so no real money can move by a console setting alone. Turning it true is one reviewed commit,
 *     made only after counsel signs off (the `CHAT_PAUSED` reasoning: a reversal that matters is a commit, not a toggle).
 *
 * With the switch off, no Payouts card, no Pay button and no pay link renders anywhere, and every connect, pay and refund
 * route refuses. `tests/unit/online-payments-switch.test.ts` proves production is off; the guard test proves every door
 * reads `onlinePaymentsOn()`.
 */

export const LIVE_PAYMENTS_ALLOWED: boolean = false;

/** True when the server's Stripe key is a test key (`sk_test_`). A missing key is not a test key. */
export function stripeKeyIsTest(key: string | undefined = process.env.STRIPE_SECRET_KEY): boolean {
  return !!key && key.startsWith('sk_test_');
}

/** The one question every online-payments door asks. */
export function onlinePaymentsOn(env: Record<string, string | undefined> = process.env): boolean {
  if (env.ONLINE_PAYMENTS_ENABLED !== 'true') return false;
  if (stripeKeyIsTest(env.STRIPE_SECRET_KEY)) return true;
  return LIVE_PAYMENTS_ALLOWED && !!env.STRIPE_SECRET_KEY?.startsWith('sk_live_');
}

/** The refusal a route returns while the switch is off. Never shown on a screen: the screens hide the door. */
export const ONLINE_PAYMENTS_OFF_ERROR = 'Online payments aren’t available.';
