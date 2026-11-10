import type { OrgPlan } from './types';
import { isTeamWorkspaceOrg } from './team-workspace-kind';
import { teamWorkspaceReactivatePath } from './coaches-portal-routes';

const TOURNAMENT_TIERS: OrgPlan[] = ['tournament', 'tournament_plus'];

export function isTournamentTier(planId: OrgPlan | string | undefined | null): boolean {
  return TOURNAMENT_TIERS.includes(planId as OrgPlan);
}

export type BillingUrlOrg = {
  slug: string;
  planId?: string | null;
  accountKind?: string | null;
  subscriptionStatus?: string | null;
  name?: string | null;
};

/** An `organizations` row, as the server routes read it, in the shape the resolver takes. `status` overrides
 *  the row's own when the caller is describing the state it is about to write (e.g. `'canceled'`). */
export function billingUrlOrgFromRow(
  row: { slug: string; plan_id?: string | null; account_kind?: string | null; subscription_status?: string | null; name?: string | null },
  status?: string,
): BillingUrlOrg {
  return {
    slug: row.slug,
    planId: row.plan_id,
    accountKind: row.account_kind,
    subscriptionStatus: status ?? row.subscription_status,
    name: row.name,
  };
}

/** Workspace billing in the person's own portal. Explicit admin hosts keep their own chrome;
 *  messages derive it from the workspace. A lapsed standalone workspace needs the existing
 *  reactivation journey because its cancelled wall precedes every page in the coaches layout.
 *  Payment returns retain their page and flags while the refreshed subscription settles. */
export function getBillingHref(org: BillingUrlOrg, options: { host?: 'admin' | 'coach'; purpose?: 'return' } = {}): string {
  const coach = options.host ? options.host === 'coach' : isTeamWorkspaceOrg(org);
  if (coach) {
    if (org.subscriptionStatus === 'canceled' && options.purpose !== 'return') {
      return teamWorkspaceReactivatePath({ slug: org.slug, name: org.name });
    }
    return `/${org.slug}/coaches/billing`;
  }
  return isTournamentTier(org.planId)
    ? `/${org.slug}/admin/tournaments/settings/subscription`
    : `/${org.slug}/admin/org/billing`;
}

/**
 * ⚖ WHERE AN ORGANIZATION'S SETTINGS LIVE (navigation Phase 2 Part B, P2 — one home per setting): on the tournament side only
 * for a Tournament plan that is no one-team workspace (its organization has no club portal: `admin/org/layout.tsx` sends it
 * away, by this same rule). Everyone else keeps Members, PDF settings, Payouts, the web address and Plan & billing in
 * Organization, and no tournament row points at them. The sidebar, the place and the old-address redirect all ask this.
 */
export function orgSettingsOnTournamentSide(org: { planId?: string | null; accountKind?: string | null } | null | undefined): boolean {
  return !!org && isTournamentTier(org.planId) && !isTeamWorkspaceOrg(org);
}

/** The web address, where the plan keeps it — Settings & access's Web address tab on the tournament tiers (Tournament admin
 *  redesign Stage 5 addendum, A75; its own tab since navigation Phase 2 Part B, P1), the organization's Settings elsewhere. */
export function getWebAddressHref(orgSlug: string, planId: OrgPlan | string | undefined | null): string {
  return isTournamentTier(planId)
    ? `/${orgSlug}/admin/tournaments/settings/web-address`
    : `/${orgSlug}/admin/org/settings`;
}

/** Members, where the plan keeps it — the tournament's settings on the tournament tiers, the organization elsewhere. */
export function getMembersHref(orgSlug: string, planId: OrgPlan | string | undefined | null): string {
  return isTournamentTier(planId)
    ? `/${orgSlug}/admin/tournaments/settings/members`
    : `/${orgSlug}/admin/org/members`;
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
