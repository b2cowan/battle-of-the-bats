/**
 * The launch switch for online payments (Club Tier Stage 12). The owner's decision to switch it on (real payments terms first) is the launch gate (counsel no longer gates it, owner 2026-11-04),
 * so the feature has TWO locks, and both must open:
 *
 *  1. `ONLINE_PAYMENTS_ENABLED` — a server-only env var, the `GUARDIAN_TIER_ENABLED` convention: absent or anything other
 *     than the literal 'true' means OFF. Deliberately not `NEXT_PUBLIC_`: the browser learns the answer from the server.
 *     Production's setting is the owner's own switch: absent means off.
 *  2. `LIVE_PAYMENTS_ALLOWED` — a code constant, true since the owner's switch-on commit (2026-11-23, the Payments Terms
 *     published first). While it was false, a LIVE Stripe key turned the feature off even with the env var set, so no real
 *     money could move by a console setting alone. Turning it true was one reviewed commit (the `CHAT_PAUSED` reasoning:
 *     a reversal that matters is a commit, not a toggle). Setting it back to false is the same one-line commit, and it
 *     shuts every live payment door whatever the env var says.
 *
 * With the switch off, no Payouts card, no Pay button and no pay link renders anywhere, and every connect, pay and refund
 * route refuses. `tests/unit/online-payments-switch.test.ts` proves production is off; the guard test proves every door
 * reads `onlinePaymentsOn()`.
 */

import { stripeKeyIsTest } from './stripe-mode';

export { stripeKeyIsLive, stripeKeyIsTest } from './stripe-mode';

export const LIVE_PAYMENTS_ALLOWED: boolean = true;

/** The one question every online-payments door asks. */
export function onlinePaymentsOn(env: Record<string, string | undefined> = process.env): boolean {
  if (env.ONLINE_PAYMENTS_ENABLED !== 'true') return false;
  if (stripeKeyIsTest(env.STRIPE_SECRET_KEY)) return true;
  // Deliberately strict, and the one prefix test outside lib/stripe-mode.ts: a restricted `rk_live_` key does NOT open
  // family payments. Widening this is its own decision, not part of the shared live/test rule (Stage 0, S7).
  return LIVE_PAYMENTS_ALLOWED && !!env.STRIPE_SECRET_KEY?.startsWith('sk_live_');
}

/** The refusal a route returns while the switch is off. Never shown on a screen: the screens hide the door. */
export const ONLINE_PAYMENTS_OFF_ERROR = 'Online payments aren’t available.';
