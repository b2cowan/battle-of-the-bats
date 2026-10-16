import { supabaseAdmin } from './supabase-admin';
import { sameKey } from './utils';
import {
  matchTeamEntries,
  type RegistrableTeam, type TeamEntryInTournament, type TeamEntryKey, type TeamEntryLink, type TeamEntryRow,
} from './registrable-teams';

/**
 * TWO DUPLICATE RULES for a tournament entry:
 *   1. a NAME twice in one division (`findDuplicateTournamentTeam`) — every entry, typed or chosen;
 *   2. the same TEAM twice in one tournament (`findTeamEntriesInTournament`, owner 2026-10-16) — an
 *      entry filed under a coach's own team. Rule 1 alone let one team in twice: since a coach may
 *      enter a team under another name in a tournament (A2) and its staff may register it (D1), the
 *      head coach and an assistant entered the same U12 team five minutes apart, under two names.
 */

type DuplicateTeamRow = {
  id: string;
  name: string | null;
};

export function duplicateTournamentTeamMessage(teamName: string) {
  return `A team named "${teamName.trim()}" already exists in this division.`;
}

export async function findDuplicateTournamentTeam({
  tournamentId,
  divisionId,
  teamName,
  excludeTeamId,
}: {
  tournamentId: string;
  divisionId: string;
  teamName: string;
  excludeTeamId?: string;
}) {
  const normalizedName = sameKey(teamName);
  if (!normalizedName) return null;

  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('id, name')
    .eq('tournament_id', tournamentId)
    .eq('division_id', divisionId);

  if (error) throw error;

  return ((data ?? []) as DuplicateTeamRow[]).find(team => (
    team.id !== excludeTeamId
    && sameKey(team.name) === normalizedName
  )) ?? null;
}

/** The entry a bridge row points at, joined in the same request and kept to this tournament (`!inner`). */
const ENTRY = 'entry:teams!inner(id, name, status, registered_at, tournament_id, division:divisions(name))';

/** A to-one embed arrives as an object, or as a one-row array depending on how the relation is read. */
type Embedded<T> = T | T[] | null;
const first = <T,>(value: Embedded<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value);

type EntryEmbed = Omit<TeamEntryRow, 'division'> & { division: Embedded<{ name: string | null }> };
const entryRow = (e: EntryEmbed): TeamEntryRow => ({
  id: e.id, name: e.name, status: e.status, registered_at: e.registered_at, division: first(e.division)?.name ?? null,
});

/**
 * Rule 2's read: each team's entry in this tournament, keyed by its free team id. Asked by the register
 * form's cards (`markTeamsAlreadyInTournament`) and again by `/api/register` before it creates anything,
 * so the form and the refusal never disagree about what counts. One request per bridge, the two at once,
 * each joined to its entry and kept to this tournament — never a list of every entry the team ever made.
 */
export async function findTeamEntriesInTournament(params: {
  tournamentId: string;
  teams: ReadonlyArray<Pick<RegistrableTeam, 'basicCoachTeamId' | 'repTeamId'>>;
}): Promise<Map<string, TeamEntryInTournament>> {
  // A card's keys: the twin, and the portal's rep team when it is a portal's.
  const keys: TeamEntryKey[] = params.teams.map(t => ({ basicCoachTeamId: t.basicCoachTeamId, repTeamId: t.repTeamId }));
  if (keys.length === 0) return new Map();
  const basicIds = [...new Set(keys.map(k => k.basicCoachTeamId))];
  const repIds = [...new Set(keys.map(k => k.repTeamId).filter((id): id is string => !!id))];

  const [basic, rep] = await Promise.all([
    supabaseAdmin.from('basic_coach_team_registrations')
      .select(`basic_coach_team_id, ${ENTRY}`)
      .in('basic_coach_team_id', basicIds)
      .eq('entry.tournament_id', params.tournamentId),
    repIds.length > 0
      ? supabaseAdmin.from('rep_team_tournament_registrations')
          .select(`rep_team_id, ${ENTRY}`)
          .in('rep_team_id', repIds)
          .eq('entry.tournament_id', params.tournamentId)
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ]);
  if (basic.error) throw basic.error;
  if (rep.error) throw rep.error;

  const links: TeamEntryLink[] = [];
  for (const row of (basic.data ?? []) as Array<{ basic_coach_team_id: string; entry: Embedded<EntryEmbed> }>) {
    const entry = first(row.entry);
    if (entry) links.push({ basicCoachTeamId: row.basic_coach_team_id, entry: entryRow(entry) });
  }
  for (const row of (rep.data ?? []) as Array<{ rep_team_id: string; entry: Embedded<EntryEmbed> }>) {
    const entry = first(row.entry);
    if (entry) links.push({ repTeamId: row.rep_team_id, entry: entryRow(entry) });
  }
  return matchTeamEntries(keys, links);
}

/** The register form's cards, each told whether its team is already in this tournament. */
export async function markTeamsAlreadyInTournament(
  teams: readonly RegistrableTeam[],
  tournamentId: string,
): Promise<RegistrableTeam[]> {
  const entries = await findTeamEntriesInTournament({ tournamentId, teams });
  return teams.map(team => {
    const alreadyIn = entries.get(team.basicCoachTeamId);
    return alreadyIn ? { ...team, alreadyIn } : team;
  });
}
