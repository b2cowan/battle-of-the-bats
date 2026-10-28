import { formatLongDay, formatShortDay } from './free-time';

/**
 * Free time on a Coaches Portal (Support console Stage 4b): the rules and words, with no database in them. The reads
 * and writes are in `lib/portal-free-time-server.ts`.
 *
 * A portal given free time is stored ENDED (organization cancelled, billing mode `platform_override`) and held open by
 * a Stage 4 billing-status grant (`org_overrides`, type `subscription_status`) whose end is the last free day; the
 * team's entitlement carries the same end. Nothing runs at the end: every reader asks whether the portal is in force,
 * and the answer changes by itself the moment the grant runs out (owner rulings 2026-10-27, Q1/Q6).
 *
 * ⚠ The end is NEVER a cancel. Free-time code must not import the cancel or retention functions
 * (`tests/unit/support-console-stage4b-guard.test.ts`, T15): a cancel archives tournaments and starts a 365-day
 * retention clock, which is the data-loss path the owner ruled out.
 */

/** The grant type that holds a free-time portal open. */
export const PORTAL_FREE_TIME_GRANT_TYPE = 'subscription_status';

/** The coach's cancel, refused while free time runs (Q11-4; words reviewed by /billing and /marketing 2026-10-27). */
export function coachCancelRefusal(lastDay: string): string {
  return `There's nothing to cancel. Your Premium Coaches Portal is free through ${formatLongDay(lastDay)}, then goes back to the free Coaches Portal by itself.`;
}

/** The console's cancel, refused while free time runs: End it now is the way (Q11-4). */
export function staffCancelRefusal(portalName: string, lastDay: string): string {
  return `${portalName} has free time through ${formatShortDay(lastDay)}. End it now from its Access list instead of cancelling.`;
}

/** A bulk action's summary line for the portals it skipped (Q9, T8/T33). */
export function bulkPortalSkipLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1
    ? 'Skipped 1 Coaches Portal: its plan and free time can only be changed on its own record.'
    : `Skipped ${count} Coaches Portals: their plan and free time can only be changed on each portal's own record.`;
}
