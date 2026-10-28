import { supabaseAdmin } from './supabase-admin';
import { getGames, getTeams } from './db';
import { computeTournamentStandings, type DivisionStandingRow } from './tie-breakers';
import type { Division, Game, Team, Tournament } from './types';

/**
 * The publish gate for every public tournament read (Stage 0 · D1, 2026-10-27).
 *
 * An organizer publishes a schedule division by division (`divisions.schedule_visibility`, default
 * 'unpublished'). A division they have not published shows NO games anywhere public — the home, the ticker,
 * the schedule, standings, playoffs, champions, the teams list, a game's page, share images, the consumer
 * feeds. The games never leave the server: not hidden in the browser, absent from the response.
 *
 * For standings and records an unpublished division's games count as ABSENT — its teams rank 0-0-0, exactly
 * as the team page has always shown them. A game whose division is not in the list fails closed.
 *
 * `tests/unit/public-games-guard.test.ts` holds every public read to this module.
 */
export function isDivisionSchedulePublished(division: Pick<Division, 'scheduleVisibility'> | null | undefined): boolean {
  return (division?.scheduleVisibility ?? 'unpublished') === 'published';
}

export function publishedDivisionIds(divisions: Pick<Division, 'id' | 'scheduleVisibility'>[]): Set<string> {
  return new Set(divisions.filter(isDivisionSchedulePublished).map(d => d.id));
}

/** Keep only the games of published divisions. */
export function onlyPublishedGames<G extends Pick<Game, 'divisionId'>>(games: G[], divisions: Pick<Division, 'id' | 'scheduleVisibility'>[]): G[] {
  const published = publishedDivisionIds(divisions);
  return games.filter(g => published.has(g.divisionId));
}

/** A tournament's games as the public may see them. `divisions` must be this tournament's divisions. */
export async function getPublicGames(tournamentId: string, divisions: Division[]): Promise<Game[]> {
  return (await readPublicGames(tournamentId, divisions)).games;
}

/**
 * The public games, and whether the organizer is still holding some back. `withheld` is only a yes/no — the held
 * games never leave — and it is what keeps a page from calling the event finished, or crowning it, while a division
 * it cannot show has yet to be published.
 */
export async function readPublicGames(tournamentId: string, divisions: Division[]): Promise<{ games: Game[]; withheld: boolean }> {
  const all = await getGames(tournamentId, { admin: true });
  const games = onlyPublishedGames(all, divisions);
  return { games, withheld: games.length !== all.length };
}

/**
 * Per-division standings from the public games only (the canonical engine, full tie-break chain). Pass the
 * already-gated games and the raw teams when the caller has them, so nothing is read twice.
 */
export async function getPublicStandingsByDivision(
  tournament: Pick<Tournament, 'id' | 'settings'>,
  divisions: Division[],
  read?: { games: Game[]; teams: Team[] },
): Promise<Record<string, DivisionStandingRow[]>> {
  const [games, teams] = read
    ? [onlyPublishedGames(read.games, divisions), read.teams]
    : await Promise.all([getPublicGames(tournament.id, divisions), getTeams(tournament.id, { admin: true })]);
  return Object.fromEntries(divisions.map(d => [
    d.id,
    computeTournamentStandings(d.id, teams, games, d.playoffConfig, tournament.settings),
  ]));
}

/** Does this tournament have a playoff game in a published division? The public site's Playoffs tab (Stage 3
 *  addendum, A63: a bracket built by hand saves no playoff plan, and it is still a bracket a fan should reach). One
 *  joined row, so the layout that wraps every public page can race it against its other reads. */
export async function hasPublicPlayoffGames(tournamentId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('games').select('id, divisions!inner(schedule_visibility)')
    .eq('tournament_id', tournamentId).eq('is_playoff', true)
    .eq('divisions.schedule_visibility', 'published').limit(1);
  return (data?.length ?? 0) > 0;
}

/** One division's publish state, by id — for a server path that holds a game row, not the division list. */
export async function isDivisionPublishedById(divisionId: string | null | undefined): Promise<boolean> {
  if (!divisionId) return false;
  const { data } = await supabaseAdmin.from('divisions').select('schedule_visibility').eq('id', divisionId).maybeSingle();
  return data?.schedule_visibility === 'published';
}
