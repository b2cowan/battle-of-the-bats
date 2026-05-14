import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { TournamentArchive } from '@/lib/types';

type ArchiveRow = {
  id: string;
  tournament_id: string | null;
  org_id: string;
  tournament_name: string;
  season: string;
  division: string | null;
  final_snapshot: TournamentArchive['finalSnapshot'];
  winner_team_id: string | null;
  winner_team_name: string | null;
  runner_up_name: string | null;
  total_teams: number | null;
  total_games: number | null;
  integrity_hash: string;
  sealed_at: string;
  sealed_by: string | null;
};

function mapArchive(row: ArchiveRow): TournamentArchive {
  return {
    id: row.id,
    tournamentId: row.tournament_id ?? null,
    orgId: row.org_id,
    tournamentName: row.tournament_name,
    season: row.season,
    division: row.division ?? undefined,
    finalSnapshot: row.final_snapshot,
    winnerTeamId: row.winner_team_id ?? undefined,
    winnerTeamName: row.winner_team_name ?? undefined,
    runnerUpName: row.runner_up_name ?? undefined,
    totalTeams: row.total_teams ?? undefined,
    totalGames: row.total_games ?? undefined,
    integrityHash: row.integrity_hash,
    sealedAt: row.sealed_at,
    sealedBy: row.sealed_by ?? undefined,
  };
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('tournament_archives')
    .select('*')
    .eq('org_id', ctx.org.id)
    .order('sealed_at', { ascending: false })
    .returns<ArchiveRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []).map(mapArchive));
}
