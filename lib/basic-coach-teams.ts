import { supabaseAdmin } from './supabase-admin';

export type BasicCoachTeam = {
  id: string;
  name: string;
  primaryCoachName: string | null;
  primaryCoachEmail: string;
  sport: string | null;
  ageGroup: string | null;
  teamWorkspaceId: string | null;
  createdAt: string;
};

export type BasicCoachTeamRegistration = {
  id: string;
  name: string;
  coach: string | null;
  email: string | null;
  status: string;
  registeredAt: string;
  tournamentId: string | null;
  divisionId: string | null;
  basicCoachTeamId: string | null;
  accessSource: 'explicit';
};

export type BasicCoachTournamentTeam = BasicCoachTeam & {
  registrations: BasicCoachTeamRegistration[];
};

export type BasicCoachTournamentHistoryEntry = {
  registration: BasicCoachTeamRegistration;
  tournament: {
    id: string;
    name: string;
    slug: string | null;
    year: number | null;
    startDate: string | null;
    endDate: string | null;
    status: string;
  } | null;
  org: {
    id: string;
    slug: string;
    name: string;
  } | null;
};

export type PendingTournamentRegistration = {
  id: string;
  name: string;
  coach: string | null;
  email: string | null;
  tournamentId: string | null;
};

type BasicCoachTeamRow = {
  id: string;
  name: string;
  primary_coach_name: string | null;
  primary_coach_email: string;
  sport: string | null;
  age_group: string | null;
  team_workspace_id: string | null;
  created_at: string;
};

type TournamentTeamRow = {
  id: string;
  name: string;
  coach: string | null;
  email: string | null;
  status: string;
  registered_at: string;
  tournament_id: string | null;
  division_id: string | null;
};

type RegistrationLinkRow = {
  basic_coach_team_id: string;
  tournament_team_id: string;
};

type TournamentRow = {
  id: string;
  name: string;
  slug: string | null;
  year: number | null;
  start_date: string | null;
  end_date: string | null;
  org_id: string | null;
  status: string;
};

type OrgRow = {
  id: string;
  slug: string;
  name: string;
};

function normalizeEmail(email: string | null | undefined) {
  return (email ?? '').trim().toLowerCase();
}

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function mapBasicCoachTeam(row: BasicCoachTeamRow): BasicCoachTeam {
  return {
    id: row.id,
    name: row.name,
    primaryCoachName: row.primary_coach_name,
    primaryCoachEmail: row.primary_coach_email,
    sport: row.sport,
    ageGroup: row.age_group,
    teamWorkspaceId: row.team_workspace_id,
    createdAt: row.created_at,
  };
}

function mapRegistration(
  row: TournamentTeamRow,
  basicCoachTeamId: string | null,
  accessSource: BasicCoachTeamRegistration['accessSource'],
): BasicCoachTeamRegistration {
  return {
    id: row.id,
    name: row.name,
    coach: row.coach,
    email: row.email,
    status: row.status,
    registeredAt: row.registered_at,
    tournamentId: row.tournament_id,
    divisionId: row.division_id,
    basicCoachTeamId,
    accessSource,
  };
}

async function getAuthUserEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) throw error;
  return data.user?.email ?? null;
}

export async function getBasicCoachTeamsForUser(userId: string): Promise<BasicCoachTeam[]> {
  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('basic_coach_team_users')
    .select('basic_coach_team_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (membershipError) throw membershipError;

  const teamIds = [...new Set((memberships ?? []).map(row => row.basic_coach_team_id).filter(Boolean))];
  if (teamIds.length === 0) return [];

  const { data: teams, error: teamsError } = await supabaseAdmin
    .from('basic_coach_teams')
    .select('id, name, primary_coach_name, primary_coach_email, sport, age_group, team_workspace_id, created_at')
    .in('id', teamIds)
    .order('created_at', { ascending: true });

  if (teamsError) throw teamsError;
  return ((teams ?? []) as BasicCoachTeamRow[]).map(mapBasicCoachTeam);
}

export async function userOwnsBasicCoachTeam(userId: string, basicCoachTeamId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_users')
    .select('id')
    .eq('user_id', userId)
    .eq('basic_coach_team_id', basicCoachTeamId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

/**
 * Resolve a single org-less Basic coach team for the signed-in coach, ownership-checked
 * via `basic_coach_team_users`. Returns null when the team does not exist or the user is
 * not an active member — the org-less team-profile route (`/coaches/team/[basicTeamId]`)
 * uses this as its access gate (the standalone-floor analogue of
 * `canUserAccessTournamentRegistration`, which is keyed on a tournament registration).
 */
export async function getBasicCoachTeamForUser(params: {
  userId: string;
  basicCoachTeamId: string;
}): Promise<BasicCoachTeam | null> {
  if (!(await userOwnsBasicCoachTeam(params.userId, params.basicCoachTeamId))) return null;

  const { data, error } = await supabaseAdmin
    .from('basic_coach_teams')
    .select('id, name, primary_coach_name, primary_coach_email, sport, age_group, team_workspace_id, created_at')
    .eq('id', params.basicCoachTeamId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapBasicCoachTeam(data as BasicCoachTeamRow) : null;
}

export async function getPendingTournamentRegistrationForUser(
  userId: string,
  userEmail: string | null | undefined,
  registrationId: string,
): Promise<PendingTournamentRegistration | null> {
  const email = normalizeEmail(userEmail) || normalizeEmail(await getAuthUserEmail(userId));
  if (!email) return null;

  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('id, name, coach, email, tournament_id')
    .eq('id', registrationId)
    .maybeSingle();

  if (error) throw error;
  if (!data || normalizeEmail(data.email) !== email) return null;

  return {
    id: data.id,
    name: data.name,
    coach: data.coach,
    email: data.email,
    tournamentId: data.tournament_id,
  };
}

async function findLinkedBasicTeamForRegistration(
  userId: string,
  registrationId: string,
): Promise<string | null> {
  const { data: link, error } = await supabaseAdmin
    .from('basic_coach_team_registrations')
    .select('basic_coach_team_id')
    .eq('tournament_team_id', registrationId)
    .maybeSingle<{ basic_coach_team_id: string }>();

  if (error) throw error;
  if (!link?.basic_coach_team_id) return null;
  return await userOwnsBasicCoachTeam(userId, link.basic_coach_team_id)
    ? link.basic_coach_team_id
    : null;
}

async function createBasicCoachTeamForRegistration(
  userId: string,
  userEmail: string,
  registration: PendingTournamentRegistration,
): Promise<string> {
  const now = new Date().toISOString();
  const { data: team, error: teamError } = await supabaseAdmin
    .from('basic_coach_teams')
    .insert({
      name: registration.name,
      normalized_name: normalizeName(registration.name),
      primary_coach_name: registration.coach,
      primary_coach_email: userEmail,
      source: 'tournament_registration',
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single<{ id: string }>();

  if (teamError) throw teamError;

  const { error: membershipError } = await supabaseAdmin
    .from('basic_coach_team_users')
    .insert({
      basic_coach_team_id: team.id,
      user_id: userId,
      role: 'owner',
      status: 'active',
    });

  if (membershipError) throw membershipError;
  return team.id;
}

/**
 * Create a standalone, org-less Basic coach team with NO tournament registration
 * attached — the Phase-2 `/start/team` on-ramp. This is the deliberate new entry
 * path (source `coach_created`), distinct from `createBasicCoachTeamForRegistration`
 * (source `tournament_registration`) which only fires inside the registration-link
 * flow. The free Basic floor — NOT the Premium `team_workspaces` flip — so
 * `team_workspace_id` stays null. The caller resolves the signed-in user/email and
 * must have already gated out platform-admin sessions (see `requireCoachUser`).
 */
export async function createBasicCoachTeam(params: {
  userId: string;
  email: string;
  name: string;
  primaryCoachName?: string | null;
  sport?: string | null;
  ageGroup?: string | null;
}): Promise<string> {
  const name = params.name.trim();
  if (!name) throw new Error('A team name is required.');

  const email = normalizeEmail(params.email);
  if (!email) throw new Error('A signed-in coach email is required.');

  const now = new Date().toISOString();
  const { data: team, error: teamError } = await supabaseAdmin
    .from('basic_coach_teams')
    .insert({
      name,
      normalized_name: normalizeName(name),
      primary_coach_name: params.primaryCoachName?.trim() || null,
      primary_coach_email: email,
      sport: params.sport?.trim() || null,
      age_group: params.ageGroup?.trim() || null,
      source: 'coach_created',
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single<{ id: string }>();

  if (teamError) throw teamError;

  const { error: membershipError } = await supabaseAdmin
    .from('basic_coach_team_users')
    .insert({
      basic_coach_team_id: team.id,
      user_id: params.userId,
      role: 'owner',
      status: 'active',
    });

  if (membershipError) throw membershipError;
  return team.id;
}

export async function linkTournamentRegistrationToBasicCoachTeam(params: {
  userId: string;
  userEmail?: string | null;
  registrationId: string;
  basicCoachTeamId?: string | null;
  linkSource?: 'explicit' | 'registration_flow' | 'backfill';
}): Promise<{ basicCoachTeamId: string; createdTeam: boolean }> {
  const email = normalizeEmail(params.userEmail) || normalizeEmail(await getAuthUserEmail(params.userId));
  if (!email) throw new Error('A signed-in coach email is required.');

  const registration = await getPendingTournamentRegistrationForUser(
    params.userId,
    email,
    params.registrationId,
  );
  if (!registration) throw new Error('This registration is not linked to your signed-in email.');

  const existingBasicTeamId = await findLinkedBasicTeamForRegistration(params.userId, params.registrationId);
  if (existingBasicTeamId) {
    return { basicCoachTeamId: existingBasicTeamId, createdTeam: false };
  }

  let basicCoachTeamId = params.basicCoachTeamId ?? null;
  let createdTeam = false;

  if (basicCoachTeamId) {
    if (!(await userOwnsBasicCoachTeam(params.userId, basicCoachTeamId))) {
      throw new Error('That team is not linked to your coach account.');
    }
  } else {
    basicCoachTeamId = await createBasicCoachTeamForRegistration(params.userId, email, registration);
    createdTeam = true;
  }

  const { error: linkError } = await supabaseAdmin
    .from('basic_coach_team_registrations')
    .insert({
      basic_coach_team_id: basicCoachTeamId,
      tournament_team_id: params.registrationId,
      linked_by_user_id: params.userId,
      link_source: params.linkSource ?? 'registration_flow',
    });

  if (linkError) throw linkError;

  return { basicCoachTeamId, createdTeam };
}

export async function getBasicCoachTournamentTeamsForUser(params: {
  userId: string;
  email?: string | null;
}): Promise<BasicCoachTournamentTeam[]> {
  const basicTeams = await getBasicCoachTeamsForUser(params.userId);
  const basicTeamIds = basicTeams.map(team => team.id);

  const linkRows = basicTeamIds.length > 0
    ? await supabaseAdmin
        .from('basic_coach_team_registrations')
        .select('basic_coach_team_id, tournament_team_id')
        .in('basic_coach_team_id', basicTeamIds)
    : { data: [], error: null };

  if (linkRows.error) throw linkRows.error;

  const links = (linkRows.data ?? []) as RegistrationLinkRow[];
  const explicitRegistrationIds = [...new Set(links.map(link => link.tournament_team_id))];
  const linkByRegistrationId = new Map(links.map(link => [link.tournament_team_id, link.basic_coach_team_id]));

  const explicitRegistrations = explicitRegistrationIds.length > 0
    ? await supabaseAdmin
        .from('teams')
        .select('id, name, coach, email, status, registered_at, tournament_id, division_id')
        .in('id', explicitRegistrationIds)
    : { data: [], error: null };

  if (explicitRegistrations.error) throw explicitRegistrations.error;

  const registrationsByBasicTeamId = new Map<string, BasicCoachTeamRegistration[]>();
  for (const row of (explicitRegistrations.data ?? []) as TournamentTeamRow[]) {
    const basicCoachTeamId = linkByRegistrationId.get(row.id) ?? null;
    if (!basicCoachTeamId) continue;
    const registrations = registrationsByBasicTeamId.get(basicCoachTeamId) ?? [];
    registrations.push(mapRegistration(row, basicCoachTeamId, 'explicit'));
    registrationsByBasicTeamId.set(basicCoachTeamId, registrations);
  }

  const teams = basicTeams.map(team => ({
    ...team,
    registrations: registrationsByBasicTeamId.get(team.id) ?? [],
  }));

  return teams.map(team => ({
    ...team,
    registrations: team.registrations.sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)),
  }));
}

export async function getBasicCoachTournamentHistoryForTeam(
  basicCoachTeamId: string,
): Promise<BasicCoachTournamentHistoryEntry[]> {
  const { data: links, error: linkError } = await supabaseAdmin
    .from('basic_coach_team_registrations')
    .select('tournament_team_id')
    .eq('basic_coach_team_id', basicCoachTeamId);

  if (linkError) throw linkError;

  const registrationIds = [...new Set((links ?? []).map(link => link.tournament_team_id).filter(Boolean))];
  if (registrationIds.length === 0) return [];

  const { data: registrations, error: registrationError } = await supabaseAdmin
    .from('teams')
    .select('id, name, coach, email, status, registered_at, tournament_id, division_id')
    .in('id', registrationIds);

  if (registrationError) throw registrationError;

  const tournamentIds = [...new Set(((registrations ?? []) as TournamentTeamRow[])
    .map(row => row.tournament_id)
    .filter(Boolean))] as string[];

  const { data: tournaments, error: tournamentError } = tournamentIds.length > 0
    ? await supabaseAdmin
        .from('tournaments')
        .select('id, name, slug, year, start_date, end_date, org_id, status')
        .in('id', tournamentIds)
    : { data: [], error: null };

  if (tournamentError) throw tournamentError;

  const tournamentRows = (tournaments ?? []) as TournamentRow[];
  const tournamentMap = new Map(tournamentRows.map(tournament => [tournament.id, tournament]));

  const orgIds = [...new Set(tournamentRows.map(tournament => tournament.org_id).filter(Boolean))] as string[];
  const { data: orgs, error: orgError } = orgIds.length > 0
    ? await supabaseAdmin
        .from('organizations')
        .select('id, slug, name')
        .in('id', orgIds)
    : { data: [], error: null };

  if (orgError) throw orgError;

  const orgMap = new Map(((orgs ?? []) as OrgRow[]).map(org => [org.id, org]));

  return ((registrations ?? []) as TournamentTeamRow[])
    .map(row => {
      const registration = mapRegistration(row, basicCoachTeamId, 'explicit');
      const tournament = row.tournament_id ? tournamentMap.get(row.tournament_id) ?? null : null;
      const org = tournament?.org_id ? orgMap.get(tournament.org_id) ?? null : null;

      return {
        registration,
        tournament: tournament
          ? {
              id: tournament.id,
              name: tournament.name,
              slug: tournament.slug,
              year: tournament.year,
              startDate: tournament.start_date,
              endDate: tournament.end_date,
              status: tournament.status,
            }
          : null,
        org: org
          ? {
              id: org.id,
              slug: org.slug,
              name: org.name,
            }
          : null,
      };
    })
    .sort((a, b) => b.registration.registeredAt.localeCompare(a.registration.registeredAt));
}

export async function getBasicCoachTournamentSummary(params: {
  userId: string;
  email?: string | null;
}) {
  const teams = await getBasicCoachTournamentTeamsForUser(params);
  const registrationIds = new Set<string>();
  const tournamentIds = new Set<string>();

  for (const team of teams) {
    for (const registration of team.registrations) {
      registrationIds.add(registration.id);
      if (registration.tournamentId) tournamentIds.add(registration.tournamentId);
    }
  }

  return {
    teamCount: teams.length,
    registrationCount: registrationIds.size,
    tournamentCount: tournamentIds.size,
    // Per-team shape lets the access-context resolver route a bare (no-tournament)
    // team to its org-less home instead of the empty tournament-records archive.
    teams: teams.map(team => ({
      id: team.id,
      name: team.name,
      registrationCount: team.registrations.length,
    })),
  };
}

export async function canUserAccessTournamentRegistration(params: {
  userId: string;
  email?: string | null;
  registrationId: string;
}): Promise<'explicit' | null> {
  const ownedLink = await findLinkedBasicTeamForRegistration(params.userId, params.registrationId);
  if (ownedLink) return 'explicit';
  return null;
}

export async function findBasicCoachTeamIdForTournamentRegistration(registrationId: string | null | undefined) {
  if (!registrationId) return null;
  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_registrations')
    .select('basic_coach_team_id')
    .eq('tournament_team_id', registrationId)
    .maybeSingle<{ basic_coach_team_id: string }>();

  if (error) throw error;
  return data?.basic_coach_team_id ?? null;
}
