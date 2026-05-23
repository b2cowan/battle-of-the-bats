import { supabaseAdmin } from './supabase-admin';
import type { Organization } from './types';

export type TeamWorkspaceState = 'independent' | 'linked' | 'org_owned' | 'archived';
export type TeamWorkspaceBillingMode =
  | 'team_direct'
  | 'org_team_addon'
  | 'club_included'
  | 'club_extra_team'
  | 'platform_override';

export type TeamWorkspaceSource = 'direct_signup' | 'tournament_claim' | 'org_invite' | 'platform_admin';
export type TeamWorkspaceSubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid';

export type TeamEntitlementSource =
  | 'team_plan'
  | 'org_team_addon'
  | 'club_included'
  | 'club_extra_team'
  | 'platform_override';

export type TeamEntitlementStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'cancelled'
  | 'canceled'
  | 'expired';

export type TeamOrgLinkStatus =
  | 'requested'
  | 'invited'
  | 'linked'
  | 'ownership_pending'
  | 'org_owned'
  | 'declined'
  | 'revoked';

export type TeamOrgLinkType = 'visibility' | 'billing' | 'ownership';
export type TeamOrgLinkSharingLevel = 'basic' | 'roster_summary' | 'financial_summary' | 'full_org_owned';

export type TeamWorkspace = {
  id: string;
  workspaceOrgId: string;
  repTeamId: string;
  activeProgramYearId: string | null;
  primaryOwnerUserId: string | null;
  workspaceState: TeamWorkspaceState;
  billingMode: TeamWorkspaceBillingMode;
  billingOwnerOrgId: string | null;
  billingOwnerUserId: string | null;
  subscriptionStatus: TeamWorkspaceSubscriptionStatus | null;
  source: TeamWorkspaceSource;
  sourceTournamentId: string | null;
  sourceTournamentTeamId: string | null;
};

export type TeamEntitlement = {
  id: string;
  teamWorkspaceId: string | null;
  orgId: string;
  repTeamId: string;
  source: TeamEntitlementSource;
  status: TeamEntitlementStatus;
  startsAt: string;
  endsAt: string | null;
  stripeSubscriptionItemId: string | null;
};

export type TeamScopedAccessResult =
  | { allowed: true; entitlement: TeamEntitlement }
  | { allowed: false; reason: 'team_not_found' | 'no_team_entitlement' | 'not_team_coach' };

const ACTIVE_TEAM_ENTITLEMENT_STATUSES: TeamEntitlementStatus[] = ['active', 'trialing', 'past_due'];

type TeamWorkspaceRow = {
  id: string;
  workspace_org_id: string;
  rep_team_id: string;
  active_program_year_id: string | null;
  primary_owner_user_id: string | null;
  workspace_state: TeamWorkspaceState;
  billing_mode: TeamWorkspaceBillingMode;
  billing_owner_org_id: string | null;
  billing_owner_user_id: string | null;
  subscription_status: TeamWorkspaceSubscriptionStatus | null;
  source: TeamWorkspaceSource;
  source_tournament_id: string | null;
  source_tournament_team_id: string | null;
};

type TeamEntitlementRow = {
  id: string;
  team_workspace_id: string | null;
  org_id: string;
  rep_team_id: string;
  source: TeamEntitlementSource;
  status: TeamEntitlementStatus;
  starts_at: string;
  ends_at: string | null;
  stripe_subscription_item_id: string | null;
};

function mapTeamWorkspace(row: TeamWorkspaceRow): TeamWorkspace {
  return {
    id: row.id,
    workspaceOrgId: row.workspace_org_id,
    repTeamId: row.rep_team_id,
    activeProgramYearId: row.active_program_year_id ?? null,
    primaryOwnerUserId: row.primary_owner_user_id ?? null,
    workspaceState: row.workspace_state,
    billingMode: row.billing_mode,
    billingOwnerOrgId: row.billing_owner_org_id ?? null,
    billingOwnerUserId: row.billing_owner_user_id ?? null,
    subscriptionStatus: row.subscription_status ?? null,
    source: row.source,
    sourceTournamentId: row.source_tournament_id ?? null,
    sourceTournamentTeamId: row.source_tournament_team_id ?? null,
  };
}

function mapTeamEntitlement(row: TeamEntitlementRow): TeamEntitlement {
  return {
    id: row.id,
    teamWorkspaceId: row.team_workspace_id ?? null,
    orgId: row.org_id,
    repTeamId: row.rep_team_id,
    source: row.source,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? null,
    stripeSubscriptionItemId: row.stripe_subscription_item_id ?? null,
  };
}

export function isTeamWorkspaceOrg(org: Pick<Organization, 'accountKind' | 'planId'> | null | undefined): boolean {
  return org?.accountKind === 'team_workspace' || org?.planId === 'team';
}

export function hasTeamFreeTournamentSlot(org: Pick<Organization, 'planId' | 'subscriptionStatus'> | null | undefined): boolean {
  return org?.planId === 'team' && org.subscriptionStatus !== 'canceled';
}

export function shouldShowClubValueNudge(activePaidTeamCount: number): boolean {
  return activePaidTeamCount >= 3;
}

export async function getTeamWorkspaceForOrg(orgId: string): Promise<TeamWorkspace | null> {
  const { data, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('*')
    .eq('workspace_org_id', orgId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapTeamWorkspace(data as TeamWorkspaceRow) : null;
}

export async function getTeamWorkspaceForRepTeam(repTeamId: string): Promise<TeamWorkspace | null> {
  const { data, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('*')
    .eq('rep_team_id', repTeamId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapTeamWorkspace(data as TeamWorkspaceRow) : null;
}

export async function getActiveTeamEntitlement(orgId: string, repTeamId: string): Promise<TeamEntitlement | null> {
  const { data, error } = await supabaseAdmin
    .from('team_entitlements')
    .select('*')
    .eq('org_id', orgId)
    .eq('rep_team_id', repTeamId)
    .in('status', ACTIVE_TEAM_ENTITLEMENT_STATUSES)
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapTeamEntitlement(data as TeamEntitlementRow) : null;
}

export async function getActiveTeamEntitlementsForOrg(orgId: string): Promise<TeamEntitlement[]> {
  const { data, error } = await supabaseAdmin
    .from('team_entitlements')
    .select('*')
    .eq('org_id', orgId)
    .in('status', ACTIVE_TEAM_ENTITLEMENT_STATUSES)
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .order('starts_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(row => mapTeamEntitlement(row as TeamEntitlementRow));
}

export async function getActiveTeamEntitledRepTeamIds(orgId: string): Promise<Set<string>> {
  const entitlements = await getActiveTeamEntitlementsForOrg(orgId);
  return new Set(entitlements.map(entitlement => entitlement.repTeamId));
}

export async function hasTeamScopedRepTeamEntitlement(orgId: string, repTeamId: string): Promise<boolean> {
  return Boolean(await getActiveTeamEntitlement(orgId, repTeamId));
}

export async function getTeamScopedRepTeamAccess(params: {
  orgId: string;
  repTeamId: string;
  userId?: string | null;
  requireCoach?: boolean;
}): Promise<TeamScopedAccessResult> {
  const { data: team, error: teamError } = await supabaseAdmin
    .from('rep_teams')
    .select('id, org_id')
    .eq('id', params.repTeamId)
    .maybeSingle();

  if (teamError) throw teamError;
  if (!team || team.org_id !== params.orgId) return { allowed: false, reason: 'team_not_found' };

  const entitlement = await getActiveTeamEntitlement(params.orgId, params.repTeamId);
  if (!entitlement) return { allowed: false, reason: 'no_team_entitlement' };

  if (params.requireCoach) {
    if (!params.userId) return { allowed: false, reason: 'not_team_coach' };

    const { data: coaches, error: coachError } = await supabaseAdmin
      .from('rep_team_coaches')
      .select('id, org_id, rep_program_years!program_year_id(status)')
      .eq('org_id', params.orgId)
      .eq('team_id', params.repTeamId)
      .eq('user_id', params.userId);

    if (coachError) throw coachError;
    const hasCurrentAssignment = (coaches ?? []).some(row => {
      const programYear = Array.isArray(row.rep_program_years)
        ? row.rep_program_years[0]
        : row.rep_program_years;
      return programYear?.status === 'draft' || programYear?.status === 'active';
    });
    if (!hasCurrentAssignment) return { allowed: false, reason: 'not_team_coach' };
  }

  return { allowed: true, entitlement };
}
