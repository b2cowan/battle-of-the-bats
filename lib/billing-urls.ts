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
 * Returns the correct notification-settings URL for an org.
 * Tournament and Tournament Plus users have no org admin concept — the /admin/org
 * area (incl. the global notification-preferences page) is walled off for them,
 * so their notification settings live on the per-tournament notifications page.
 */
export function getNotificationSettingsHref(orgSlug: string, planId: OrgPlan | string | undefined | null): string {
  return isTournamentTier(planId)
    ? `/${orgSlug}/admin/tournaments/settings/notifications`
    : `/${orgSlug}/admin/org/notifications`;
}
