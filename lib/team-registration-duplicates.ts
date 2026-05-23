import { supabaseAdmin } from './supabase-admin';

type DuplicateTeamRow = {
  id: string;
  name: string | null;
};

export function normalizeTournamentTeamName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function duplicateTournamentTeamMessage(teamName: string) {
  return `A team named "${teamName.trim()}" already exists in this division.`;
}

export async function findDuplicateTournamentTeam({
  tournamentId,
  ageGroupId,
  teamName,
  excludeTeamId,
}: {
  tournamentId: string;
  ageGroupId: string;
  teamName: string;
  excludeTeamId?: string;
}) {
  const normalizedName = normalizeTournamentTeamName(teamName);
  if (!normalizedName) return null;

  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('id, name')
    .eq('tournament_id', tournamentId)
    .eq('age_group_id', ageGroupId);

  if (error) throw error;

  return ((data ?? []) as DuplicateTeamRow[]).find(team => (
    team.id !== excludeTeamId
    && normalizeTournamentTeamName(team.name ?? '') === normalizedName
  )) ?? null;
}
