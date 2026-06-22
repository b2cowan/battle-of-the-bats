import 'server-only';

import { supabaseAdmin } from './supabase-admin';

/**
 * lib/chat-resolvers.ts — Tournament Chat participant resolution.
 *
 * The ONE piece of genuinely net-new logic for the Tournament Chat surface: turning a tournament
 * into "every coach who belongs in the room". The two product domains are SEPARATE in the schema —
 * the `tournaments` / `teams` registration world and the `rep_*` franchise world — and they are
 * bridged only through `team_workspaces` ← `team_workspace_claims`. There is no single column that
 * lists a tournament's coaches, so we union three independent populations and dedupe on `user_id`:
 *
 *   1. CLAIM  — a coach who claimed a team workspace (`team_workspace_claims.claimed_by_user_id`,
 *               status='claimed'). This is the upgraded/Premium head coach.
 *   2. BASIC  — a free Basic coach linked to a registered team
 *               (`basic_coach_team_registrations` → `basic_coach_team_users`, status='active').
 *               Catches coaches who never went through the workspace-claim funnel (direct signup,
 *               admin-created / imported teams claimed by email).
 *   3. REP    — assistant + co-head coaches of an upgraded team
 *               (claim → `team_workspaces.rep_team_id` → `rep_team_coaches`). Best-effort: a rep
 *               schema hiccup must not break the whole roster, so this path is guarded.
 *
 * Teams whose coach has NO completed login (no resolvable user_id via any path) are surfaced as
 * "Not yet joined" (pending) keyed on the team's contact email — nobody is silently dropped. They
 * auto-join once they sign in (the inverse resolver picks them up; see resolveTournamentsForCoach).
 *
 * Source columns verified against the live dev schema snapshot + the production query code in
 * lib/basic-coach-teams.ts and lib/team-workspace-claims.ts (NOT migration files).
 */

/** A team with no logged-in coach — shown as "Not yet joined" with a re-invite affordance. */
export type PendingChatCoach = {
  /** the tournament-registration row (teams.id) */
  teamId: string;
  teamName: string;
  /** the registration's contact name (teams.coach), if any */
  coachName: string | null;
  /** the registration's contact email (teams.email) — the re-invite target */
  email: string | null;
  divisionId: string | null;
  /** outstanding claim-link state for this team — drives the re-invite copy */
  claimState: 'none' | 'available' | 'expired' | 'revoked' | 'claimed';
};

export type TournamentChatParticipants = {
  /** deduped user_ids of every coach with a completed login who belongs in the room */
  userIds: string[];
  /** teams with no logged-in coach (surfaced as "Not yet joined") */
  pending: PendingChatCoach[];
};

type TeamRow = {
  id: string;
  name: string;
  coach: string | null;
  email: string | null;
  division_id: string | null;
  status: string | null;
};

const CLAIM_RANK: Record<string, number> = { claimed: 4, available: 3, expired: 2, revoked: 1 };

/**
 * The subset of the given program-year ids whose season is `draft` or `active`. `rep_team_coaches`
 * rows are PERMANENT (never deleted at season end — only `rep_program_years.status` changes), so the
 * rep path must filter to current seasons or a former coach from a completed/archived season would
 * resolve as a current chat participant. Mirrors `getCoachingAssignmentsForUser` (lib/db.ts).
 */
async function activeProgramYearIds(programYearIds: (string | null)[]): Promise<Set<string>> {
  const ids = [...new Set(programYearIds.filter((v): v is string => Boolean(v)))];
  if (ids.length === 0) return new Set();
  const { data } = await supabaseAdmin
    .from('rep_program_years')
    .select('id')
    .in('id', ids)
    .in('status', ['draft', 'active']);
  return new Set((data ?? []).map(r => r.id as string));
}

/**
 * Resolve the full chat roster for a tournament: the deduped set of logged-in coach user_ids plus
 * the "Not yet joined" teams. Pure DB joins — no auth-admin lookups (cheap; callers hydrate display
 * names separately only for the handful of rows they render). Pass `divisionId` to scope to one
 * division (the spine is `teams`, which carries `division_id`, so every downstream join inherits it).
 */
export async function resolveTournamentChatParticipants(
  tournamentId: string,
  divisionId?: string | null,
): Promise<TournamentChatParticipants> {
  // ── 1. The spine: the tournament's registered teams (optionally one division) ──
  let teamsQuery = supabaseAdmin
    .from('teams')
    .select('id, name, coach, email, division_id, status')
    .eq('tournament_id', tournamentId)
    .neq('status', 'rejected'); // a rejected registration is dead — not a participant
  if (divisionId) teamsQuery = teamsQuery.eq('division_id', divisionId);

  const { data: teamsData, error: teamsError } = await teamsQuery;
  if (teamsError) throw teamsError;
  const teams = (teamsData ?? []) as TeamRow[];
  if (teams.length === 0) return { userIds: [], pending: [] };

  const teamIds = teams.map(t => t.id);
  const userIds = new Set<string>();
  const teamsWithCoach = new Set<string>();          // teams that resolved ≥1 logged-in coach
  const claimStateByTeam = new Map<string, PendingChatCoach['claimState']>();
  const workspaceIds = new Set<string>();            // claimed workspaces → rep expansion

  // ── 2. CLAIM path: claimed workspaces for these teams ──
  const { data: claims, error: claimsError } = await supabaseAdmin
    .from('team_workspace_claims')
    .select('tournament_team_id, status, claimed_by_user_id, team_workspace_id')
    .eq('tournament_id', tournamentId)
    .in('tournament_team_id', teamIds);
  if (claimsError) throw claimsError;

  for (const claim of claims ?? []) {
    const teamId = claim.tournament_team_id as string | null;
    if (!teamId) continue;
    // Track the strongest claim state per team (claimed > available > expired > revoked).
    const rank = CLAIM_RANK[claim.status as string] ?? 0;
    const prev = claimStateByTeam.get(teamId);
    if (!prev || rank > (CLAIM_RANK[prev] ?? 0)) {
      claimStateByTeam.set(teamId, claim.status as PendingChatCoach['claimState']);
    }
    if (claim.status === 'claimed' && claim.claimed_by_user_id) {
      userIds.add(claim.claimed_by_user_id as string);
      teamsWithCoach.add(teamId);
      if (claim.team_workspace_id) workspaceIds.add(claim.team_workspace_id as string);
    }
  }

  // ── 3. BASIC path: free Basic coaches linked to these teams ──
  const { data: links, error: linksError } = await supabaseAdmin
    .from('basic_coach_team_registrations')
    .select('tournament_team_id, basic_coach_team_id')
    .in('tournament_team_id', teamIds);
  if (linksError) throw linksError;

  const basicTeamIdByRegistration = new Map<string, string>();
  const basicTeamIds = new Set<string>();
  for (const link of links ?? []) {
    const regId = link.tournament_team_id as string;
    const basicId = link.basic_coach_team_id as string;
    if (!regId || !basicId) continue;
    basicTeamIdByRegistration.set(regId, basicId);
    basicTeamIds.add(basicId);
  }

  if (basicTeamIds.size > 0) {
    const { data: members, error: membersError } = await supabaseAdmin
      .from('basic_coach_team_users')
      .select('basic_coach_team_id, user_id')
      .in('basic_coach_team_id', [...basicTeamIds])
      .eq('status', 'active');
    if (membersError) throw membersError;

    // basic_coach_team_id → its active member user_ids
    const usersByBasicTeam = new Map<string, string[]>();
    for (const m of members ?? []) {
      const arr = usersByBasicTeam.get(m.basic_coach_team_id as string) ?? [];
      arr.push(m.user_id as string);
      usersByBasicTeam.set(m.basic_coach_team_id as string, arr);
    }
    for (const [regId, basicId] of basicTeamIdByRegistration) {
      const us = usersByBasicTeam.get(basicId) ?? [];
      if (us.length > 0) {
        teamsWithCoach.add(regId);
        for (const u of us) userIds.add(u);
      }
    }
  }

  // ── 4. REP path (best-effort): assistant + co-head coaches of upgraded teams ──
  if (workspaceIds.size > 0) {
    try {
      const { data: workspaces } = await supabaseAdmin
        .from('team_workspaces')
        .select('id, rep_team_id')
        .in('id', [...workspaceIds]);
      const repTeamIds = [...new Set((workspaces ?? [])
        .map(w => w.rep_team_id as string | null)
        .filter((v): v is string => Boolean(v)))];
      if (repTeamIds.length > 0) {
        const { data: repCoaches } = await supabaseAdmin
          .from('rep_team_coaches')
          .select('user_id, program_year_id')
          .in('team_id', repTeamIds);
        const activeYears = await activeProgramYearIds((repCoaches ?? []).map(rc => rc.program_year_id as string));
        for (const rc of repCoaches ?? []) {
          // CURRENT-season staff only — a former coach's row persists across completed seasons.
          if (rc.user_id && activeYears.has(rc.program_year_id as string)) userIds.add(rc.user_id as string);
        }
      }
    } catch (err) {
      // Never let the rep franchise schema break the core roster — log + continue.
      console.error('[chat-resolvers] rep-coach expansion failed (non-fatal):', err);
    }
  }

  // ── 5. Pending ("Not yet joined"): teams that resolved no logged-in coach ──
  const pending: PendingChatCoach[] = teams
    .filter(t => !teamsWithCoach.has(t.id))
    .map(t => ({
      teamId: t.id,
      teamName: t.name,
      coachName: t.coach,
      email: t.email,
      divisionId: t.division_id,
      claimState: claimStateByTeam.get(t.id) ?? 'none',
    }));

  return { userIds: [...userIds], pending };
}

/**
 * Inverse resolver: the tournament ids in which this coach is a participant — used to self-heal
 * the coach's room memberships and list their rooms (a coach who signs in after the organizer
 * opened chat still finds their room). Mirror image of resolveTournamentChatParticipants, walking
 * the same three populations from the user's side.
 */
export async function resolveTournamentsForCoach(userId: string): Promise<string[]> {
  const tournamentIds = new Set<string>();

  // CLAIM → tournament_id
  const { data: claims } = await supabaseAdmin
    .from('team_workspace_claims')
    .select('tournament_id')
    .eq('claimed_by_user_id', userId)
    .eq('status', 'claimed');
  for (const c of claims ?? []) {
    if (c.tournament_id) tournamentIds.add(c.tournament_id as string);
  }

  // BASIC → basic_coach_team_users → registrations → teams.tournament_id
  const { data: memberships } = await supabaseAdmin
    .from('basic_coach_team_users')
    .select('basic_coach_team_id')
    .eq('user_id', userId)
    .eq('status', 'active');
  const basicTeamIds = [...new Set((memberships ?? [])
    .map(m => m.basic_coach_team_id as string | null)
    .filter((v): v is string => Boolean(v)))];
  if (basicTeamIds.length > 0) {
    const { data: links } = await supabaseAdmin
      .from('basic_coach_team_registrations')
      .select('tournament_team_id')
      .in('basic_coach_team_id', basicTeamIds);
    const regIds = [...new Set((links ?? [])
      .map(l => l.tournament_team_id as string | null)
      .filter((v): v is string => Boolean(v)))];
    if (regIds.length > 0) {
      // Symmetric with the forward resolver (line 79): a rejected registration is NOT a participant,
      // otherwise a rejected coach would self-heal back into the room on every portal load.
      const { data: regTeams } = await supabaseAdmin
        .from('teams')
        .select('tournament_id')
        .in('id', regIds)
        .neq('status', 'rejected');
      for (const t of regTeams ?? []) {
        if (t.tournament_id) tournamentIds.add(t.tournament_id as string);
      }
    }
  }

  // REP (best-effort) → rep_team_coaches → team_workspaces → claims.tournament_id
  try {
    const { data: repCoaches } = await supabaseAdmin
      .from('rep_team_coaches')
      .select('team_id, program_year_id')
      .eq('user_id', userId);
    const activeYears = await activeProgramYearIds((repCoaches ?? []).map(r => r.program_year_id as string));
    const repTeamIds = [...new Set((repCoaches ?? [])
      .filter(r => activeYears.has(r.program_year_id as string)) // CURRENT-season assignments only
      .map(r => r.team_id as string | null)
      .filter((v): v is string => Boolean(v)))];
    if (repTeamIds.length > 0) {
      const { data: workspaces } = await supabaseAdmin
        .from('team_workspaces')
        .select('id')
        .in('rep_team_id', repTeamIds);
      const wsIds = [...new Set((workspaces ?? [])
        .map(w => w.id as string)
        .filter(Boolean))];
      if (wsIds.length > 0) {
        const { data: wsClaims } = await supabaseAdmin
          .from('team_workspace_claims')
          .select('tournament_id')
          .in('team_workspace_id', wsIds)
          .eq('status', 'claimed');
        for (const c of wsClaims ?? []) {
          if (c.tournament_id) tournamentIds.add(c.tournament_id as string);
        }
      }
    }
  } catch (err) {
    console.error('[chat-resolvers] rep tournament lookup failed (non-fatal):', err);
  }

  return [...tournamentIds];
}

/** Whether a user is a participating coach of a tournament (cheap membership check for self-heal). */
export async function isTournamentChatParticipant(userId: string, tournamentId: string): Promise<boolean> {
  const ids = await resolveTournamentsForCoach(userId);
  return ids.includes(tournamentId);
}
