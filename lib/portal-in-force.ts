/**
 * THE ONE QUESTION: is this Coaches Portal in force right now? (Support console Stage 4b, owner rulings 2026-10-27, Q6.)
 *
 * A portal is in force when BOTH hold:
 *   1. its organization, read through Stage 4's door (`lib/entitlement-grants.ts`), is not cancelled: a paid portal
 *      reads its own stored status, a portal on free time is stored cancelled and held open by a billing-status grant;
 *   2. its team has a running entitlement (`team_entitlements`): a live status, started, and not past `ends_at`.
 * The answer changes by itself the moment a grant or an `ends_at` passes; nothing is scheduled.
 *
 * It replaced six private definitions of "live portal" that disagreed on incomplete, unpaid and staff cancel. The
 * workspace's own `subscription_status` is now a Stripe mirror, read only by writers and reactivation:
 * `tests/unit/support-console-stage4b-inforce-guard.test.ts` fails the build on a new raw read of it.
 *
 * Written to take any end, so Founding's turn-off can ride it later. ⚠ 4b gives no Founding row an end.
 *
 * This file is pure (the rule); the reads are in `lib/portal-in-force-server.ts`.
 */

/** The entitlement statuses that hold a team open (the per-team gate's own list). */
export const IN_FORCE_ENTITLEMENT_STATUSES = ['active', 'trialing', 'past_due'] as const;

export type EntitlementFacts = { status: string | null; starts_at: string | null; ends_at: string | null };

/** A team entitlement is running: a live status, started, and its end (exclusive) not reached. */
export function isEntitlementRunning(row: EntitlementFacts, now: Date = new Date()): boolean {
  if (!row.status || !(IN_FORCE_ENTITLEMENT_STATUSES as readonly string[]).includes(row.status)) return false;
  if (row.starts_at && new Date(row.starts_at) > now) return false;
  if (row.ends_at && new Date(row.ends_at) <= now) return false;
  return true;
}

/** The rule itself: the door's status for the organization, and the team's entitlements. */
export function isPortalInForceFrom(
  facts: { doorStatus: string | null | undefined; entitlements: EntitlementFacts[] },
  now: Date = new Date(),
): boolean {
  if (!facts.doorStatus || facts.doorStatus === 'canceled') return false;
  return facts.entitlements.some(e => isEntitlementRunning(e, now));
}
