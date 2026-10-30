import type { Organization, OrgRole } from './types';
import { hasBillingAccess, hasCapability } from './roles';
import { hasModuleEntitlement, type EntitlementOrg } from './module-entitlements';
import { TOURNAMENT_GRANT_KEY } from './coach-tournament-grant';
import { isTeamWorkspaceOrg } from './team-workspace-kind';
import { getBillingHref } from './billing-urls';

/** Workspace billing belongs to its standalone owner, including between seasons and before a team exists. */
export function isStandaloneCoachOwner(
  org: Pick<Organization, 'accountKind' | 'planId'> | null | undefined,
  role: OrgRole | null | undefined,
  capabilities: Record<string, boolean> | null,
): boolean {
  return isTeamWorkspaceOrg(org) && hasBillingAccess(role, capabilities);
}

/** Demo sandboxes keep the real product, but never offer a billing entry point. */
export function coachBillingLink(
  org: Pick<Organization, 'slug' | 'accountKind' | 'planId'> | null | undefined,
  role: OrgRole | null | undefined,
  capabilities: Record<string, boolean> | null,
  inSandbox: boolean,
): string | null {
  return !inSandbox && org && isStandaloneCoachOwner(org, role, capabilities)
    ? getBillingHref(org, { host: 'coach', purpose: 'return' }) : null;
}

export type CoachTournamentOrg = EntitlementOrg & Pick<Organization, 'slug' | 'accountKind'>;

/** Tournaments you run is independent of team and season assignments.
 * The demo hides this door by name, even if its viewer later gains the tournament grant. */
export function coachHostedTournamentsLink(
  org: CoachTournamentOrg | null | undefined,
  role: OrgRole | null | undefined,
  capabilities: Record<string, boolean> | null,
  inSandbox: boolean,
): string | null {
  return !inSandbox && org && isTeamWorkspaceOrg(org)
    && hasModuleEntitlement(org, 'module_tournaments')
    && !!role && hasCapability(role, capabilities, TOURNAMENT_GRANT_KEY)
    ? `/${org.slug}/admin/tournaments/manage` : null;
}
