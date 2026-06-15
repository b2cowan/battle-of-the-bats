import { getCoachingAssignmentsForUser, type CoachingAssignment } from './db';
import { supabaseAdmin } from './supabase-admin';
import { getBasicCoachTournamentSummary, countClaimableRegistrationsForUser } from './basic-coach-teams';
import { COACHES_HOME_PATH, COACHES_TOURNAMENTS_PATH, coachTeamPath } from './coaches-portal-routes';
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
  free_floor?: string | null;
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
  /** Per-team info so a bare (no-tournament) team resolves to its org-less home. */
  teams?: { id: string; name: string; registrationCount: number }[];
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
  league: 'League Plus',
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
    .select('id, organization_id, role, organizations(id, slug, name, plan_id, subscription_status, enabled_addons, account_kind, team_workspace_status, onboarding_completed_at, free_floor)')
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
    // A free League Starter floor sits on a tournament plan — label the /home card as the floor it
    // actually is, not "Tournament subscription".
    detail: org?.free_floor === 'league_starter' ? 'Free League' : `${formatPlan(planId)} subscription`,
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

  const hasAnyRegistration = (summary.registrationCount ?? 0) > 0;
  const teams = summary.teams ?? [];

  // A coach whose teams have no tournament registration should land on a real team
  // home, not the empty tournament-records archive. One bare team → that team's
  // org-less home; multiple bare teams → the portal hub which lists them.
  if (!hasAnyRegistration) {
    const teamLabel = summary.teamCount === 1 ? '1 team' : `${summary.teamCount} teams`;
    const destination = teams.length === 1 ? coachTeamPath(teams[0].id) : COACHES_HOME_PATH;
    return {
      id: 'coaches-basic:teams',
      kind: 'coaches_basic',
      title: teams.length === 1 ? teams[0].name : 'Your teams',
      subtitle: 'Coaches Portal',
      detail: teams.length === 1 ? 'Team home' : teamLabel,
      badgeLabel: 'Coach',
      destination,
      sortOrder: 40,
    };
  }

  const tournamentLabel = summary.tournamentCount === 1 ? '1 tournament' : `${summary.tournamentCount} tournaments`;
  const teamLabel = summary.teamCount === 1 ? '1 team' : `${summary.teamCount} teams`;

  return {
    id: 'coaches-basic:tournament-records',
    kind: 'coaches_basic',
    title: 'Coaches Portal',
    subtitle: 'Tournament records',
    detail: `${teamLabel} across ${tournamentLabel}`,
    badgeLabel: 'Coach',
    destination: COACHES_TOURNAMENTS_PATH,
    sortOrder: 40,
  };
}

/**
 * A coach with no linked teams/registrations but with admin-added / imported registrations
 * waiting to be claimed by email. Routes them to the portal hub (where the claim prompt
 * lives) instead of the zero-context /start front door — closing the empty-portal gap.
 */
function buildClaimableContext(claimableCount: number): UserAccessContext | null {
  if (claimableCount <= 0) return null;
  return {
    id: 'coaches-basic:claimable',
    kind: 'coaches_basic',
    title: 'Coaches Portal',
    subtitle: claimableCount === 1 ? '1 team to claim' : `${claimableCount} teams to claim`,
    detail: 'A team registered with your email is ready to claim.',
    badgeLabel: 'Coach',
    destination: COACHES_HOME_PATH,
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

  // Free League Starter floor: a house-league operator who happens to sit on a tournament plan
  // (free_floor grants module_house_league on top). Send them to their league dashboard — NOT the
  // tournament dashboard (plan_id='tournament' would otherwise route there) or the generic /admin hub.
  if (org?.free_floor === 'league_starter') {
    return `/${slug}/admin/house-league`;
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

/**
 * A user with no *active* access context may still have a pending invite
 * (`organization_members.status = 'invited'`) — e.g. an admin who was added but
 * signed in via the normal login instead of the emailed accept-invite link, so
 * their row was never flipped to 'active'. Returns the org slug to route them to
 * `/auth/accept-invite`, or null if they have no pending invite.
 *
 * NOTE: `getActiveMembershipRows` filters `.eq('status', 'active')`, so invited
 * rows are invisible to the context/destination resolver. Callers that would
 * otherwise fall through to the zero-context `/start` front door should check
 * this first so a pending invitee finishes acceptance instead of being told to
 * create a brand-new organization.
 */
export async function findInvitedMembershipSlug(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('organization_members')
    .select('organizations(slug)')
    .eq('user_id', userId)
    .eq('status', 'invited')
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const relation = (data as { organizations: OrgRelation | OrgRelation[] | null }).organizations;
  const org = Array.isArray(relation) ? relation[0] : relation;
  return org?.slug ?? null;
}

/**
 * A suspended membership for this user, if any (J10-019). `getActiveMembershipRows` filters
 * `.eq('status','active')`, so a suspended member resolves to ZERO contexts and the destination
 * resolver would otherwise route them to `/start` (org-creation) — and any layout `next` re-loops
 * them through login forever. Callers detect suspension here to route to `/auth/suspended` instead.
 * Returns the org name/slug for the suspended page's "contact your admin" message, or null.
 */
export async function findSuspendedMembershipOrg(userId: string): Promise<{ name: string | null; slug: string | null } | null> {
  const { data } = await supabaseAdmin
    .from('organization_members')
    .select('organizations(name, slug)')
    .eq('user_id', userId)
    .eq('status', 'suspended')
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const relation = (data as { organizations: OrgRelation | OrgRelation[] | null }).organizations;
  const org = Array.isArray(relation) ? relation[0] : relation;
  if (!org) return null;
  return { name: org.name ?? null, slug: org.slug ?? null };
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

  // Admin-added / CSV-imported teams have no link row, so a coach with NO context at all would
  // otherwise hit the zero-context /start front door. ONLY when the user has no context
  // whatsoever (no org membership, no coach team, no official role) do we run the email-match
  // scan to surface a claimable registration and route them to the portal hub. Org owners /
  // admins / officials (>=1 context) never pay for this scan; the /coaches hub fetches the
  // claim prompt independently, so multi-context coaches still discover claimables there.
  if (contexts.length === 0) {
    const claimableCount = await countClaimableRegistrationsForUser(user.id, user.email);
    const claimableContext = buildClaimableContext(claimableCount);
    if (claimableContext) contexts.push(claimableContext);
  }

  return contexts.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title);
  });
}
