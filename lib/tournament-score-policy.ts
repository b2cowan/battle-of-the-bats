import { supabaseAdmin } from './supabase-admin';

type TournamentScorePolicyRow = {
  require_score_finalization: boolean | null;
};

export async function getEffectiveScoreFinalization(
  tournamentId: string,
  orgDefault: boolean | null | undefined,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('tournaments')
    .select('require_score_finalization')
    .eq('id', tournamentId)
    .maybeSingle<TournamentScorePolicyRow>();

  if (error) throw error;

  return data?.require_score_finalization ?? orgDefault ?? false;
}
