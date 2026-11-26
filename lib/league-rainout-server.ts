import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAllIn } from './supabase-paging';
import type { RainVerb, WaitingRainout } from './league-rainout';

/**
 * RAINOUT, THE SERVER'S READS (House League 9e-2; mig 427). The club's line for the emails that send a rainout's changes,
 * and the rainouts still waiting (the banner). The one-season window's own read left with the window (Club Website Stage 2,
 * K14: Close a place reads every program, `lib/place-closure-window-server.ts`).
 */

/**
 * THE CLUB'S LINE (9e·14) for an email that sends these change rows: the line of every rainout that made one of them, in
 * the order they were pressed (two held rainouts sent together carry both). Read at send time, by any press.
 */
export async function rainoutLinesFor(changeIds: readonly string[]): Promise<string[]> {
  if (!changeIds.length) return [];
  // ⚖ NEVER THROWS: rain news without the club's line beats rain news that waits. A failed read logs and sends without it.
  try {
    const rows = await fetchAllIn<{ line: string | null; created_at: string }>([...changeIds], (c, a, b) =>
      supabaseAdmin.from('league_rainouts').select('line, created_at').overlaps('change_ids', c)
        .not('line', 'is', null).is('put_back_at', null).order('created_at').order('id').range(a, b));
    return [...new Set(rows.sort((x, y) => x.created_at.localeCompare(y.created_at)).map(r => r.line!))];
  } catch (err) {
    console.error('[league-rainout] the club\'s line was not read (the email goes without it):', err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * The banner: the season's rainouts still waiting to be sent (mig 427's one rule), optionally one division's. A CLOSED
 * PLACE's record (Club Website Stage 2, mig 539's `closure_id`) waits here only when its send failed: the banner retries it
 * through Changes to send's Send, and never offers Put all back (K5: the site already says the place is closed).
 */
export async function rainoutsWaiting(orgId: string, seasonId: string, divisionId?: string): Promise<WaitingRainout[]> {
  const { data, error } = await supabaseAdmin.rpc('league_rainouts_waiting', { p_org: orgId, p_season: seasonId, p_division: divisionId ?? null });
  if (error) throw error;
  const rows = (data ?? []) as { id: string; day: string; verb: RainVerb; games: number; division_ids: string[] }[];
  const closures = new Set<string>();
  if (rows.length) {
    const { data: c, error: cErr } = await supabaseAdmin.from('league_rainouts').select('id').in('id', rows.map(r => r.id)).not('closure_id', 'is', null);
    if (cErr) throw cErr;
    for (const r of (c ?? []) as { id: string }[]) closures.add(r.id);
  }
  return rows.map(r => ({ id: r.id, day: r.day, verb: r.verb, games: r.games, divisionIds: r.division_ids, closure: closures.has(r.id) }));
}

/** A rainout record, scoped to its season. */
export async function rainoutOf(orgId: string, seasonId: string, rainoutId: string) {
  const { data, error } = await supabaseAdmin.from('league_rainouts')
    .select('id, day, verb, game_ids, division_ids, change_ids, put_back_at, closure_id')
    .eq('id', rainoutId).eq('season_id', seasonId).eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  return data as { id: string; day: string; verb: RainVerb; game_ids: string[]; division_ids: string[]; change_ids: string[]; put_back_at: string | null; closure_id: string | null } | null;
}
