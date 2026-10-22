import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { LIVE_SEASON_STATUSES } from './season-live';
import { listActiveHeadCoachesForTeams } from './coach-membership';
import { resolveCoachUserIdentities } from './db';
import { ourTournamentLinks } from './club-own-tournament-team';

/**
 * ADD OUR TEAMS (Club Tier Stage 7b; Ask 5 A, owner answers 2026-10-21). A club admin enters any of the club's rep teams into a
 * tournament the club hosts: each one entered, accepted and linked to its rep team in ONE step (mig 346's
 * `club_enter_own_teams`), all of the set or none. Not the coaches portal's "Add my team" (lib/host-own-team.ts), which has one
 * team and no picker; the two never show on one page.
 *
 * Which teams may be entered — ONE rule, the database's (`club_enter_own_teams` refuses anything else):
 *   not archived, and a season running (lib/season-live.ts LIVE_SEASON_STATUSES = mig 318's rep_team_live_season).
 * The window lists a team with no season running under its own band with that reason, never drops it silently. An archived team
 * is not listed (it has left the club's list everywhere). A member limited to some team groups sees and enters only those.
 *
 * The head coach: the oldest ACTIVE head-coach membership (the access truth, never a season's record), name and email written on
 * the entry (the dashboard's email and sign-up counts and the coach's later tournament emails read them), and read LIVE for the
 * Teams table, so a coach change shows without editing the entry. A team with no head coach yet enters with a blank coach.
 */

export type OwnTeamOption = {
  repTeamId: string;
  name: string;
  /** The rep team's own division word ("15U") — the window's division match reads it first. */
  division: string | null;
  /** Whether the team has an active head coach (the window says so when it has none). */
  hasHeadCoach: boolean;
  state: 'open' | 'in' | 'no-season';
  /** When it is already in: the day it was entered, and the division it is in. */
  enteredAt?: string;
  enteredDivision?: string | null;
};

export type OurTeamRow = { registrationId: string; repTeamId: string; headCoach: string | null };

export class OwnTeamsEntryError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** The refusals mig 346 raises on purpose, each a sentence for the admin. Anything else is a real failure. */
const DELIBERATE_REFUSALS = [
  / is already in this tournament\.$/,
  / has no season running, so it can't be entered\.$/,
  / is archived, so it can't be entered\.$/,
  /^A team named ".*" already exists in this division\.$/,
  /^Choose a division for /,
  /^Choose at least one team$/,
  /^Choose at most 100 teams at once$/,
  /^Each team can be chosen once$/,
  /^That rep team is not in your organization\.$/,
  /^Division does not belong to this tournament\.$/,
  /^Tournament not found$/,
  /^This tournament is completed, so its results are locked\./,
  /^The rep team and tournament must belong to the same club$/,
];

function ownTeamsRefusal(err: unknown): string | null {
  const e = err as { code?: string; message?: string } | null;
  if (e?.code !== 'P0001' || !e.message) return null;
  return DELIBERATE_REFUSALS.some(r => r.test(e.message!)) ? e.message : null;
}

type HeadCoach = { name: string | null; email: string | null; label: string | null };

/** Each team's head coach (the oldest active head-coach membership): name and sign-in email, and the one to show (name, else email). */
async function headCoachesOf(orgId: string, repTeamIds: string[]): Promise<Map<string, HeadCoach>> {
  const heads = await listActiveHeadCoachesForTeams(repTeamIds);
  const first = new Map<string, string>();
  for (const h of heads) if (!first.has(h.teamId)) first.set(h.teamId, h.userId);
  const people = await resolveCoachUserIdentities(orgId, [...new Set(first.values())]);
  return new Map([...first].map(([teamId, userId]) => {
    const p = people.get(userId);
    const name = p?.displayName ?? null;
    const email = p?.email ?? null;
    return [teamId, { name, email, label: name ?? email }];
  }));
}

type RepRow = { id: string; name: string; division: string | null; group_id: string | null; is_archived: boolean };

function inScope(team: Pick<RepRow, 'group_id'>, repGroupIds: string[] | null): boolean {
  return !repGroupIds || (!!team.group_id && repGroupIds.includes(team.group_id));
}

/** The window's list: the club's teams (those the member may see), each open, already in, or with no season running. */
export async function listOwnTeamOptions(params: {
  orgId: string; tournamentId: string; repGroupIds: string[] | null;
}): Promise<OwnTeamOption[]> {
  const { data: reps, error } = await supabaseAdmin.from('rep_teams')
    .select('id, name, division, group_id, is_archived').eq('org_id', params.orgId).eq('is_archived', false);
  if (error) throw error;
  const teams = ((reps ?? []) as RepRow[]).filter(t => inScope(t, params.repGroupIds));
  if (!teams.length) return [];
  const ids = teams.map(t => t.id);

  const [seasons, links, headCoaches] = await Promise.all([
    supabaseAdmin.from('rep_program_years').select('team_id').in('team_id', ids).in('status', [...LIVE_SEASON_STATUSES]),
    supabaseAdmin.from('rep_team_tournament_registrations')
      .select('rep_team_id, teams!inner(tournament_id, registered_at, divisions(name))')
      .in('rep_team_id', ids).eq('teams.tournament_id', params.tournamentId),
    listActiveHeadCoachesForTeams(ids),
  ]);
  if (seasons.error) throw seasons.error;
  if (links.error) throw links.error;
  const withHead = new Set(headCoaches.map(h => h.teamId));
  const live = new Set((seasons.data ?? []).map((r: { team_id: string }) => r.team_id));
  const entered = new Map<string, { at: string; division: string | null }>();
  for (const row of (links.data ?? []) as unknown as Array<{ rep_team_id: string; teams: unknown }>) {
    const team = (Array.isArray(row.teams) ? row.teams[0] : row.teams) as { registered_at: string; divisions: { name: string } | { name: string }[] | null } | null;
    if (!team || entered.has(row.rep_team_id)) continue;
    const div = Array.isArray(team.divisions) ? team.divisions[0] : team.divisions;
    entered.set(row.rep_team_id, { at: team.registered_at, division: div?.name ?? null });
  }

  return teams
    .map((t): OwnTeamOption => {
      const inAlready = entered.get(t.id);
      return {
        repTeamId: t.id,
        name: t.name,
        division: t.division,
        hasHeadCoach: withHead.has(t.id),
        state: inAlready ? 'in' : live.has(t.id) ? 'open' : 'no-season',
        enteredAt: inAlready?.at,
        enteredDivision: inAlready?.division,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

/** The Teams table's our-team rows, each with its head coach read live through the link (S7-01). */
export async function listOurTeamRows(orgId: string, tournamentId: string): Promise<OurTeamRow[]> {
  const links = await ourTournamentLinks(tournamentId);
  if (!links.length) return [];
  const heads = await headCoachesOf(orgId, [...new Set(links.map(l => l.repTeamId))]);
  return links.map(l => ({ ...l, headCoach: heads.get(l.repTeamId)?.label ?? null }));
}

/** Enter the set. Throws OwnTeamsEntryError with the admin's sentence on a refusal; nothing is entered then. */
export async function enterOwnTeams(params: {
  orgId: string; tournamentId: string; actorUserId: string; repGroupIds: string[] | null;
  entries: Array<{ repTeamId: string; divisionId: string }>;
}): Promise<Array<{ repTeamId: string; registrationId: string; name: string }>> {
  const ids = params.entries.map(e => e.repTeamId);
  const { data: reps, error } = await supabaseAdmin.from('rep_teams')
    .select('id, group_id').eq('org_id', params.orgId).in('id', ids);
  if (error) throw error;
  const found = new Map(((reps ?? []) as Array<{ id: string; group_id: string | null }>).map(r => [r.id, r]));
  // A team of another club, or one outside the member's team groups, is not theirs to enter.
  if (ids.some(id => !found.has(id) || !inScope(found.get(id)!, params.repGroupIds))) {
    throw new OwnTeamsEntryError(404, 'That rep team is not in your organization.');
  }
  const heads = await headCoachesOf(params.orgId, [...new Set(ids)]);
  const { data, error: rpcError } = await supabaseAdmin.rpc('club_enter_own_teams', {
    p_org: params.orgId,
    p_tournament: params.tournamentId,
    p_entries: params.entries.map(e => ({
      rep_team_id: e.repTeamId,
      division_id: e.divisionId,
      coach: heads.get(e.repTeamId)?.name ?? null,
      email: heads.get(e.repTeamId)?.email ?? null,
    })),
    p_actor: params.actorUserId,
  });
  if (rpcError) {
    const refusal = ownTeamsRefusal(rpcError);
    if (refusal) throw new OwnTeamsEntryError(409, refusal);
    throw rpcError;
  }
  return (data ?? []) as Array<{ repTeamId: string; registrationId: string; name: string }>;
}
