import 'server-only';
import { supabaseAdmin } from './supabase-admin';

/**
 * OUR TEAM — the one answer (Club Tier Stage 7a's ruling, made one definition in 7b, owner 2026-10-21): a tournament registration
 * linked to a rep team owned by the club that hosts the tournament is "our team" and owes no entry fee, ON EVERY PLAN. It is the
 * database's own rule (mig 345 refuses a fee for it; mig 346's link guard), so a screen, a reminder or an export that asks
 * anything else can show a fee the server will never let anyone record. No module, plan or accounting gate belongs here: the
 * Teams page used to add "carries Accounting" and the coach's record "is on the Club plan", and both were dropped with this.
 *
 * Every reader of a team's payment state asks this file (tests/unit/our-team-one-answer-guard.test.ts).
 */

type Rel<T> = T | T[] | null;
type Org = { org_id: string };
type LinkRow = {
  tournament_team_id: string;
  rep_team_id: string;
  org_id: string;
  rep_teams: Rel<Org>;
  teams: Rel<{ tournaments: Rel<Org> }>;
};

const one = <T,>(v: Rel<T> | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

/** The link, the rep team and the tournament all belong to one club. */
function isOurs(row: LinkRow): boolean {
  const repOrg = one(row.rep_teams)?.org_id;
  const hostOrg = one(one(row.teams)?.tournaments)?.org_id;
  return !!hostOrg && row.org_id === hostOrg && repOrg === hostOrg;
}

const LINK_SELECT = 'tournament_team_id, rep_team_id, org_id, rep_teams!inner(org_id), teams!inner(tournament_id, tournaments!inner(org_id))';
const CHUNK = 150;

/** Which of these registrations are our team (any tournaments, any hosts). */
export async function ourTeamIdsAmong(registrationIds: readonly string[]): Promise<Set<string>> {
  const ids = [...new Set(registrationIds.filter(Boolean))];
  const ours = new Set<string>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabaseAdmin.from('rep_team_tournament_registrations')
      .select(LINK_SELECT).in('tournament_team_id', ids.slice(i, i + CHUNK));
    if (error) throw error;
    for (const row of (data ?? []) as unknown as LinkRow[]) if (isOurs(row)) ours.add(row.tournament_team_id);
  }
  return ours;
}

/** Every registration in this tournament that is our team, with the rep team it is linked to. */
export async function ourTournamentLinks(tournamentId: string): Promise<Array<{ registrationId: string; repTeamId: string }>> {
  const { data, error } = await supabaseAdmin.from('rep_team_tournament_registrations')
    .select(LINK_SELECT).eq('teams.tournament_id', tournamentId);
  if (error) throw error;
  return ((data ?? []) as unknown as LinkRow[]).filter(isOurs)
    .map(row => ({ registrationId: row.tournament_team_id, repTeamId: row.rep_team_id }));
}

/** Every registration in this tournament that is our team. */
export async function ourTournamentTeamIds(tournamentId: string): Promise<Set<string>> {
  return new Set((await ourTournamentLinks(tournamentId)).map(link => link.registrationId));
}

/** One registration. `orgId` is the caller's club: a registration is ours only in its own host's hands. */
export async function isOurTournamentTeam(orgId: string, registrationId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('rep_team_tournament_registrations')
    .select(LINK_SELECT).eq('org_id', orgId).eq('tournament_team_id', registrationId);
  if (error) throw error;
  return ((data ?? []) as unknown as LinkRow[]).some(isOurs);
}
