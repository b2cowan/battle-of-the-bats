import { supabaseAdmin } from './supabase-admin';
import { createClient } from './supabase-server';
import { isPlatformAdminEmail } from './platform-auth';
import { isTeamWorkspaceOrg } from './team-workspace-entitlements';
import type { OrgAccountKind, OrgPlan } from './types';

type OrgRelation = {
  id?: string;
  slug?: string;
  plan_id?: OrgPlan;
  enabled_addons?: string[] | null;
  account_kind?: OrgAccountKind | null;
  team_workspace_status?: string | null;
} | null;

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
    .eq('organization_id', orgId)
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

export async function getAuthDestination() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return '/auth/login';
  }

  if (await isPlatformAdminEmail(user.email)) {
    return '/platform-admin';
  }

  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, organizations(id, slug, plan_id, enabled_addons, account_kind, team_workspace_status)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  const orgRelation = (member as {
    organizations?: OrgRelation | OrgRelation[] | null;
  } | null)?.organizations;
  const slug = Array.isArray(orgRelation) ? orgRelation[0]?.slug : orgRelation?.slug;
  const org = Array.isArray(orgRelation) ? orgRelation[0] : orgRelation;
  if (slug) {
    const orgId = org?.id ?? member?.organization_id;
    const planId = org?.plan_id;
    const accountKind = org?.account_kind ?? 'organization';

    if (isTeamWorkspaceOrg({ accountKind, planId: planId ?? 'tournament' })) {
      return `/${slug}/coaches`;
    }

    const enabledAddons = org?.enabled_addons ?? [];
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

      return `/${slug}/admin/onboarding?continueSetup=1`;
    }

    return `/${slug}/admin`;
  }

  return '/auth/signup';
}
