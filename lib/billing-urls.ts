import type { OrgPlan } from './types';

const TOURNAMENT_TIERS: OrgPlan[] = ['tournament', 'tournament_plus'];

export function isTournamentTier(planId: OrgPlan | string | undefined | null): boolean {
  return TOURNAMENT_TIERS.includes(planId as OrgPlan);
}

/**
 * Returns the correct billing/subscription management URL for an org.
 * Tournament and Tournament Plus users have no org admin concept — their
 * billing lives entirely within /admin/tournaments/settings/subscription.
 */
export function getBillingHref(orgSlug: string, planId: OrgPlan | string | undefined | null): string {
  return isTournamentTier(planId)
    ? `/${orgSlug}/admin/tournaments/settings/subscription`
    : `/${orgSlug}/admin/org/billing`;
}

/**
 * Returns the notification-settings URL for an org's admin bell.
 *
 * Notification Settings Phase 1 (locked D1): every bell across the product deep-links
 * into the ONE universal page (`/account/notifications`) — the tier branch is retired.
 * `?focus=org-<slug>` lands the reader on this org's card. Consumer-shell route, so it
 * never violates the "Tournament tiers stay out of /admin/org/*" rule.
 */
export function getNotificationSettingsHref(orgSlug: string): string {
  return `/account/notifications?focus=org-${orgSlug}`;
}
