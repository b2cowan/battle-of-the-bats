import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { getDivisionsForSeason, getLeagueSeasons, getOrgPlaceNames, getSeasonGamesBetween, getSeasonGamesEveryStatus, getTeamsForSeason } from './db';
import { asLastSent, heldGames, lastSentInWindow, sendClaim, type GameSnapshot, type HeldChange, type HeldGame } from './league-game-changes';
import type { LeagueDivision, LeagueGame, LeagueSeason } from './types';
import { addCalendarDays, orgDayKey, tournamentToday, zonedWallClockToUtc } from './timezone';
import { leagueCheckWindow } from './club-game-live';
import { maskProp } from './field-parts';

// The as-last-sent view moved to the pure module (Club Website Stage 1) so its window rule is unit-tested; kept reachable
// here for the readers that import it from this module.
export { asLastSent, snapshotOf, type GameFaceFields } from './league-game-changes';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT FAMILIES SEE OF A SEASON'S GAMES (House League 9d-2b; rulings 9d2·1, 9d2·16; mig 409). The public schedule and the
 * coach's team page read through here, never the raw games:
 *   · only a division whose schedule is PUBLISHED shows games; the rest are "coming" (g2);
 *   · a game with a held change reads as families last heard it (`lastSentView`), and a game added since is not shown.
 * The league admin's own screen reads the games as they are, with the held changes beside them.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

interface ChangeRow {
  id: string; game_id: string; kind: HeldChange['kind']; before: GameSnapshot | null; after: GameSnapshot;
  source: HeldChange['source']; created_at: string;
}
const mapChange = (r: ChangeRow): HeldChange => ({
  id: r.id, gameId: r.game_id, kind: r.kind, before: r.before, after: r.after, source: r.source, createdAt: r.created_at,
});

/** Every change still waiting to be sent in a season (or one division). ⚠ A failed read THROWS (it decides what families see). */
export async function heldChangesOf(seasonId: string, divisionId?: string): Promise<HeldChange[]> {
  const rows = await fetchAll<ChangeRow>((a, b) => {
    let q = supabaseAdmin.from('league_game_changes')
      .select('id, game_id, kind, before, after, source, created_at')
      .eq('season_id', seasonId).is('sent_at', null);
    if (divisionId) q = q.eq('division_id', divisionId);
    return q.order('created_at').order('id').range(a, b);
  });
  return rows.map(mapChange);
}

/** A held game with the division and the two teams it tells (f2's rows and who hears each). */
export interface HeldGameOf extends HeldGame { divisionId: string; homeTeamId: string; awayTeamId: string }

/** What families will be told about a game: something to send, or a game played since (listed, never emailed). */
export const isShownHeld = (g: HeldGame) => !!g.news || g.played;

/**
 * Every held game of a season (or one division), reduced to what it will tell families (`heldGames`) against the game as it
 * is now. `heldRows` is the held rows when the caller has read them already. ⚠ A failed read THROWS.
 */
export async function heldGamesOf(seasonId: string, divisionId?: string, heldRows?: readonly HeldChange[]): Promise<HeldGameOf[]> {
  const held = heldRows ?? await heldChangesOf(seasonId, divisionId);
  if (!held.length) return [];
  // (A mapped type: league-game-changes-guard reads any object key named for the trigger's date as a write of it.)
  type Nullable = 'scheduled_at' | 'ends_at' | 'location' | 'org_venue_id' | 'org_venue_facility_id' | 'moved_from';
  const rows = await fetchAllIn<{ id: string; division_id: string; home_team_id: string; away_team_id: string; status: LeagueGame['status']; section_mask: number | null }
    & { [K in Nullable]: string | null }>([...new Set(held.map(h => h.gameId))], (c, a, b) => supabaseAdmin.from('league_games')
    .select('id, division_id, home_team_id, away_team_id, scheduled_at, ends_at, location, org_venue_id, org_venue_facility_id, section_mask, status, moved_from')
    .in('id', c).order('id').range(a, b));
  const byId = new Map(rows.map(r => [r.id, r]));
  const current = new Map(rows.map(r => [r.id, {
    scheduledAt: r.scheduled_at, endsAt: r.ends_at, location: r.location, venueId: r.org_venue_id,
    facilityId: r.org_venue_facility_id, ...maskProp(r.section_mask), status: r.status, movedFrom: r.moved_from,
  } satisfies GameSnapshot]));
  return heldGames(held, current).flatMap(g => {
    const r = byId.get(g.gameId);
    return r ? [{ ...g, divisionId: r.division_id, homeTeamId: r.home_team_id, awayTeamId: r.away_team_id }] : [];
  });
}

/** A season's active children on these teams, with the guardian's email (the households a send reaches, f2). */
export async function childrenOnTeams(seasonId: string, teamIds: readonly string[]) {
  const rows = await fetchAllIn<{ id: string; team_id: string; guardian_email: string | null; player_first_name: string | null; player_last_name: string | null }>(
    teamIds, (c, a, b) => supabaseAdmin.from('league_registrations')
      .select('id, team_id, guardian_email, player_first_name, player_last_name')
      .eq('season_id', seasonId).eq('status', 'active').in('team_id', c).order('id').range(a, b));
  return rows.map(r => ({
    registrationId: r.id, teamId: r.team_id, email: r.guardian_email ?? '',
    childName: (r.player_first_name ?? '').trim(), lastName: (r.player_last_name ?? '').trim(),
  }));
}

export type SendHeldResult =
  /** `notice`: the games_changed notice whose family rows the send wrote (null when it told nobody). */
  | { refusal: null; families: number; sentAt: string; news: number; notice: string | null }
  | { refusal: 'nothing' | 'changed' | 'finished' }
  | { refusal: 'already'; by: string | null; at: string | null };

/**
 * SEND THE CHANGES (f2), or one urgent cancel or postpone (f5): the held rows the sender saw (`changeIds`) are claimed once,
 * in `league_division_changes_send` (locked on the division, refused `changed` when a change landed or was undone while
 * the window was open). What families are told is worked out HERE from the rows and the game now — never taken from the
 * client — so a stale or edited request can only be refused, not mis-sent.
 */
export async function sendHeldChanges(p: {
  orgId: string; seasonId: string; divisionId: string; actorId: string; changeIds: readonly string[];
}): Promise<SendHeldResult> {
  const named = new Set(p.changeIds);
  const games = (await heldGamesOf(p.seasonId, p.divisionId)).filter(g => g.changeIds.some(id => named.has(id)));
  const { data, error } = await supabaseAdmin.rpc('league_division_changes_send', {
    p_org: p.orgId, p_season: p.seasonId, p_division: p.divisionId, p_actor: p.actorId,
    p_changes: [...named], p_news: sendClaim(games).newsGameIds,
  });
  if (error) throw new Error(`Changes to send didn't save: ${error.message}`);
  const r = (Array.isArray(data) ? data[0] : data) as {
    refusal: string | null; sent_at: string | null; sent_by: string | null; families: number; notice: string | null;
  };
  if (r.refusal === 'already') return { refusal: 'already', by: r.sent_by, at: r.sent_at };
  if (r.refusal === 'nothing' || r.refusal === 'changed' || r.refusal === 'finished') return { refusal: r.refusal };
  return { refusal: null, families: r.families, sentAt: r.sent_at!, news: games.filter(g => g.news).length, notice: r.notice };
}

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE HOUSE LEAGUE PUBLIC RULE (Club Website Stage 1, Pass 1). What a visitor with no account may read of a season:
 *   · the season is not a draft (`isPublicLeagueSeason`) — every public page and route asks THIS, never the status itself;
 *   · a division shows games once its schedule is published (`isDivisionSchedulePublic`) — same;
 *   · a game reads as families last heard it (`asLastSent`).
 * Before Stage 1 the draft check was repeated by each page (nine of them); the schedule had it, and the club home, a tenth
 * reader, would have been one more page that could forget it. A guard (club-website-stage1-reads-guard) holds that no
 * public house-league page or route tests "draft" or `schedulePublishedAt` itself.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Is this house-league season public? A draft season is not: no page names it, no game of it shows. Null → no. */
export function isPublicLeagueSeason<S extends Pick<LeagueSeason, 'status'>>(season: S | null | undefined): season is S {
  return !!season && season.status !== 'draft';
}

/** Is this division's schedule out? Before it is, the schedule says "{division}'s schedule is coming" and no game shows. */
export function isDivisionSchedulePublic(division: Pick<LeagueDivision, 'schedulePublishedAt'>): boolean {
  return !!division.schedulePublishedAt;
}

type PublicSeasonGames = { games: LeagueGame[]; published: Set<string> };

/** The published divisions of a public season, or null when the season shows nothing (a draft, or nothing published). */
function publishedOf(season: Pick<LeagueSeason, 'status'>, divisions: readonly LeagueDivision[]): Set<string> | null {
  if (!isPublicLeagueSeason(season)) return null;
  const published = new Set(divisions.filter(isDivisionSchedulePublic).map(d => d.id));
  return published.size ? published : null;
}

/**
 * The public schedule's games (g2): every status, published divisions only, as families last heard them. The divisions
 * not yet published come back by id, for "{division}'s schedule is coming". A draft season has none.
 */
export async function publicSeasonGames(
  season: Pick<LeagueSeason, 'id' | 'status'>, divisions: readonly LeagueDivision[],
): Promise<PublicSeasonGames> {
  const published = publishedOf(season, divisions);
  if (!published) return { games: [], published: new Set() };
  // ⚠ The games first, THEN the held rows: a change landing between the two reads has its row by the time the rows are read
  // (the trigger writes both in one statement), so it reads as held. The other order shows an unsent date to the public.
  const games = await getSeasonGamesEveryStatus(season.id);
  const held = await heldChangesOf(season.id);
  return { games: asLastSent(games.filter(g => published.has(g.divisionId)), held), published };
}

/** K17's "the last 7 days" (Club Website Stage 2): how long a fresh postponement holds "Needs a new date" at the top. */
export const NEEDS_DATE_ON_TOP_DAYS = 7;

/**
 * Whether any of these games — the public schedule's "Needs a new date", as families last heard it — was postponed in the
 * last 7 days (K17, for every Rainout and every one-off postponement alike). "Postponed" is the moment FAMILIES heard: the
 * postponement's change row SENT since then. Nothing else records when a game was postponed (no column holds it), and a
 * held postponement still reads as on to the public, so the sent time is the honest clock. ⚠ A failed read is false: the
 * section stays where it was, never a broken page.
 */
export async function postponedLately(seasonId: string, gameIds: readonly string[], now: Date = new Date()): Promise<boolean> {
  if (!gameIds.length) return false;
  const since = new Date(now.getTime() - NEEDS_DATE_ON_TOP_DAYS * 86_400_000).toISOString();
  // By the listed games (the game index serves it), the season a second fence; in chunks, so a big Rainout's list never
  // outgrows a request — the day K17 matters most. The first hit answers.
  const ids = [...gameIds];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabaseAdmin.from('league_game_changes')
      .select('id')
      .in('game_id', ids.slice(i, i + 100)).eq('season_id', seasonId).eq('kind', 'postponed').gte('sent_at', since)
      .limit(1);
    if (error) return false;
    if ((data ?? []).length > 0) return true;
  }
  return false;
}

/**
 * The same rule over a window of time, [fromIso, toIso) — "today and the two days before" for the club home (Stage 1 G2)
 * — reading the window (by start, and by the day a game was moved off, which the database keeps on every re-date) and the
 * held changes, instead of the whole season. Same order as `publicSeasonGames`: the games first, then the held rows.
 */
export async function publicSeasonGamesBetween(
  season: Pick<LeagueSeason, 'id' | 'status'>, divisions: readonly LeagueDivision[], fromIso: string, toIso: string,
): Promise<PublicSeasonGames> {
  const published = publishedOf(season, divisions);
  if (!published) return { games: [], published: new Set() };
  const games = (await getSeasonGamesBetween(season.id, fromIso, toIso)).filter(g => published.has(g.divisionId));
  // No game in the window (by start or by the day one was moved off): nothing for a held change to put back.
  if (games.length === 0) return { games: [], published };
  const held = await heldChangesOf(season.id);
  return { games: lastSentInWindow(games, held, fromIso, toIso), published };
}

/**
 * When a house league page that shows no games of its own (the standings, the season page) checks for scores today (Club
 * Website Stage 1, G6): its season's games today through this rule, then `leagueCheckWindow`. A failed read is null — the
 * page simply does not check, it never fails for it. The schedule has the season's games already and asks
 * `leagueCheckWindow` itself.
 */
export async function publicSeasonCheckWindow(
  season: Pick<LeagueSeason, 'id' | 'status' | 'seasonStartDate' | 'seasonEndDate'>, divisions: readonly LeagueDivision[], now: Date = new Date(),
): Promise<{ from: string; to: string } | null> {
  const today = tournamentToday(now);
  // A season that cannot play today is not read at all (most visits to an old season's page).
  if (!mayPlayIn(season, today, today)) return null;
  const fromIso = zonedWallClockToUtc(today, '00:00');
  const toIso = zonedWallClockToUtc(addCalendarDays(today, 1), '00:00');
  if (!fromIso || !toIso) return null;
  try {
    const { games } = await publicSeasonGamesBetween(season, divisions, fromIso, toIso);
    return leagueCheckWindow(games, now.getTime());
  } catch (error) {
    console.error('[league] check window read failed', { seasonId: season.id, error });
    return null;
  }
}

/** One public season's games in a window, with what a row names: its divisions (in the season's order) and teams. */
export interface PublicLeagueSeasonGames {
  season: Pick<LeagueSeason, 'id' | 'name' | 'slug'>;
  divisions: LeagueDivision[];
  teamName: Map<string, string>;
  games: LeagueGame[];
}

/**
 * Can a season have a game in a window that ends on `toDay` and starts on `fromDay` (club days)? Only to skip reads: an
 * archived season, one that has not started by the window's end, or one COMPLETED before the window starts. A live season
 * is read whatever its end date says — a make-up game can fall after it.
 */
function mayPlayIn(season: Pick<LeagueSeason, 'status' | 'seasonStartDate' | 'seasonEndDate'>, fromDay: string, toDay: string): boolean {
  if (season.status === 'archived') return false;
  if (season.seasonStartDate && season.seasonStartDate > toDay) return false;
  return !(season.status === 'completed' && season.seasonEndDate && season.seasonEndDate < fromDay);
}

/**
 * A club's house-league games in [fromIso, toIso), through the rule above, for the club home's one games read: every
 * PUBLIC season (`isPublicLeagueSeason`) that may play in the window, its published divisions only, as families last heard
 * them. A season with no game in the window is left out. ⚠ ALL OR NOTHING: every read here throws on a failure (the
 * home's read, Stage 1 G11), so a failed read can never look like a quiet day.
 * Trips per season: the divisions and the window together, then the held rows (after the games, as above) and the teams.
 */
export async function publicLeagueGamesBetween(orgId: string, fromIso: string, toIso: string): Promise<{
  seasons: PublicLeagueSeasonGames[];
  /** The club's places by id (a closed one's too), read only when a game is found. */
  places: Awaited<ReturnType<typeof getOrgPlaceNames>>;
}> {
  const fromDay = orgDayKey(fromIso), toDay = orgDayKey(toIso);
  const seasons = (await getLeagueSeasons(orgId, { strict: true }))
    .filter(isPublicLeagueSeason)
    .filter(s => mayPlayIn(s, fromDay, toDay));
  const out = await Promise.all(seasons.map(async season => {
    const [divisions, games] = await Promise.all([
      getDivisionsForSeason(season.id, { strict: true }),
      getSeasonGamesBetween(season.id, fromIso, toIso),
    ]);
    const published = publishedOf(season, divisions);
    const mine = published ? games.filter(g => published.has(g.divisionId)) : [];
    if (!mine.length) return null;
    const [held, teams] = await Promise.all([heldChangesOf(season.id), getTeamsForSeason(season.id, { strict: true })]);
    const shown = lastSentInWindow(mine, held, fromIso, toIso);
    return shown.length ? {
      season: { id: season.id, name: season.name, slug: season.slug },
      divisions, games: shown, teamName: new Map(teams.map(t => [t.id, t.name])),
    } : null;
  }));
  const found = out.filter((x): x is PublicLeagueSeasonGames => x !== null);
  return { seasons: found, places: found.length ? await getOrgPlaceNames(orgId) : { venues: new Map(), facilities: new Map(), sections: new Map() } };
}
