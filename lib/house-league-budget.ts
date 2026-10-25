import 'server-only';
import { supabaseAdmin } from './supabase-admin';

/**
 * A house-league season's STARTING BUDGET on the club's plan (Club Tier 9b-2, owner 9b·11; mig 371
 * `club_league_fee_budget_seed`): each division's size × its price, filed under the season's word ("House league
 * registration fees" › the season) in the fiscal year sign-ups open. Planned ONCE — never over a line the treasurer has
 * made or changed (they split it on the Budget page: a line in another year under the same word); a closed year or a
 * season with no sized division plans nothing. Returns the database's answer; never throws (opening registration must
 * not fail for a plan).
 */
export async function seedLeagueSeasonBudget(seasonId: string): Promise<{ ok: boolean; code?: string }> {
  const { data, error } = await supabaseAdmin.rpc('club_league_fee_budget_seed', { p_season: seasonId });
  if (error) {
    console.error('[house-league] starting budget not planned:', error.message);
    return { ok: false, code: 'error' };
  }
  return (data ?? { ok: false }) as { ok: boolean; code?: string };
}
