import type { Organization } from './types';

/**
 * Is this organization a coach's own standalone Coaches Portal (a Team workspace), rather than a
 * club or league?
 *
 * ⚠ PURE ON PURPOSE, and the one definition. It lived in `lib/team-workspace-entitlements.ts`, which
 * imports the service-role database client, so a client component could not ask it and copied the
 * one-liner instead (the closed-season page did, and its copy drifted from the server's rule —
 * Club Tier S2-01). That module re-exports this one, so every existing importer keeps working.
 */
export function isTeamWorkspaceOrg(org: Pick<Organization, 'accountKind' | 'planId'> | null | undefined): boolean {
  return org?.accountKind === 'team_workspace' || org?.planId === 'team';
}
