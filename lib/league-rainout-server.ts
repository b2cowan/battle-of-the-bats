import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { getOrgPlaceNames } from './db';
import { childrenOnTeams } from './league-game-changes-server';
import { familiesFor, teamsHearing } from './league-game-changes';
import { tournamentToday, zonedWallClockToUtc } from './timezone';
import type { RainGame, RainSource, RainVerb, WaitingRainout } from './league-rainout';

/**
 * RAINOUT, THE SERVER'S READS (House League 9e-2; mig 427). The window's own read of the season (not the page's
 * division-scoped list: a rainout spans divisions), the club's line for the emails that send a rainout's changes, and
 * the rainouts Put all back would still restore (the banner).
 */

/** Everything the Rainout window plans from: today on, every division, the families as team sets (no email leaves). */
export async function rainoutSource(orgId: string, seasonId: string): Promise<RainSource> {
  const today = tournamentToday();
  const from = zonedWallClockToUtc(today, '00:00') ?? new Date().toISOString();
  const [divisions, gameRows, practiceRows, places] = await Promise.all([
    supabaseAdmin.from('league_divisions').select('id, name, sort_order, schedule_published_at')
      .eq('season_id', seasonId).order('sort_order', { ascending: true }).order('name'),
    fetchAll<{ id: string; division_id: string; home_team_id: string; away_team_id: string; scheduled_at: string;
      location: string | null; org_venue_id: string | null; org_venue_facility_id: string | null; updated_at: string }>((a, b) =>
      supabaseAdmin.from('league_games')
        .select('id, division_id, home_team_id, away_team_id, scheduled_at, location, org_venue_id, org_venue_facility_id, updated_at')
        .eq('season_id', seasonId).eq('org_id', orgId).eq('status', 'scheduled').gte('scheduled_at', from)
        .order('id').range(a, b)),
    fetchAll<{ scheduled_at: string; club_schedule_slot_id: string | null }>((a, b) =>
      supabaseAdmin.from('league_practices').select('scheduled_at, club_schedule_slot_id')
        .eq('season_id', seasonId).eq('org_id', orgId).neq('status', 'cancelled').gte('scheduled_at', from)
        .order('id').range(a, b)),
    getOrgPlaceNames(orgId),
  ]);
  if (divisions.error) throw divisions.error;

  const games: RainGame[] = gameRows.map(g => {
    const venue = g.org_venue_id ? places.venues.get(g.org_venue_id) : null;
    return {
      id: g.id, divisionId: g.division_id, homeTeamId: g.home_team_id, awayTeamId: g.away_team_id,
      scheduledAt: g.scheduled_at,
      place: venue?.name ?? (g.location?.trim() || null),
      field: venue && g.org_venue_facility_id ? places.facilities.get(g.org_venue_facility_id) ?? null : null,
      seen: g.updated_at,
    };
  });

  // The families of the teams playing from today on (the send's own grouping), each as the set of its children's teams.
  const playing = teamsHearing(games);
  const families = familiesFor(playing.size ? await childrenOnTeams(seasonId, [...playing]) : [], playing);

  return {
    today,
    divisions: (divisions.data ?? []).map(d => ({ id: d.id as string, name: d.name as string, published: !!d.schedule_published_at })),
    games,
    practices: practiceRows.map(p => ({ scheduledAt: p.scheduled_at, club: !!p.club_schedule_slot_id })),
    families: [...families.values()].map(kids => [...new Set(kids.map(c => c.teamId))]),
  };
}

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

/** The banner: the season's rainouts Put all back would restore now (mig 427's one rule), optionally one division's. */
export async function rainoutsWaiting(orgId: string, seasonId: string, divisionId?: string): Promise<WaitingRainout[]> {
  const { data, error } = await supabaseAdmin.rpc('league_rainouts_waiting', { p_org: orgId, p_season: seasonId, p_division: divisionId ?? null });
  if (error) throw error;
  return ((data ?? []) as { id: string; day: string; verb: RainVerb; games: number; division_ids: string[] }[])
    .map(r => ({ id: r.id, day: r.day, verb: r.verb, games: r.games, divisionIds: r.division_ids }));
}

/** A rainout record, scoped to its season. */
export async function rainoutOf(orgId: string, seasonId: string, rainoutId: string) {
  const { data, error } = await supabaseAdmin.from('league_rainouts')
    .select('id, day, verb, game_ids, division_ids, change_ids, put_back_at')
    .eq('id', rainoutId).eq('season_id', seasonId).eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  return data as { id: string; day: string; verb: RainVerb; game_ids: string[]; division_ids: string[]; change_ids: string[]; put_back_at: string | null } | null;
}
