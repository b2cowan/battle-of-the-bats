import type { Organization, OrgRole } from './types';
import { hasBillingAccess } from './roles';
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
