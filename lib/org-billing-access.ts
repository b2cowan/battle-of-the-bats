import type { Organization } from './types';

/**
 * Billing access rail — "a cancelled account stops working, immediately."
 *
 * OWNER RULING 2026-08-06 (binding, logged in BUSINESS_DECISIONS.md): when an organization's
 * subscription is cancelled, access stops at once. Data is retained untouched (the existing 90-day
 * `billing_retained_records` window is unchanged), so resubscribing restores everything intact.
 *
 * ── Why this module exists ───────────────────────────────────────────────────────────────────
 * The platform-admin cancel dialog has always PROMISED this ("Will shut down: … coach portal …
 * score updates …"). Until now it wrote `subscription_status: 'canceled'` and nothing on the two
 * biggest surfaces read it: not one of the ~150 coach API routes consulted a billing gate, and the
 * tournament write routes authorise on ROLE (`hasCapability`), which cannot see billing. The org
 * kept its `plan_id`, so every plan-rank feature stayed open — forever, with no expiry.
 *
 * `hasModuleEntitlement` already fails closed on a cancelled org, but it is only called by the
 * accounting / house-league / rep-teams / public-site module checks. This rail closes the rest by
 * putting the question at the ONE chokepoint every authenticated org route already passes through:
 * `getAuthContext` in lib/api-auth.ts.
 *
 * ── Fails closed by design ───────────────────────────────────────────────────────────────────
 * A route that does nothing gets the gate. Staying reachable while cancelled requires explicitly
 * passing `allowSuspendedOrg: true`, and `tests/unit/org-billing-access-guard.test.ts` pins the
 * exact set of files allowed to do that — **adding one fails the build until the list is edited,
 * which is the decision point.** Same shape as the coaches-portal archive allow-lists.
 *
 * ── Deliberately NOT suspended ───────────────────────────────────────────────────────────────
 * `past_due` keeps working. A failed payment writes `past_due` (never `canceled`) and notifies the
 * org — only Stripe GIVING UP after its full retry window produces `canceled`. That gives the
 * dunning path a real grace period for free, which is why an immediate hard-block is safe here.
 * Verified: app/api/billing/webhook/route.ts `invoice.payment_failed` → 'past_due'.
 */

/**
 * The single predicate. Read the org AFTER `applyEntitlementGrants` has run, so a platform-admin
 * `subscription_status: 'active'` override still rescues an account — that operator escape hatch
 * is the intended way to reinstate someone without touching Stripe.
 */
export function isOrgBillingSuspended(
  org: Pick<Organization, 'subscriptionStatus'>,
): boolean {
  return org.subscriptionStatus === 'canceled';
}

/**
 * Thrown by `getAuthContext` when a suspended org reaches a route that has not opted out.
 *
 * A THROW rather than a `null` return, deliberately: `null` is the existing "not signed in" signal
 * and all ~242 call sites turn it into a 401, which reads to a client as a dead session and can
 * bounce a signed-in person into a sign-in loop. Throwing lets `withObservability` — which wraps
 * every single one of those routes (verified: zero unwrapped) — answer 402 in ONE place, with no
 * per-route edits and no chance of a route forgetting.
 */
export class OrgBillingSuspendedError extends Error {
  readonly billingSuspended = true;
  readonly orgSlug: string;
  // ⚠ Explicit field + assignment, NOT a TypeScript parameter property: the unit-test runner
  // strips types rather than compiling them, and `constructor(readonly x: string)` is a syntax
  // error there. Keep this shape.
  constructor(orgSlug: string) {
    super(`Organization "${orgSlug}" has a cancelled subscription.`);
    this.name = 'OrgBillingSuspendedError';
    this.orgSlug = orgSlug;
  }
}

/**
 * 402 Payment Required — the honest status for "you are who you say you are, the org just doesn't
 * pay any more." Deliberately NOT 401 (which would read as a broken session) and not a bare 403
 * (which reads as "wrong role"). The `billingSuspended` flag is what client code keys on to show
 * the cancelled state instead of an error. NOT counted as a server error by observability.
 */
export function billingSuspendedResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'This organization\'s subscription has ended.',
      billingSuspended: true,
    }),
    { status: 402, headers: { 'Content-Type': 'application/json' } },
  );
}
