import { supabaseAdmin } from './supabase-admin';
import { createClient } from './supabase-server';
import { isPlatformAdminEmail } from './platform-auth';
import { isTeamWorkspaceOrg } from './team-workspace-entitlements';
import type { OrgAccountKind, OrgPlan } from './types';

export type OrgRelation = {
  id?: string;
  slug?: string;
  name?: string | null;
  plan_id?: OrgPlan;
  enabled_addons?: string[] | null;
  account_kind?: OrgAccountKind | null;
  team_workspace_status?: string | null;
  onboarding_completed_at?: string | null;
} | null;

export type MemberRow = {
  organization_id: string;
  role: string;
  organizations: OrgRelation | OrgRelation[] | null;
};

function isMissingStartupTasksColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === '42703' || error.code === 'PGRST204' || message.includes('startup_tasks');
}

function hasSkippedTournamentSetup(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const task = (value as Record<string, { status?: unknown }>).tournament;
  return task?.status === 'skipped';
}

async function hasNonArchivedTournament(orgId: string) {
  const { data } = await supabaseAdmin
    .from('tournaments')
    .select('id')
    .eq('org_id', orgId)
    .neq('status', 'archived')
    .limit(1)
    .maybeSingle();

  return !!data;
}

async function hasSkippedFirstTournamentWizard(orgId: string) {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('startup_tasks')
    .eq('id', orgId)
    .single();

  if (isMissingStartupTasksColumn(error)) return false;
  if (error) return false;
  return hasSkippedTournamentSetup(data?.startup_tasks);
}

/**
 * Returns true when the user has explicitly selected a plan during onboarding.
 * Paid plans (tournament_plus and above) are always considered explicitly chosen
 * because they went through Stripe checkout. For the free tournament plan, we
 * require startup_tasks.plan === 'complete', which is written when the user
 * clicks a plan CTA on the ?choosePlan=1 full-page chooser.
 */
async function hasExplicitPlanChoice(orgId: string, planId: OrgPlan): Promise<boolean> {
  if (planId !== 'tournament') return true;

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('startup_tasks')
    .eq('id', orgId)
    .single();

  if (isMissingStartupTasksColumn(error)) return false;
  if (error) return false;
  const tasks = data?.startup_tasks;
  if (!tasks || typeof tasks !== 'object' || Array.isArray(tasks)) return false;
  return (tasks as Record<string, { status?: unknown }>).plan?.status === 'complete';
}

/** Compute the post-login destination for a single active org membership. */
export async function getDestinationForMembership(member: MemberRow): Promise<string> {
  const orgRelation = member.organizations;
  const org = Array.isArray(orgRelation) ? orgRelation[0] : orgRelation;
  const slug = Array.isArray(orgRelation) ? orgRelation[0]?.slug : orgRelation?.slug;

  if (!slug) return '/auth/signup';

  const orgId = org?.id ?? member.organization_id;
  const planId = org?.plan_id;
  const accountKind = org?.account_kind ?? 'organization';
  const role = member.role;

  if (role === 'official') {
    return `/${slug}/scorekeeper`;
  }

  if (isTeamWorkspaceOrg({ accountKind, planId: planId ?? 'tournament' })) {
    return `/${slug}/coaches`;
  }

  const enabledAddons = org?.enabled_addons ?? [];
  const onboardingCompletedAt = org?.onboarding_completed_at ?? null;
  const hasOnlyTournamentWorkspace =
    (planId === 'tournament' || planId === 'tournament_plus') &&
    !enabledAddons.some(addon => [
      'module_public_site',
      'module_accounting',
      'module_house_league',
      'module_rep_teams',
    ].includes(addon));

  if (orgId && hasOnlyTournamentWorkspace) {
    if (await hasNonArchivedTournament(orgId)) {
      return `/${slug}/admin/tournaments/dashboard`;
    }

    if (await hasSkippedFirstTournamentWizard(orgId)) {
      return `/${slug}/admin/tournaments`;
    }

    // Returning user: onboarding was previously completed but all tournaments
    // were archived. Go to tournament management, not the first-run wizard.
    if (onboardingCompletedAt) {
      return `/${slug}/admin/tournaments`;
    }

    // Route to the required full-page plan chooser until the user has explicitly
    // selected a plan. Once chosen, use the resumable wizard (?continueSetup=1).
    const planChosen = await hasExplicitPlanChoice(orgId, planId ?? 'tournament');
    return planChosen
      ? `/${slug}/admin/onboarding?continueSetup=1`
      : `/${slug}/admin/onboarding?choosePlan=1`;
  }

  return `/${slug}/admin`;
}

export async function getAuthDestination() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return '/auth/login';
  }

  if (await isPlatformAdminEmail(user.email)) {
    return '/platform-admin';
  }

  const { data: members } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, role, organizations(id, slug, plan_id, enabled_addons, account_kind, team_workspace_status, onboarding_completed_at)')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (!members || members.length === 0) {
    return '/auth/signup';
  }

  if (members.length > 1) {
    return '/auth/select-org';
  }

  return getDestinationForMembership(members[0] as MemberRow);
}
