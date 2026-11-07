import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { FINISHED_LEAGUE_SEASON_STATUSES } from './house-league-access';

/**
 * THE CLUB'S HOUSE-LEAGUE WAITING COUNT (Club Tier Stage 13a Session B, B2): registrations in `pending_review` — the only
 * undecided state — on every season that is not finished, i.e. exactly where the house-league gate still lets the desk
 * work one. The club brief (rail row, phone tab, Overview card) and the attention summary (the Overview's waiting line)
 * both read it here, so they cannot disagree. ⚠ The summary used to ask for 'pending', which no registration holds, so
 * that line could never show (found and fixed 2026-11-06).
 */

/** PostgREST's `not in` list for the finished states, from the gate's own list. */
const FINISHED = `(${FINISHED_LEAGUE_SEASON_STATUSES.join(',')})`;

/** The brief's number. ONE head count (no rows) by the registrations' org index. Throws on a read error. */
export async function countLeagueRegistrationsWaiting(orgId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('league_registrations')
    .select('id, league_seasons!inner(status)', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'pending_review')
    .not('league_seasons.status', 'in', FINISHED);
  if (error) throw error;
  return count ?? 0;
}

/**
 * The Overview line's number AND its door — the live season holding the OLDEST waiting registration — in one query (the
 * exact count rides along with the one row). Throws on a read error.
 */
export async function leagueRegistrationsWaitingLine(orgId: string): Promise<{ count: number; oldestSeasonId: string | null }> {
  const { data, count, error } = await supabaseAdmin
    .from('league_registrations')
    .select('season_id, league_seasons!inner(status)', { count: 'exact' })
    .eq('org_id', orgId)
    .eq('status', 'pending_review')
    .not('league_seasons.status', 'in', FINISHED)
    .order('registered_at', { ascending: true })
    .limit(1);
  if (error) throw error;
  return { count: count ?? 0, oldestSeasonId: (data?.[0] as { season_id: string } | undefined)?.season_id ?? null };
}
