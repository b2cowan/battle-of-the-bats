/**
 * A PREMIUM COACHES PORTAL HAS NO ORGANIZATION PAGES (Settings in both workspaces, Session 3 — ruling 1R, 2026-11-20;
 * plan `docs/projects/active/RETIRE_OLD_TOURNAMENT_ONLY_NAV_PLAN.md` step 2d, build prompt
 * `SETTINGS_BOTH_WORKSPACES_BUILD_PROMPT.md` Session 3).
 *
 * A one-team workspace kept the tournament side's Account group — Staff & access, Audit log, Settings, PDF settings — on
 * `/admin/org/*`. Each of those now has a home in the portal: people on the team's Staff page (with Run tournaments),
 * the name, web address and birthday date in Team settings › Organization, the print options in Team settings › How your
 * documents look, the deletion request on the portal's Billing page. So the group is gone, and the four old addresses send
 * the coach to those homes, server-side, before the page mounts. The two-step requirement switch went with Settings: it
 * did nothing for a coach's own workspace (`lib/two-step-rule.ts`).
 *
 * ⚖ Only WHILE THE PLAN CARRIES NOTHING BEYOND THE TOURNAMENT TOOLS — the line the board's redirect already draws
 * (`lib/typed-only-pages.ts`). A Premium workspace on free Club time has the club's Organization, and keeps it. A cancelled
 * one is sent too: its portal home answers it (the subscription-ended wall, with the way back).
 *
 * Pure on purpose (the unit guard asks it for every plan). Relative imports: the unit runner resolves no path alias.
 */
import { isTournamentOnlyWorkspace, type EntitlementOrg } from './module-entitlements';
import { isTeamWorkspaceOrg } from './team-workspace-kind';
import { isTournamentTier } from './billing-urls';

export type PremiumOrgPagesOrg = EntitlementOrg & { accountKind?: string | null };

/** The four retired addresses: `/admin/org/members`, `/members/audit`, `/settings`, `/settings/pdf`. */
export type RetiredOrgPage = 'members' | 'audit' | 'settings' | 'pdf';

/** A Premium Coaches Portal whose plan carries nothing beyond the tournament tools: no Organization pages at all. */
export function premiumWithoutOrgPages(org: PremiumOrgPagesOrg | null | undefined): boolean {
  return !!org && isTeamWorkspaceOrg(org) && isTournamentOnlyWorkspace(org);
}

/**
 * Does the admin shell list this organization's Organization pages? Never for a Tournament plan (its org layout sends
 * every one of them away) and never for a Premium workspace above. Whatever lists none can draw no "Account" group: the
 * flat list a tournament-only organization's sidebar used to draw is gone for every plan (the unit guard holds it).
 */
export function adminListsOrgPages(org: PremiumOrgPagesOrg): boolean {
  if (isTeamWorkspaceOrg(org)) return !premiumWithoutOrgPages(org);
  return !isTournamentTier(org.planId);
}

/** Where a retired page's setting lives in the portal, on the workspace's one team. */
export function premiumPortalHome(page: RetiredOrgPage, orgSlug: string, teamId: string): string {
  const team = `/${orgSlug}/coaches/teams/${teamId}`;
  switch (page) {
    case 'members':
    case 'audit':
      return `${team}/staff`;
    case 'settings':
      return `${team}/settings?section=organization`;
    case 'pdf':
      return `${team}/settings?section=documents`;
  }
}
