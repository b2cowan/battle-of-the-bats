import { getCoachingAssignmentsForUser, type CoachingAssignment } from './db';
import { supabaseAdmin } from './supabase-admin';
import { getBasicCoachTournamentSummary } from './basic-coach-teams';
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
  subscription_status?: string | null;
  onboarding_completed_at?: string | null;
} | null;

export type MemberRow = {
  id?: string;
  organization_id: string;
  role: string;
  organizations: OrgRelation | OrgRelation[] | null;
};

export type UserAccessContextKind =
  | 'organization'
  | 'tournament_official'
  | 'coaches_basic'
  | 'coaches_premium';

export type UserAccessContext = {
  id: string;
  kind: UserAccessContextKind;
  title: string;
  subtitle: string;
  detail: string;
  badgeLabel: string;
  destination: string;
  sortOrder: number;
  orgId?: string;
  orgSlug?: string;
  role?: string;
  planId?: OrgPlan | string;
};

export type TournamentRegistrationSummary = {
  teamCount: number;
  registrationCount?: number;
  tournamentCount: number;
};

type ActiveMemberRow = MemberRow & {
  id: string;
  organizations: (OrgRelation & { name?: string | null }) | (OrgRelation & { name?: string | null })[] | null;
};

const MODULE_ADDONS = [
  'module_public_site',
  'module_accounting',
  'module_house_league',
  'module_rep_teams',
];

const PLAN_LABELS: Record<string, string> = {
  tournament: 'Tournament',
  tournament_plus: 'Tournament+',
  league: 'League',
  club: 'Club',
  team: 'Premium',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  staff: 'Staff',
  official: 'Scorekeeper',
  league_admin: 'League Admin',
  league_registrar: 'Registrar',
  treasurer: 'Treasurer',
  coach: 'Coach',
};

function normalizeOrg(member: MemberRow) {
  const relation = member.organizations;
  return Array.isArray(relation) ? relation[0] : relation;
}

function formatRole(role: string) {
  return ROLE_LABELS[role] ?? role;
}

function formatPlan(planId: string | undefined) {
  return PLAN_LABELS[planId ?? ''] ?? (planId ? planId.toUpperCase() : 'Workspace');
}

function isMissingStartupTasksColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === '42703' || error.code === 'PGRST204' || message.includes('startup_tasks');
}

function isActiveSubscriptionStatus(status: string | null | undefined) {
  return status === undefined || status === null || ['active', 'trialing', 'past_due'].includes(status);
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

async function getActiveMembershipRows(userId: string): Promise<ActiveMemberRow[]> {
  const { data } = await supabaseAdmin
    .from('organization_members')
    .select('id, organization_id, role, organizations(id, slug, name, plan_id, subscription_status, enabled_addons, account_kind, team_workspace_status, onboarding_completed_at)')
    .eq('user_id', userId)
    .eq('status', 'active');

  return (data ?? []) as ActiveMemberRow[];
}

function buildMembershipContext(member: ActiveMemberRow): UserAccessContext | null {
  const org = normalizeOrg(member);
  const slug = org?.slug;
  const orgId = org?.id ?? member.organization_id;
  if (!slug || !orgId) return null;

  const planId = org?.plan_id ?? 'tournament';
  const roleLabel = formatRole(member.role);
  const subscriptionIsActive = isActiveSubscriptionStatus(org?.subscription_status);

  if (member.role === 'official') {
    return {
      id: `official:${member.id}`,
      kind: 'tournament_official',
      title: org?.name ?? slug,
      subtitle: 'Tournament operations',
      detail: roleLabel,
      badgeLabel: 'Official',
      destination: `/${slug}/scorekeeper`,
      sortOrder: 30,
      orgId,
      orgSlug: slug,
      role: member.role,
      planId,
    };
  }

  const accountKind = org?.account_kind ?? 'organization';
  if (isTeamWorkspaceOrg({ accountKind, planId })) {
    if (!subscriptionIsActive) return null;
    return {
      id: `coach-premium:${orgId}`,
      kind: 'coaches_premium',
      title: org?.name ?? 'Coaches Portal',
      subtitle: 'Coaches Portal',
      detail: 'Team management',
      badgeLabel: roleLabel,
      destination: `/${slug}/coaches`,
      sortOrder: 20,
      orgId,
      orgSlug: slug,
      role: member.role,
      planId,
    };
  }

  if (member.role === 'coach') {
    if (!subscriptionIsActive) return null;
    return {
      id: `coach:${orgId}`,
      kind: 'coaches_premium',
      title: org?.name ?? 'Coaches Portal',
      subtitle: 'Coaches Portal',
      detail: roleLabel,
      badgeLabel: 'Coach',
      destination: `/${slug}/coaches`,
      sortOrder: 20,
      orgId,
      orgSlug: slug,
      role: member.role,
      planId,
    };
  }

  return {
    id: `org:${member.id}`,
    kind: 'organization',
    title: org?.name ?? slug,
    subtitle: 'Organization access',
    detail: `${formatPlan(planId)} subscription`,
    badgeLabel: roleLabel,
    destination: '',
    sortOrder: 10,
    orgId,
    orgSlug: slug,
    role: member.role,
    planId,
  };
}

function buildCoachAssignmentContext(params: {
  member: ActiveMemberRow;
  assignmentCount: number;
  firstTeamName?: string;
}): UserAccessContext | null {
  const org = normalizeOrg(params.member);
  const slug = org?.slug;
  const orgId = org?.id ?? params.member.organization_id;
  if (!slug || !orgId || params.assignmentCount === 0) return null;
  if (!isActiveSubscriptionStatus(org?.subscription_status)) return null;

  const detail = params.assignmentCount === 1 && params.firstTeamName
    ? params.firstTeamName
    : `${params.assignmentCount} team assignments`;

  return {
    id: `coach:${orgId}`,
    kind: 'coaches_premium',
    title: org?.name ?? 'Coaches Portal',
    subtitle: 'Coaches Portal',
    detail,
    badgeLabel: 'Coach',
    destination: `/${slug}/coaches`,
    sortOrder: 20,
    orgId,
    orgSlug: slug,
    role: 'coach',
    planId: org?.plan_id ?? 'tournament',
  };
}

function buildTournamentRegistrationContext(summary: TournamentRegistrationSummary): UserAccessContext | null {
  if (summary.teamCount === 0) return null;

  const tournamentLabel = summary.tournamentCount === 1 ? '1 tournament' : `${summary.tournamentCount} tournaments`;
  const teamLabel = summary.teamCount === 1 ? '1 team' : `${summary.teamCount} teams`;

  return {
    id: 'coaches-basic:tournament-records',
    kind: 'coaches_basic',
    title: 'Coaches Portal',
    subtitle: 'Tournament records',
    detail: `${teamLabel} across ${tournamentLabel}`,
    badgeLabel: 'Coach',
    destination: '/coaches/tournaments',
    sortOrder: 40,
  };
}

/** Compute the post-login destination for a single active org membership. */
export async function getDestinationForMembership(member: MemberRow): Promise<string> {
  const org = normalizeOrg(member);
  const slug = org?.slug;

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
    !enabledAddons.some(addon => MODULE_ADDONS.includes(addon));

  if (orgId && hasOnlyTournamentWorkspace) {
    if (await hasNonArchivedTournament(orgId)) {
      return `/${slug}/admin/tournaments/dashboard`;
    }

    if (await hasSkippedFirstTournamentWizard(orgId)) {
      return `/${slug}/admin/tournaments`;
    }

    if (onboardingCompletedAt) {
      return `/${slug}/admin/tournaments`;
    }

    const planChosen = await hasExplicitPlanChoice(orgId, planId ?? 'tournament');
    return planChosen
      ? `/${slug}/admin/onboarding?continueSetup=1`
      : `/${slug}/admin/onboarding?choosePlan=1`;
  }

  return `/${slug}/admin`;
}

export async function getUserAccessContexts(user: {
  id: string;
  email?: string | null;
}): Promise<UserAccessContext[]> {
  const [members, registrationSummary] = await Promise.all([
    getActiveMembershipRows(user.id),
    getBasicCoachTournamentSummary({ userId: user.id, email: user.email }),
  ]);

  const assignmentEntries = await Promise.all(
    members.map(async (member) => {
      const org = normalizeOrg(member);
      const orgId = org?.id ?? member.organization_id;
      if (!orgId) return [member.id, [] as CoachingAssignment[]] as const;
      const assignments = await getCoachingAssignmentsForUser(orgId, user.id);
      return [member.id, assignments] as const;
    })
  );
  const assignmentsByMemberId = new Map(assignmentEntries);

  const contexts: UserAccessContext[] = [];

  for (const member of members) {
    const membershipContext = buildMembershipContext(member);
    if (!membershipContext) continue;

    if (membershipContext.kind === 'organization') {
      membershipContext.destination = await getDestinationForMembership(member);
    }
    contexts.push(membershipContext);

    if (membershipContext.kind !== 'organization') continue;

    const assignments = assignmentsByMemberId.get(member.id) ?? [];
    const coachContext = buildCoachAssignmentContext({
      member,
      assignmentCount: assignments.length,
      firstTeamName: assignments[0]?.teamName,
    });
    if (coachContext) contexts.push(coachContext);
  }

  const tournamentContext = buildTournamentRegistrationContext(registrationSummary);
  if (tournamentContext) contexts.push(tournamentContext);

  return contexts.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title);
  });
}
