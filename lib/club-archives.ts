import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * lib/club-archives.ts — A CLUB'S SEALED TOURNAMENTS, AS A LIST (Club Tier Stage 4f). The columns a list shows and
 * nothing else: never `final_snapshot`, the whole sealed tournament (every game and team), which only an archive's own
 * page reads (`getArchiveById`). Read by the club's Tournaments page (Past tournaments) and the editor's count.
 * Newest seal first.
 */
export interface ClubArchiveRow {
  id: string;
  tournamentId: string | null; // null once the source tournament was deleted after the seal
  tournamentName: string;
  season: string;
  division: string | null;
  winnerTeamName: string | null;
  totalTeams: number | null;
  totalGames: number | null;
}

/** `strict`: a failed read throws (the Tournaments page, which must never say the club hosts nothing because a read
 *  failed); otherwise it reads as none. */
export async function listClubArchives(orgId: string, options: { strict?: boolean } = {}): Promise<ClubArchiveRow[]> {
  const { data, error } = await supabaseAdmin
    .from('tournament_archives')
    .select('id, tournament_id, tournament_name, season, division, winner_team_name, total_teams, total_games')
    .eq('org_id', orgId)
    .order('sealed_at', { ascending: false });
  if (error) {
    if (options.strict) throw error;
    console.error('[club-archives] list read failed', error);
    return [];
  }
  return (data ?? []).map(r => ({
    id: r.id,
    tournamentId: r.tournament_id,
    tournamentName: r.tournament_name,
    season: r.season,
    division: r.division,
    winnerTeamName: r.winner_team_name,
    totalTeams: r.total_teams,
    totalGames: r.total_games,
  }));
}
