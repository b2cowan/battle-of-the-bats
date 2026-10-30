import 'server-only';
import type { Organization } from './types';
import { isTeamWorkspaceOrg } from './team-workspace-kind';
import { getTeamWorkspaceForRepTeam } from './team-workspace-entitlements';
import { supabaseAdmin } from './supabase-admin';
import { isOrgBillingSuspended } from './org-billing-access';
import { getOrganizationBySlug } from './db';
import { PAYING_STATUSES } from './stripe-billing-state';

// Same paid-by-club modes as the Support console (portal-free-time-tab).
const CLUB_BILLED_MODES = new Set(['club_included', 'org_team_addon', 'club_extra_team']);

/** Resolve the payer, never a billing permission. Call only after authenticating this team's coach.
 * Native club teams are entitled by their org. A linked workspace keeps its own org/owner, but
 * billing_owner_org_id identifies the club that pays. A visibility link alone proves nothing.
 */
export async function getTeamPlanCoveragePayer(org: Organization, teamId: string): Promise<{
  orgId: string;
  clubName: string;
} | null> {
  if (isOrgBillingSuspended(org)) return null;
  if (!isTeamWorkspaceOrg(org)) return { orgId: org.id, clubName: org.name };

  const workspace = await getTeamWorkspaceForRepTeam(teamId);
  if (!workspace || workspace.workspaceOrgId !== org.id
    || workspace.workspaceState === 'archived' || workspace.workspaceState === 'org_owned'
    || !CLUB_BILLED_MODES.has(workspace.billingMode)
    || !workspace.billingOwnerOrgId || workspace.billingOwnerOrgId === org.id
    || !PAYING_STATUSES.has(workspace.subscriptionStatus ?? '')) return null;

  const { data: payerRef, error } = await supabaseAdmin.from('organizations')
    .select('slug')
    .eq('id', workspace.billingOwnerOrgId)
    .maybeSingle();
  if (error) throw error;
  // The shared reader applies the entitlement door (including staff overrides); no raw plan/status read here.
  const payer = payerRef ? await getOrganizationBySlug(payerRef.slug) : null;
  if (!payer || !payer.name || isTeamWorkspaceOrg(payer) || isOrgBillingSuspended(payer)) return null;
  return { orgId: payer.id, clubName: payer.name };
}

/** An owner/admin of the PAYING club is not a covered coach (owner ruling 2026-10-30).
 * A linked workspace's owner can still be covered by a different club.
 */
export async function getCoachTeamPlanCoverage(org: Organization, teamId: string, userId: string): Promise<{
  clubName: string;
} | null> {
  const payer = await getTeamPlanCoveragePayer(org, teamId);
  if (!payer) return null;
  const { data: member, error } = await supabaseAdmin.from('organization_members')
    .select('role')
    .eq('organization_id', payer.orgId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (member?.role === 'owner' || member?.role === 'admin') return null;
  return { clubName: payer.clubName };
}
