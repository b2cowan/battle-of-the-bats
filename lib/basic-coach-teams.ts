import { cache } from 'react';
import { supabaseAdmin } from './supabase-admin';
import { isPlatformAdminEmail } from './platform-auth';
import { deriveCoachLifecycleChip } from './coach-tournament-lifecycle';
import { buildCoachTournamentStatus } from './coach-status-model';
import { excludeActivePremiumUpgrades } from './coach-team-page';
import { tournamentNow } from './timezone';

export type BasicCoachTeam = {
  id: string;
  name: string;
  primaryCoachName: string | null;
  primaryCoachEmail: string;
  sport: string | null;
  ageGroup: string | null;
  teamWorkspaceId: string | null;
  createdAt: string;
  /** Tier-2 team-ops capabilities the coach has turned on (mig 131) — drives Coaches
   *  Portal progressive-disclosure nav visibility. Empty = tournament-only coach. */
  activatedFeatures: string[];
};

/** Rich per-team context for the team-scoped Coaches Portal shell (nav rebuild). */
export type CoachTeamContext = {
  id: string;
  name: string;
  /** Tier-2 capability keys turned on for this team (drives which sections show in the rail). */
  activatedFeatures: string[];
  /** The team's most-relevant lifecycle chip across its registrations (live > game-day >
   *  upcoming > future > complete). null when the team has no dated registrations. */
  lifecycle: { state: string; label: string; rank: number } | null;
  /** tournament-registration (`teams`) ids under this team — lets the shell resolve the
   *  current team from a `/coaches/tournaments/{registrationId}` path. */
  registrationIds: string[];
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
  /** Remaining entry fee owed to the organizer for an ACCEPTED registration (null when not
   *  accepted, or when there's no fee schedule / nothing outstanding). Reuses the canonical
   *  buildCoachTournamentStatus so it matches the amount shown on the tournament record. */
  amountDue: number | null;
};

export type PendingTournamentRegistration = {
  id: string;
  name: string;
  coach: string | null;
  email: string | null;
  tournamentId: string | null;
};

export type ClaimableRegistration = {
  id: string;
  name: string;
  coach: string | null;
  tournamentId: string | null;
  tournament: {
    id: string;
    name: string;
    slug: string | null;
    startDate: string | null;
    endDate: string | null;
    status: string;
  } | null;
  orgName: string | null;
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
  activated_features: unknown;
};

/** Coerce the JSONB `activated_features` column into a clean string[] (defensive: the
 *  column defaults to [] but legacy/hand-edited rows could hold anything). */
function parseActivatedFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

type TournamentTeamRow = {
  id: string;
  name: string;
  coach: string | null;
  email: string | null;
  status: string;
  registered_at: string;
  tournament_id: string | null;
  division_id: string | null;
  // Payment fields — only selected by the history query (optional so other callers are unaffected).
  payment_status?: string | null;
  deposit_paid?: number | null;
  total_paid?: number | null;
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
  // Fee schedule — only selected by the history query (optional so other callers are unaffected).
  fee_schedule_mode?: string | null;
  deposit_amount?: number | null;
  deposit_due_date?: string | null;
  total_fee_amount?: number | null;
  total_fee_due_date?: string | null;
};

type DivisionFeeRow = {
  id: string;
  name: string;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  total_fee_amount: number | null;
  total_fee_due_date: string | null;
};

type OrgRow = {
  id: string;
  slug: string;
  name: string;
};

/** Exact, case-insensitive email normalization (trim + lowercase). The single trust key
 *  for coach↔registration matching since Migration 092 removed ILIKE/fuzzy fallbacks —
 *  reused by the tournament-viewer rep-coach recognition (WI-2C) so there is no 3rd copy. */
export function normalizeEmail(email: string | null | undefined) {
  return (email ?? '').trim().toLowerCase();
}

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function cleanText(value: string | null | undefined, maxLength: number): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed.slice(0, maxLength) : null;
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
    activatedFeatures: parseActivatedFeatures(row.activated_features),
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

/**
 * Whether a confirmed auth account already exists for the given (already-normalized) email.
 * Internal — callers MUST scope the email to something the caller already proved they hold
 * (e.g. a tournament registration id) so this never becomes a public email-enumeration oracle.
 */
async function authAccountExistsForEmail(email: string): Promise<boolean> {
  const target = normalizeEmail(email);
  if (!target) return false;
  // No admin getUserByEmail in this SDK version — list + filter (same pattern as team-org-links).
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return (data.users ?? []).some(u => normalizeEmail(u.email) === target);
}

/**
 * Signed-out-safe resolver for the /coaches/join landing: given a tournament registration id and
 * the email the email-link asserts, return whether that registration's coach ALREADY has an
 * account (so the page can offer "sign in" instead of a redundant "create account" form after the
 * merged register+account flow). Security: the existence check is keyed on the registration's OWN
 * stored email, and we only answer when the supplied email matches it — so this cannot probe
 * arbitrary addresses (the caller must hold a real registrationId whose email they already know).
 * Returns `null` when the registration/email don't line up (treated as "show the normal form").
 */
export async function getRegistrationAccountStatus(params: {
  registrationId: string;
  email: string;
}): Promise<{ accountExists: boolean; teamName: string; email: string } | null> {
  const registrationId = (params.registrationId ?? '').trim();
  const suppliedEmail = normalizeEmail(params.email);
  if (!registrationId || !suppliedEmail) return null;

  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('id, name, email')
    .eq('id', registrationId)
    .maybeSingle();
  if (error) throw error;
  // Only answer when the link's email matches the registration's own email — no enumeration.
  if (!data || normalizeEmail(data.email) !== suppliedEmail) return null;

  const accountExists = await authAccountExistsForEmail(suppliedEmail);
  return { accountExists, teamName: data.name, email: suppliedEmail };
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
    .select('id, name, primary_coach_name, primary_coach_email, sport, age_group, team_workspace_id, created_at, activated_features')
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
 * Count ACTIVE members of a Basic coach team (J5-012). Ownership is membership-row-only (no email
 * fallback since mig 092), so a team with zero active members is ORPHANED — its registrations are
 * otherwise invisible to claim discovery and unclaimable ("already claimed by another account").
 * Used to let a legitimate coach adopt such an orphan instead of dead-ending.
 */
export async function countActiveTeamMembers(basicCoachTeamId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('basic_coach_team_users')
    .select('id', { count: 'exact', head: true })
    .eq('basic_coach_team_id', basicCoachTeamId)
    .eq('status', 'active');
  if (error) throw error;
  return count ?? 0;
}

/**
 * Cheap existence/count of a user's ACTIVE Basic coach-team memberships (one membership row per
 * team per user, so this equals the number of free Coaches Portal teams they're on). Drives the
 * org-removal "off-org presence" safeguard (account preserved when > 0) and the removal-impact
 * warning. Head count only — does not hydrate team rows (keep the hot removal path light).
 */
export async function countActiveBasicCoachTeamMembershipsForUser(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('basic_coach_team_users')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) throw error;
  return count ?? 0;
}

/**
 * The ids of Basic coach teams a user is an active member of AND is the SOLE active member of —
 * i.e. exactly the teams that a hard account-delete would orphan (so they get deleted outright).
 * Single source of truth for "what a user-delete destroys": both `cleanupBasicCoachTeamsForUserDeletion`
 * (which deletes them) and the platform-admin pre-delete warning (which counts them) call this, so
 * the "will be deleted" set can never drift from the "is deleted" set.
 */
export async function getSoleOwnedActiveBasicCoachTeamIds(userId: string): Promise<string[]> {
  const { data: memberships, error: mErr } = await supabaseAdmin
    .from('basic_coach_team_users')
    .select('basic_coach_team_id')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (mErr) throw mErr;

  const teamIds = [...new Set((memberships ?? []).map(r => r.basic_coach_team_id as string))];
  const soleOwned: string[] = [];
  for (const teamId of teamIds) {
    if ((await countActiveTeamMembers(teamId)) <= 1) soleOwned.push(teamId);
  }
  return soleOwned;
}

/**
 * Free-coach impact of deleting a user account — for the platform-admin delete confirmation
 * (informed-consent warning). `totalTeams` = active Coaches Portal teams the user is on;
 * `soleOwnedTeams` = how many of those would be PERMANENTLY DELETED (zero remaining members),
 * carrying their roster/players/fees/history with them.
 */
export async function getBasicCoachTeamDeletionImpactForUser(
  userId: string,
): Promise<{ totalTeams: number; soleOwnedTeams: number }> {
  const [totalTeams, soleOwned] = await Promise.all([
    countActiveBasicCoachTeamMembershipsForUser(userId),
    getSoleOwnedActiveBasicCoachTeamIds(userId),
  ]);
  return { totalTeams, soleOwnedTeams: soleOwned.length };
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
    .select('id, name, primary_coach_name, primary_coach_email, sport, age_group, team_workspace_id, created_at, activated_features')
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

/**
 * The basic_coach_team id the user OWNS that is explicitly linked to this tournament registration,
 * or null. The owner-checked resolver behind `canUserAccessTournamentRegistration` — exported so
 * coach-side WRITE routes (5j roster submit, 5l head-coach) can both gate access AND obtain the
 * team id (to read the master roster) in one call. Explicit-link only (no email-match fallback).
 */
export async function findLinkedBasicTeamForRegistration(
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
  const name = cleanText(params.name, 120);
  if (!name) throw new Error('A team name is required.');

  const email = normalizeEmail(params.email);
  if (!email) throw new Error('A signed-in coach email is required.');

  const now = new Date().toISOString();
  const { data: team, error: teamError } = await supabaseAdmin
    .from('basic_coach_teams')
    .insert({
      name,
      normalized_name: normalizeName(name),
      primary_coach_name: cleanText(params.primaryCoachName, 120),
      primary_coach_email: email,
      sport: cleanText(params.sport, 80),
      age_group: cleanText(params.ageGroup, 80),
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

  // A link may already exist owned by ANOTHER account (findLinkedBasicTeamForRegistration only
  // returns OUR link). Detect that BEFORE creating anything so we return a clean "already
  // claimed" instead of a UNIQUE(tournament_team_id) violation that leaves an orphan team.
  const foreignLink = await findBasicCoachTeamIdForTournamentRegistration(params.registrationId);
  if (foreignLink) {
    // J5-012: if the linked team is ORPHANED (zero active members — e.g. a backfill team with no
    // member row, or whose only owner's account was deleted), it isn't really "claimed by another
    // account" — nobody can reach it. Let this legitimate coach ADOPT it (add themselves as active
    // owner) and reuse the existing link, instead of dead-ending. A team with a live member stays
    // protected.
    const activeMembers = await countActiveTeamMembers(foreignLink);
    if (activeMembers > 0) {
      throw new Error('This registration has already been claimed by another account.');
    }
    const { error: adoptError } = await supabaseAdmin
      .from('basic_coach_team_users')
      .insert({ basic_coach_team_id: foreignLink, user_id: params.userId, role: 'owner', status: 'active' });
    if (adoptError) {
      // A concurrent adopter won the race — re-check; if someone is now active, it's genuinely taken.
      if ((await countActiveTeamMembers(foreignLink)) > 0) {
        throw new Error('This registration has already been claimed by another account.');
      }
      throw adoptError;
    }
    return { basicCoachTeamId: foreignLink, createdTeam: false };
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

  if (linkError) {
    // A concurrent claim won the race (UNIQUE(tournament_team_id)). If we just created a team
    // for this claim, roll it back so a failed claim never leaves an orphan basic team (which
    // would otherwise render as a ghost empty team under "Your teams").
    if (createdTeam && basicCoachTeamId) {
      await supabaseAdmin.from('basic_coach_team_users').delete().eq('basic_coach_team_id', basicCoachTeamId);
      await supabaseAdmin.from('basic_coach_teams').delete().eq('id', basicCoachTeamId);
    }
    if ((linkError as { code?: string }).code === '23505') {
      throw new Error('This registration has already been claimed by another account.');
    }
    throw linkError;
  }

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

/** Request-memoized (cache(), primitive-keyed) variant of the basic-coach scan. A single Home
 *  load resolves access contexts (→ getBasicCoachTournamentSummary) AND the coached-team dedupe
 *  set (→ getCoachedRegistrationTeamIds) for the same user; routing both through this shared
 *  wrapper runs the 4-query scan once instead of twice. Both callers pass the same (userId, email)
 *  primitives so cache() dedupes. */
export const getBasicCoachTournamentTeamsForUserCached = cache(
  (userId: string, email: string | null) => getBasicCoachTournamentTeamsForUser({ userId, email }),
);

/**
 * Rich per-team context for the team-scoped Coaches Portal shell (nav rebuild). Per team:
 * its activated Tier-2 features (nav visibility), its most-relevant lifecycle chip (the rail
 * status indicator — best across the team's registrations), and its registration ids (so the
 * shell can resolve the "current team" from a `/coaches/tournaments/{registrationId}` path).
 * Reuses getBasicCoachTournamentTeamsForUser (teams + registrations + activatedFeatures) and
 * adds one tournament-dates lookup to compute the chips.
 */
export async function getCoachTeamContextsForUser(params: {
  userId: string;
  email?: string | null;
  today?: string;
}): Promise<CoachTeamContext[]> {
  const teams = await getBasicCoachTournamentTeamsForUser({ userId: params.userId, email: params.email });
  const today = params.today ?? new Date().toISOString().split('T')[0];

  // One dates lookup for every tournament referenced by any registration.
  const tournamentIds = [
    ...new Set(
      teams.flatMap(t => t.registrations.map(r => r.tournamentId).filter((id): id is string => Boolean(id))),
    ),
  ];
  const datesById = new Map<string, { start: string | null; end: string | null }>();
  if (tournamentIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('tournaments')
      .select('id, start_date, end_date')
      .in('id', tournamentIds);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ id: string; start_date: string | null; end_date: string | null }>) {
      datesById.set(row.id, { start: row.start_date, end: row.end_date });
    }
  }

  return teams.map(team => {
    // Best (lowest-rank) lifecycle chip across the team's registrations → the rail status.
    let best: { state: string; label: string; rank: number } | null = null;
    for (const reg of team.registrations) {
      const dates = reg.tournamentId ? datesById.get(reg.tournamentId) : null;
      if (!dates) continue;
      const chip = deriveCoachLifecycleChip(dates.start, dates.end, today);
      if (chip.state === 'unknown') continue;
      if (!best || chip.rank < best.rank) best = chip;
    }
    return {
      id: team.id,
      name: team.name,
      activatedFeatures: team.activatedFeatures,
      lifecycle: best,
      registrationIds: team.registrations.map(r => r.id),
    };
  });
}

/** The Tier-2 capability keys a coach can activate (mig 131 `activated_features`). */
export const ACTIVATABLE_FEATURES = ['roster', 'schedule', 'fees', 'announcements'] as const;
export type ActivatableFeature = (typeof ACTIVATABLE_FEATURES)[number];

export function isActivatableFeature(value: string): value is ActivatableFeature {
  return (ACTIVATABLE_FEATURES as readonly string[]).includes(value);
}

/**
 * Turn a Tier-2 feature on (or off) for a basic team — drives Coaches Portal nav visibility
 * (progressive disclosure). Idempotent: activating an already-active feature is a no-op.
 * Caller MUST have already verified ownership (the API guards with requireBasicCoachTeamOwner).
 * Returns the resulting activated_features set.
 */
export async function setBasicCoachTeamFeature(
  basicCoachTeamId: string,
  feature: ActivatableFeature,
  active: boolean,
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('basic_coach_teams')
    .select('activated_features')
    .eq('id', basicCoachTeamId)
    .maybeSingle();
  if (error) throw error;

  const current = parseActivatedFeatures(data?.activated_features);
  const set = new Set(current);
  if (active) set.add(feature);
  else set.delete(feature);
  const next = [...set];

  const { error: updErr } = await supabaseAdmin
    .from('basic_coach_teams')
    .update({ activated_features: next })
    .eq('id', basicCoachTeamId);
  if (updErr) throw updErr;

  return next;
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
    .select('id, name, coach, email, status, registered_at, tournament_id, division_id, payment_status, deposit_paid, total_paid')
    .in('id', registrationIds);

  if (registrationError) throw registrationError;

  const tournamentIds = [...new Set(((registrations ?? []) as TournamentTeamRow[])
    .map(row => row.tournament_id)
    .filter(Boolean))] as string[];

  const { data: tournaments, error: tournamentError } = tournamentIds.length > 0
    ? await supabaseAdmin
        .from('tournaments')
        .select('id, name, slug, year, start_date, end_date, org_id, status, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date')
        .in('id', tournamentIds)
    : { data: [], error: null };

  if (tournamentError) throw tournamentError;

  const tournamentRows = (tournaments ?? []) as TournamentRow[];
  const tournamentMap = new Map(tournamentRows.map(tournament => [tournament.id, tournament]));

  // Division-level fee schedules (a division fee overrides the tournament fee — resolved inside
  // buildCoachTournamentStatus). Only fetched for the divisions actually referenced.
  const divisionIds = [...new Set(((registrations ?? []) as TournamentTeamRow[])
    .map(row => row.division_id)
    .filter(Boolean))] as string[];
  const { data: divisions, error: divisionError } = divisionIds.length > 0
    ? await supabaseAdmin
        .from('divisions')
        .select('id, name, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date')
        .in('id', divisionIds)
    : { data: [], error: null };

  if (divisionError) throw divisionError;

  const divisionMap = new Map(((divisions ?? []) as DivisionFeeRow[]).map(d => [d.id, d]));

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
      const division = row.division_id ? divisionMap.get(row.division_id) ?? null : null;

      // Outstanding entry fee — only for accepted registrations (a pending one owes nothing yet).
      let amountDue: number | null = null;
      if (registration.status === 'accepted') {
        const status = buildCoachTournamentStatus({
          team: {
            divisionId: row.division_id,
            paymentStatus: row.payment_status ?? null,
            depositPaid: row.deposit_paid ?? null,
            totalPaid: row.total_paid ?? null,
            checkInStatus: null,
            checkedInAt: null,
            rosterSubmittedAt: null,
            rosterConfirmedAt: null,
            paymentCollectedAt: null,
          },
          tournament: tournament
            ? {
                feeMode: tournament.fee_schedule_mode ?? null,
                depositAmount: tournament.deposit_amount ?? null,
                depositDueDate: tournament.deposit_due_date ?? null,
                totalFeeAmount: tournament.total_fee_amount ?? null,
                totalFeeDueDate: tournament.total_fee_due_date ?? null,
              }
            : null,
          division: division
            ? {
                id: division.id,
                name: division.name,
                depositAmount: division.deposit_amount,
                depositDueDate: division.deposit_due_date,
                totalFeeAmount: division.total_fee_amount,
                totalFeeDueDate: division.total_fee_due_date,
              }
            : null,
        });
        amountDue = status.fee.amountDue;
      }

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
        amountDue,
      };
    })
    .sort((a, b) => b.registration.registeredAt.localeCompare(a.registration.registeredAt));
}

/** The Overview schedule tile's registration-fed game (conversion sweep C5): what the
 *  tile shows when the coach's self-entered schedule is empty but the team is in a
 *  tournament — their live game right now, else the next scheduled one. */
export type BasicCoachRegistrationGame = {
  opponentName: string;
  myScore: number | null;
  oppScore: number | null;
  isLive: boolean;
  /** "Today" or a short calendar label like "Sat, Jul 18". */
  dateLabel: string;
  /** Local start time — upcoming games only (a live game is on right now). */
  timeLabel: string | null;
  location: string | null;
  tournamentName: string;
};

// Empty-slot sentinel some games use instead of NULL for an unassigned team
// (matches the tournament record / public game page resolution).
const NIL_GAME_TEAM_UUID = '00000000-0000-0000-0000-000000000000';

/** Short calendar label for a game date ("Sat, Jul 18"); 'TBD' when unscheduled.
 *  Shared by the tournament record and the Overview tile so the two never drift. */
export function formatGameDateLabel(gameDate: string | null): string {
  return gameDate
    ? new Date(gameDate + 'T00:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'TBD';
}

/** Local start-time label ("9:00 a.m."); null when no time is set. */
export function formatGameTimeLabel(gameTime: string | null): string | null {
  return gameTime
    ? new Date(`1970-01-01T${gameTime}`).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })
    : null;
}

/**
 * Live-now (else next-scheduled) game across a team's ACCEPTED tournament registrations,
 * for the standalone Overview's schedule tile (C5). Takes the already-loaded history
 * (the page fetches it anyway); its three narrow queries (division visibility, games,
 * accepted-opponent names) run concurrently — games/names fetch for ALL accepted
 * registrations and the published-division reveal rule filters in memory. Honors the
 * same reveal rules as the tournament record: only divisions with a PUBLISHED schedule
 * surface games, and opponent names resolve only from accepted teams (else placeholder).
 * "Live" mirrors CoachLiveSchedule: a submitted score on a game dated today, in the
 * tournament timezone (never raw UTC — the J6-056 rollover trap).
 */
/** One row of the accepted-registration games query, shared by the two functions below. */
type AcceptedGameRow = {
  id: string;
  game_date: string | null;
  game_time: string | null;
  location: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
  tournament_id: string;
  home_placeholder: string | null;
  away_placeholder: string | null;
};

/**
 * Shared loader for a team's ACCEPTED + PUBLISHED tournament game rows — the "honest reveal" query
 * (published divisions only; opponent names from accepted teams only) that both
 * `getNextRegistrationGameForTeam` and `getRegistrationGamesForTeam` build on. Returns `null` when
 * there is nothing to reveal (no accepted registration / no division / no published division), so
 * callers can early-return their own empty shape. Keeping this in ONE place means the reveal rule
 * (a real security-adjacent rule) can never drift between the two callers.
 */
async function loadAcceptedTournamentGameRows(
  history: BasicCoachTournamentHistoryEntry[],
): Promise<{
  rows: AcceptedGameRow[];
  registrationIdSet: Set<string>;
  teamNameById: Map<string, string>;
  entries: BasicCoachTournamentHistoryEntry[];
  today: string;
  nowTime: string;
} | null> {
  const accepted = history.filter(
    entry => entry.registration.status === 'accepted' && entry.tournament && entry.registration.tournamentId,
  );
  if (accepted.length === 0) return null;

  const divisionIds = [...new Set(accepted.map(e => e.registration.divisionId).filter(Boolean))] as string[];
  if (divisionIds.length === 0) return null;

  const tournamentIds = [...new Set(accepted.map(e => e.registration.tournamentId))] as string[];
  const registrationIdList = accepted.map(e => e.registration.id).join(',');

  const [
    { data: divisions, error: divisionError },
    { data: games, error: gamesError },
    { data: acceptedTeams, error: teamsError },
  ] = await Promise.all([
    supabaseAdmin.from('divisions').select('id, schedule_visibility').in('id', divisionIds),
    supabaseAdmin
      .from('games')
      .select('id, game_date, game_time, location, home_team_id, away_team_id, home_score, away_score, status, tournament_id, home_placeholder, away_placeholder')
      .in('tournament_id', tournamentIds)
      .or(`home_team_id.in.(${registrationIdList}),away_team_id.in.(${registrationIdList})`)
      .order('game_date', { ascending: true })
      .order('game_time', { ascending: true }),
    // Opponent names resolve from the accepted set only (never a pending/waitlisted team).
    supabaseAdmin.from('teams').select('id, name').in('tournament_id', tournamentIds).eq('status', 'accepted'),
  ]);
  if (divisionError) throw divisionError;
  if (gamesError) throw gamesError;
  if (teamsError) throw teamsError;

  const publishedDivisions = new Set(
    ((divisions ?? []) as Array<{ id: string; schedule_visibility: string | null }>)
      .filter(d => d.schedule_visibility === 'published')
      .map(d => d.id),
  );
  const entries = accepted.filter(
    e => e.registration.divisionId && publishedDivisions.has(e.registration.divisionId),
  );
  if (entries.length === 0) return null;
  const registrationIdSet = new Set(entries.map(e => e.registration.id));

  const rows = ((games ?? []) as AcceptedGameRow[]).filter(g =>
    (g.home_team_id !== null && registrationIdSet.has(g.home_team_id)) ||
    (g.away_team_id !== null && registrationIdSet.has(g.away_team_id)),
  );
  const teamNameById = new Map(
    ((acceptedTeams ?? []) as Array<{ id: string; name: string }>).map(t => [t.id, t.name] as const),
  );
  const { date: today, time: nowTime } = tournamentNow();
  return { rows, registrationIdSet, teamNameById, entries, today, nowTime };
}

export async function getNextRegistrationGameForTeam(
  history: BasicCoachTournamentHistoryEntry[],
): Promise<BasicCoachRegistrationGame | null> {
  const loaded = await loadAcceptedTournamentGameRows(history);
  if (!loaded) return null;
  const { rows, registrationIdSet, teamNameById, entries, today, nowTime } = loaded;

  const liveGame = rows.find(g => g.status === 'submitted' && g.game_date === today) ?? null;
  const upcomingGame = rows.find(g =>
    g.status === 'scheduled' &&
    g.game_date !== null &&
    (g.game_date > today || (g.game_date === today && (!g.game_time || g.game_time >= nowTime))),
  ) ?? null;
  const game = liveGame ?? upcomingGame;
  if (!game) return null;

  const isHome = game.home_team_id !== null && registrationIdSet.has(game.home_team_id);
  const opponentId = isHome ? game.away_team_id : game.home_team_id;
  const opponentName =
    (opponentId && opponentId !== NIL_GAME_TEAM_UUID ? teamNameById.get(opponentId) : undefined)
      ?? (isHome ? game.away_placeholder : game.home_placeholder)
      ?? 'TBD';

  // The games query guarantees one side is ours, so this lookup always succeeds.
  const myRegistrationId = isHome ? game.home_team_id : game.away_team_id;
  const entry = entries.find(e => e.registration.id === myRegistrationId);

  const isLive = game === liveGame;
  return {
    opponentName,
    myScore: isHome ? game.home_score : game.away_score,
    oppScore: isHome ? game.away_score : game.home_score,
    isLive,
    dateLabel: game.game_date === today ? 'Today' : formatGameDateLabel(game.game_date),
    timeLabel: isLive ? null : formatGameTimeLabel(game.game_time),
    location: game.location,
    tournamentName: entry?.tournament?.name ?? '',
  };
}

/**
 * A team's real tournament game, shaped for the Schedule tab merge (WI-2B) — read-only.
 * ⚠ SECURITY INVARIANT: this shape carries NO fee/money field, which is why the `/tournament-games`
 * route (unlike its tournament-history sibling) skips the WI-5 money-redaction gate. Do NOT add an
 * `amountDue`/fee field here without also wiring `isMoneyRedactedForTeam` into that route, or a
 * money-off assistant coach would receive fee data unredacted.
 */
export type CoachScheduleTournamentGame = {
  id: string;
  /** ISO local start ("YYYY-MM-DDThh:mm") for interleaving with self-entered events; null when unscheduled. */
  startsAt: string | null;
  gameDate: string | null;
  dateLabel: string;
  timeLabel: string | null;
  opponentName: string;
  location: string | null;
  myScore: number | null;
  oppScore: number | null;
  status: string;
  /** The one score-state classification, computed once here so consumers don't re-derive it:
   *  'live' = submitted score today; 'final' = completed/forfeit WITH both scores; else 'scheduled'. */
  phase: 'live' | 'final' | 'scheduled';
  result: 'win' | 'loss' | 'tie' | null;
  tournamentName: string;
  /** Public game page — present only when the tournament is publicly visible (active|completed). */
  href: string | null;
};

/**
 * WI-2B: ALL of a team's real tournament games across its accepted registrations, for the Schedule
 * tab (folded in read-only alongside self-entered events). Same honest-reveal rules as the tournament
 * record + `getNextRegistrationGameForTeam`: only PUBLISHED divisions surface games, opponent names
 * resolve only from accepted teams, "live" = a submitted score on a game dated today (tournament tz,
 * never raw UTC). Public game links appear only for active|completed tournaments (a draft has no
 * public page). Takes the already-loaded history so it adds no extra history fetch.
 */
export async function getRegistrationGamesForTeam(
  history: BasicCoachTournamentHistoryEntry[],
): Promise<CoachScheduleTournamentGame[]> {
  const loaded = await loadAcceptedTournamentGameRows(history);
  if (!loaded) return [];
  const { rows, registrationIdSet, teamNameById, entries, today } = loaded;

  // Per-tournament public-link context (slug/status) keyed off the accepted history entries.
  const tournamentCtx = new Map<string, { orgSlug: string | null; tournamentSlug: string | null; isPublic: boolean; name: string }>();
  for (const e of entries) {
    const tid = e.registration.tournamentId;
    if (tid && !tournamentCtx.has(tid)) {
      tournamentCtx.set(tid, {
        orgSlug: e.org?.slug ?? null,
        tournamentSlug: e.tournament?.slug ?? null,
        isPublic: e.tournament?.status === 'active' || e.tournament?.status === 'completed',
        name: e.tournament?.name ?? '',
      });
    }
  }

  return rows.map(game => {
    const isHome = game.home_team_id !== null && registrationIdSet.has(game.home_team_id);
    const opponentId = isHome ? game.away_team_id : game.home_team_id;
    const opponentName =
      (opponentId && opponentId !== NIL_GAME_TEAM_UUID ? teamNameById.get(opponentId) : undefined)
        ?? (isHome ? game.away_placeholder : game.home_placeholder)
        ?? 'TBD';
    const myScore = isHome ? game.home_score : game.away_score;
    const oppScore = isHome ? game.away_score : game.home_score;
    const hasScore = myScore != null && oppScore != null;
    // 'live' = a score submitted today (on now / just in). Otherwise ANY game that already has both
    // scores shows them ('final') — this must cover a still-pending SUBMITTED score whose day has
    // passed (finalization-required orgs can lag), so a played+scored game never reads as unplayed.
    const phase: 'live' | 'final' | 'scheduled' =
      game.status === 'submitted' && game.game_date === today ? 'live'
        : hasScore ? 'final'
          : 'scheduled';
    // The W/L/T badge asserts an outcome, so it shows ONLY for a truly finalized result
    // (completed/forfeit). A pending submitted score shows the numbers without claiming the result.
    const isFinalized = game.status === 'completed' || game.status === 'forfeit';
    const result: 'win' | 'loss' | 'tie' | null =
      isFinalized && hasScore
        ? (myScore! > oppScore! ? 'win' : myScore! < oppScore! ? 'loss' : 'tie')
        : null;
    const ctx = tournamentCtx.get(game.tournament_id);
    const href = ctx?.isPublic && ctx.orgSlug && ctx.tournamentSlug
      ? `/${ctx.orgSlug}/${ctx.tournamentSlug}/schedule/${game.id}`
      : null;
    return {
      id: game.id,
      startsAt: game.game_date ? `${game.game_date}T${game.game_time ?? '00:00'}` : null,
      gameDate: game.game_date,
      dateLabel: game.game_date === today ? 'Today' : formatGameDateLabel(game.game_date),
      timeLabel: formatGameTimeLabel(game.game_time),
      opponentName,
      location: game.location,
      myScore,
      oppScore,
      status: game.status,
      phase,
      result,
      tournamentName: ctx?.name ?? '',
      href,
    };
  });
}

/**
 * Resolve the Basic-coach team id linked to a rep team's workspace — the ONLY bridge today from a
 * rep team to its tournament registration — self-healing the link (persisting it both ways) on first
 * resolve. Shared by the coaches tournament-history + tournament-games routes so the resolution AND
 * the write-back stay identical (they had drifted: one route did the self-heal, the other didn't).
 */
export async function resolveBasicCoachTeamIdForWorkspace(teamWorkspace: {
  id: string;
  sourceTournamentTeamId: string | null;
  basicCoachTeamId: string | null;
}): Promise<string | null> {
  if (teamWorkspace.basicCoachTeamId) return teamWorkspace.basicCoachTeamId;
  if (!teamWorkspace.sourceTournamentTeamId) return null;

  const basicCoachTeamId = await findBasicCoachTeamIdForTournamentRegistration(
    teamWorkspace.sourceTournamentTeamId,
  );
  if (!basicCoachTeamId) return null;

  await Promise.all([
    supabaseAdmin.from('team_workspaces').update({ basic_coach_team_id: basicCoachTeamId }).eq('id', teamWorkspace.id),
    supabaseAdmin.from('basic_coach_teams').update({ team_workspace_id: teamWorkspace.id }).eq('id', basicCoachTeamId),
  ]).then(results => {
    for (const { error } of results) if (error) throw error;
  });

  return basicCoachTeamId;
}

export async function getBasicCoachTournamentSummary(params: {
  userId: string;
  email?: string | null;
}) {
  // Drop free teams already upgraded to a LIVE Premium portal — to the coach those are now
  // their Premium team (reached via the Premium workspace), so the launchpad must not show a
  // second, free "Coaches Portal" card for them. Mirrors the free /coaches "Your teams" list.
  // Canceled upgrades are kept (the free team is usable again).
  const teams = await excludeActivePremiumUpgrades(
    await getBasicCoachTournamentTeamsForUserCached(params.userId, params.email ?? null),
  );
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

/**
 * The set of tournament-registration team ids (`teams.id`) this user COACHES — used by
 * Unified Home to dedupe the Following section: a team you coach must not also render as
 * a fan "Following" card (role chip wins, §3c). Fan follows reference `teams.id`, and a
 * basic-coach registration's `id` is the same `teams.id` (via basic_coach_team_registrations),
 * so this is the "normalize basic-coach synthetic context ids to real team ids" step the
 * plan requires. Premium (rep_teams) coaching lives in a different id namespace and never
 * collides with a team follow, so it correctly does not participate here.
 */
export async function getCoachedRegistrationTeamIds(params: {
  userId: string;
  email?: string | null;
}): Promise<Set<string>> {
  const teams = await getBasicCoachTournamentTeamsForUserCached(params.userId, params.email ?? null);
  const ids = new Set<string>();
  for (const team of teams) {
    for (const registration of team.registrations) ids.add(registration.id);
  }
  return ids;
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

/** Escape SQL LIKE/ILIKE wildcards so an email containing `_` or `%` matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, ch => `\\${ch}`);
}

/**
 * Tournament registrations whose contact email (`teams.email`) equals the account email but
 * are NOT yet linked to any Basic coach team — the "claim-by-email" candidates. This is the
 * discovery half of the admin-created / imported-team claim gap: Add-Teams and the bulk
 * importer create `teams` rows with no link row, so they never surface via the explicit-link
 * path (`getBasicCoachTournamentTeamsForUser`). Exact, case-insensitive email equality —
 * NOT a wildcard match — so a look-alike address can't pull in another coach's team.
 */
async function findUnlinkedEmailMatchedRegistrations(
  userId: string,
  userEmail: string | null | undefined,
): Promise<TournamentTeamRow[]> {
  const email = normalizeEmail(userEmail) || normalizeEmail(await getAuthUserEmail(userId));
  if (!email) return [];
  // FieldLogicHQ staff are NOT coaches — never surface claimable registrations for a staff email
  // (keeps discovery consistent with the requireCoachUser gate on the claim POST).
  if (await isPlatformAdminEmail(email)) return [];

  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('id, name, coach, email, status, registered_at, tournament_id, division_id')
    .ilike('email', escapeLike(email))
    .neq('status', 'rejected'); // a rejected registration is dead — not something to claim
  if (error) throw error;

  // Belt-and-suspenders exact equality (ilike without wildcards is case-insensitive equality,
  // but never trust collation) — also drops blank-email rows.
  const matched = ((data ?? []) as TournamentTeamRow[]).filter(
    row => normalizeEmail(row.email) === email,
  );
  if (matched.length === 0) return [];

  const ids = matched.map(row => row.id);
  const { data: links, error: linkError } = await supabaseAdmin
    .from('basic_coach_team_registrations')
    .select('tournament_team_id')
    .in('tournament_team_id', ids);
  if (linkError) throw linkError;

  const linkedIds = new Set((links ?? []).map(l => l.tournament_team_id));
  return matched.filter(row => !linkedIds.has(row.id));
}

/** Count of claimable (email-matched, unlinked) registrations — for landing/routing only. */
export async function countClaimableRegistrationsForUser(
  userId: string,
  userEmail: string | null | undefined,
): Promise<number> {
  const rows = await findUnlinkedEmailMatchedRegistrations(userId, userEmail);
  return rows.length;
}

/** Full claimable registrations (hydrated with tournament + org) for the claim prompt. */
export async function getClaimableRegistrationsForUser(
  userId: string,
  userEmail: string | null | undefined,
): Promise<ClaimableRegistration[]> {
  const rows = await findUnlinkedEmailMatchedRegistrations(userId, userEmail);
  if (rows.length === 0) return [];

  const tournamentIds = [...new Set(rows.map(r => r.tournament_id).filter(Boolean))] as string[];
  const { data: tournaments, error: tErr } = tournamentIds.length > 0
    ? await supabaseAdmin
        .from('tournaments')
        .select('id, name, slug, year, start_date, end_date, org_id, status')
        .in('id', tournamentIds)
    : { data: [], error: null };
  if (tErr) throw tErr;

  const tournamentRows = (tournaments ?? []) as TournamentRow[];
  const tournamentMap = new Map(tournamentRows.map(t => [t.id, t]));

  const orgIds = [...new Set(tournamentRows.map(t => t.org_id).filter(Boolean))] as string[];
  const { data: orgs, error: oErr } = orgIds.length > 0
    ? await supabaseAdmin.from('organizations').select('id, name').in('id', orgIds)
    : { data: [], error: null };
  if (oErr) throw oErr;
  const orgMap = new Map(((orgs ?? []) as { id: string; name: string }[]).map(o => [o.id, o]));

  return rows
    .map(row => {
      const tournament = row.tournament_id ? tournamentMap.get(row.tournament_id) ?? null : null;
      const org = tournament?.org_id ? orgMap.get(tournament.org_id) ?? null : null;
      return {
        id: row.id,
        name: row.name,
        coach: row.coach,
        tournamentId: row.tournament_id,
        tournament: tournament
          ? {
              id: tournament.id,
              name: tournament.name,
              slug: tournament.slug,
              startDate: tournament.start_date,
              endDate: tournament.end_date,
              status: tournament.status,
            }
          : null,
        orgName: org?.name ?? null,
      };
    })
    .sort((a, b) => (a.tournament?.name ?? a.name).localeCompare(b.tournament?.name ?? b.name));
}

/**
 * Pre-delete cleanup for a user account (J5-012). `basic_coach_team_users.user_id` is ON DELETE
 * CASCADE, so deleting an auth user silently strips their team-membership rows — leaving any team
 * they were the SOLE active member of orphaned (zero members → unreachable, unclaimable). Call this
 * BEFORE `auth.admin.deleteUser` to delete those soon-to-be-orphaned teams outright (child rows —
 * registrations/players/events/fees/announcements — all cascade on team delete). Teams with other
 * active members are left intact; the departing user's row drops via the user-delete cascade.
 *
 * Returns the ids of teams deleted (for audit/logging). Safe to call for any user (no-op when they
 * own no sole-member teams).
 */
export async function cleanupBasicCoachTeamsForUserDeletion(userId: string): Promise<string[]> {
  // Sole-member teams = exactly the ones a user-delete would orphan. Shared resolver so this
  // "what gets deleted" set stays identical to the platform-admin pre-delete warning's count.
  const soleMemberTeamIds = await getSoleOwnedActiveBasicCoachTeamIds(userId);

  if (soleMemberTeamIds.length > 0) {
    const { error: delErr } = await supabaseAdmin
      .from('basic_coach_teams')
      .delete()
      .in('id', soleMemberTeamIds);
    if (delErr) throw delErr;
  }
  return soleMemberTeamIds;
}
