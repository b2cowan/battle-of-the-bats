import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * House-league ids a route receives in a BODY or QUERY STRING, proven to belong to the season in
 * the URL.
 *
 * Every admin house-league route proves the URL's season belongs to the caller's org with
 * `getLeagueSeasonById(seasonId, orgId)`. That proves nothing about the OTHER ids it is handed:
 * division, team and registration UUIDs are public (they sit in admin URLs and page payloads), so
 * a route that trusts one reads or writes another org's rows — guardian contact details, dates of
 * birth, notes, team placements (Club Tier Readiness plan I01, 2026-09-25). Tie each id back to the
 * season before using it; a foreign id reads as "not found".
 *
 * The schedule, generate and practices routes carried their own inline copies of this check first
 * (J3-era). These are the shared form; `tests/unit/league-season-scope-guard.test.ts` pins that
 * every route which accepts one of these ids calls one of them.
 */

/** The division belongs to this season. */
export async function divisionInSeason(seasonId: string, divisionId: unknown): Promise<boolean> {
  if (typeof divisionId !== 'string' || !divisionId) return false;
  const { data, error } = await supabaseAdmin
    .from('league_divisions')
    .select('id')
    .eq('id', divisionId)
    .eq('season_id', seasonId)
    .maybeSingle();
  return !error && !!data;
}

/** Narrows a check to one division of the season — for a draft, whose pool is one division. */
type Within = { divisionId?: string };

/** Every id is a team of this season (and division, if given). An empty list passes — there is
 *  nothing foreign in it, and every caller's write over an empty list is a no-op. */
export async function teamsInSeason(seasonId: string, teamIds: readonly unknown[], within: Within = {}): Promise<boolean> {
  return allInSeason('league_teams', seasonId, teamIds, within);
}

/** Every id is a registration of this season (and division, if given). An empty list passes. */
export async function registrationsInSeason(seasonId: string, registrationIds: readonly unknown[], within: Within = {}): Promise<boolean> {
  return allInSeason('league_registrations', seasonId, registrationIds, within);
}

// Chunked so a large bulk assignment never builds an `.in()` list past the URL limit.
const CHUNK = 200;

async function allInSeason(
  table: 'league_teams' | 'league_registrations',
  seasonId: string,
  ids: readonly unknown[],
  within: Within,
): Promise<boolean> {
  if (ids.some(id => typeof id !== 'string' || !id)) return false;
  const unique = [...new Set(ids as string[])];
  let found = 0;
  for (let i = 0; i < unique.length; i += CHUNK) {
    let q = supabaseAdmin
      .from(table)
      .select('id')
      .in('id', unique.slice(i, i + CHUNK))
      .eq('season_id', seasonId);
    if (within.divisionId) q = q.eq('division_id', within.divisionId);
    const { data, error } = await q;
    // A malformed UUID is a Postgres cast error, not an empty result — fail closed either way.
    if (error) return false;
    found += (data ?? []).length;
  }
  return found === unique.length;
}
