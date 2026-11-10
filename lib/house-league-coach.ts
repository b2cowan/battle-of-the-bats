import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll } from './supabase-paging';
import type { FeedTeamEvent } from './export/team-feed-words';
import {
  coachPageOpenUntil, houseLeagueCoachAccess, type HouseLeagueCoachLink, type HouseLeagueCoachView,
} from './house-league-access';
import { clubPublicContact } from './club-email-context';
import { orgDayKey, zonedWallClockToUtc } from './timezone';
import { publicState } from './league-game-changes';
import { asLastSent, heldChangesOf, type GameFaceFields } from './league-game-changes-server';
import { computeStandings, getOrgPlaceNames } from './db';
import { coachStandingLine, type CoachStandingLine, type LeagueStandings } from './league-standings';
import { resultWords } from './league-season-calendar';
import { readPracticesNow, readTold } from './league-practice-tell-server';
import { coachToldLine, tellStateOf, type CoachToldLine, type TeamTellState } from './league-practice-tell';
import { coachScoreView, type CoachScoreRow } from './league-coach-scores';
import { readScoreRecords } from './league-coach-scores-server';
import type { LeagueGame } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A HOUSE-LEAGUE COACH READS (Club Tier Stage 9c, ruling 9c·1 + 9c·9; the coach column of the one gate).
 *
 * A coach is a row of league_team_coaches carrying their user id once they accept. They read ONE thing: their team's
 * accepted players and each family's guardian name, email and phone. Never a rating, a fee, a note, another team, or a
 * child who has left. The player read below names its columns and filters on the team the access check approved, so a
 * coach of the Jays reads nothing of the Cardinals (tests/unit/house-league-coach-read-guard.test.ts).
 *
 * No Coaches Portal: a house-league coach has no club membership from this (lib/user-contexts.ts builds their card
 * from these rows), and nothing here touches the portal.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The ONLY registration columns a coach's page reads. Adding one here is a decision about children's data (9c·9). */
export const COACH_PLAYER_COLUMNS =
  'id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, guardian_email, guardian_email_2, guardian_phone' as const;

export interface CoachTeamCard {
  teamId: string;
  teamName: string;
  divisionName: string;
  seasonName: string;
  seasonSlug: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
}

export interface CoachPlayer {
  id: string;
  firstName: string;
  lastName: string;
  guardianName: string;
  guardianEmail: string;
  /** The second parent's email (Signed-in family accounts Stage 3, ask 5: the coach sees it; the form says so). */
  guardianEmail2: string | null;
  guardianPhone: string | null;
}

export interface CoachTeamPage {
  view: HouseLeagueCoachView;
  team: CoachTeamCard;
  coaches: string[];
  /** Empty unless the view is open or finished. */
  players: CoachPlayer[];
  /** A finished season: the day the page closes (copy §10.3). */
  openUntil: string | null;
  contactEmail: string | null;
  /** Every team this person coaches now, for the switcher (copy §10.2), this one included. */
  myTeams: CoachTeamCard[];
  /** The team's practices from today on (Club Tier Stage 11b Part 4, 11b·C): a live season only. */
  practices: CoachPractice[];
  /** The team's games (House League 9d-2b Part 5, 9d2·7): a live season only, and only once the division's schedule is
   *  published — as families last heard them, never a change still waiting to be sent. */
  games: CoachGame[];
  /** False while the division's schedule is a draft: "{division}'s schedule isn't published yet." */
  gamesPublished: boolean;
  /** Whether the families know these practice times (9d-3 Part 5, frame b2): a live season only; null = no line. */
  practiceTold: CoachToldLine | null;
  /** The team's place in its division (9e-1, 9e·6): a live season, a published schedule and standings on; null = no line. */
  standing: (CoachStandingLine & { divisionId: string }) | null;
  /** The Scores section (9e-3): every started game of the team, newest first, each from its LIVE row — a published
   *  division only. A finished season lists them with no doors (Q16). */
  scores: CoachScoreRow[];
  /** The division's "Show standings": the section's foot and the window's words say where a score counts. */
  scoresStandings: boolean;
}

/** A game on the coach's page (g3): from today on, or waiting for a new date (postponed, or saved with no date). */
export interface CoachGame {
  id: string;
  /** Null: a game saved with no date ("Date to come"). A postponed game keeps the date it had ("Was …"). */
  startsAt: string | null;
  /** "Twins vs Royals". */
  title: string;
  /** "Maple Grove Park · Diamond 2", or the typed place. */
  place: string | null;
  state: 'on' | 'cancelled' | 'postponed';
  /** Re-dated since families first heard, once sent: the date they heard ("Moved · Was …"). */
  movedFrom: string | null;
  /** "Final 7–4". */
  result: string | null;
}

/** A practice on the coach's page: handed out from the club's time ("From {schedule}") or booked by hand (null). */
export interface CoachPractice {
  id: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  fromSchedule: string | null;
  fromClub: boolean;
  cancelled: boolean;
}

interface LinkRow {
  team_id: string;
  user_id: string | null;
  accepted_at: string | null;
  removed_at: string | null;
}

/** The team's division as the coach read joins it: its name, and whether families see its schedule and its table. */
interface TeamDivision { name: string; schedule_published_at: string | null; show_standings: boolean | null }

interface TeamRow {
  id: string;
  name: string;
  season_id: string;
  division_id: string | null;
  league_divisions: TeamDivision | TeamDivision[] | null;
  league_seasons: {
    name: string; slug: string; status: string; finished_at: string | null; org_id: string; sport: string | null;
    organizations: { slug: string; name: string } | { slug: string; name: string }[] | null;
  } | null;
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

const TEAM_SELECT =
  'id, name, season_id, division_id, league_divisions(name, schedule_published_at, show_standings), league_seasons(name, slug, status, finished_at, org_id, sport, organizations(slug, name))';

function toCard(t: TeamRow): CoachTeamCard | null {
  const season = t.league_seasons;
  const org = one(season?.organizations);
  if (!season || !org) return null;
  return {
    teamId: t.id, teamName: t.name, divisionName: one(t.league_divisions)?.name ?? '',
    seasonName: season.name, seasonSlug: season.slug, orgId: season.org_id, orgSlug: org.slug, orgName: org.name,
  };
}

const toLink = (r: LinkRow): HouseLeagueCoachLink => ({
  teamId: r.team_id, userId: r.user_id, acceptedAt: r.accepted_at, removedAt: r.removed_at,
});

/** One team with its division, season and club, and the card they make — the page's read and the calendar's. */
async function readTeamRow(teamId: string): Promise<{ team: TeamRow; card: CoachTeamCard } | null> {
  const { data, error } = await supabaseAdmin.from('league_teams').select(TEAM_SELECT).eq('id', teamId).maybeSingle();
  if (error) throw new Error(`Couldn't read the team: ${error.message}`);
  const team = data as unknown as TeamRow | null;
  const card = team ? toCard(team) : null;
  return team && card ? { team, card } : null;
}

/**
 * The teams this person coaches whose page is still there: a live season, or one that finished in the last 30 days.
 * One sign-in card per team (copy §10.1).
 */
export async function getCoachTeamCards(userId: string, now: Date = new Date()): Promise<CoachTeamCard[]> {
  const { data: links, error } = await supabaseAdmin.from('league_team_coaches')
    .select('team_id, user_id, accepted_at, removed_at')
    .eq('user_id', userId).is('removed_at', null).not('accepted_at', 'is', null);
  if (error) throw new Error(`Couldn't read coaching links: ${error.message}`);
  const teamIds = [...new Set((links ?? []).map(l => l.team_id as string))];
  if (teamIds.length === 0) return [];
  const { data: teams, error: teamError } = await supabaseAdmin.from('league_teams').select(TEAM_SELECT).in('id', teamIds);
  if (teamError) throw new Error(`Couldn't read coached teams: ${teamError.message}`);
  const cards: CoachTeamCard[] = [];
  for (const team of (teams ?? []) as unknown as TeamRow[]) {
    const season = team.league_seasons;
    const view = houseLeagueCoachAccess((links ?? []).map(l => toLink(l as LinkRow)), userId, team.id,
      season ? { status: season.status, finishedAt: season.finished_at } : null, now);
    if (view !== 'open' && view !== 'finished') continue;
    const card = toCard(team);
    if (card) cards.push(card);
  }
  return cards.sort((a, b) => a.seasonName.localeCompare(b.seasonName) || a.teamName.localeCompare(b.teamName));
}

/**
 * One coach's page for one team, or null when they never coached it (a 404: not even that the team exists).
 * The org slug from the URL must match the team's club.
 */
export async function readCoachTeamPage(
  userId: string, orgSlug: string, teamId: string, now: Date = new Date(),
): Promise<CoachTeamPage | null> {
  // An address that is not a team's id is not found, not an error.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId)) return null;
  const { data: links, error } = await supabaseAdmin.from('league_team_coaches')
    .select('team_id, user_id, accepted_at, removed_at').eq('user_id', userId).eq('team_id', teamId);
  if (error) throw new Error(`Couldn't read the coaching link: ${error.message}`);
  if (!links || links.length === 0) return null;

  const found = await readTeamRow(teamId);
  if (!found || found.card.orgSlug !== orgSlug) return null;
  const { team, card } = found;

  const season = team.league_seasons!;
  const view = houseLeagueCoachAccess(links.map(l => toLink(l as LinkRow)), userId, teamId,
    { status: season.status, finishedAt: season.finished_at }, now);
  if (view === 'none') return null;

  const division = one(team.league_divisions);
  // The standing line (9e·6): the division's schedule published and its "Show standings" on — else absent. On a finished
  // season's page it is the final place (9f·6), from the same live table (9f·2: nothing is stored).
  const ranks = (view === 'open' || view === 'finished') && !!team.division_id && !!division?.schedule_published_at && division.show_standings !== false;
  const scored = (view === 'open' || view === 'finished') && !!team.division_id && !!division?.schedule_published_at;
  const [coachRows, players, myTeams, contactEmail, practices, games, tell, standings, scores] = await Promise.all([
    view === 'gone' ? Promise.resolve([] as { name: string }[]) : readCoachNames(teamId),
    view === 'open' || view === 'finished' ? readTeamPlayers(teamId) : Promise.resolve([] as CoachPlayer[]),
    getCoachTeamCards(userId, now),
    clubPublicContact(card.orgId),
    view === 'open' ? readTeamPractices(card.orgId, teamId, now) : Promise.resolve([] as CoachPractice[]),
    view === 'open' && team.division_id && division?.schedule_published_at
      ? readTeamGames(card.orgId, team.season_id, team.division_id, teamId, now)
      : Promise.resolve({ published: false, games: [] as CoachGame[] }),
    view === 'open' ? readTellOf(card.orgId, teamId) : Promise.resolve(null),
    ranks ? computeStandings(team.division_id!, season.sport) : Promise.resolve(null),
    scored ? readTeamScores(card.orgId, team.division_id!, teamId, userId, now, view === 'open') : Promise.resolve([] as CoachScoreRow[]),
  ]);
  const practiceTold = tell && coachToldLine({
    state: tell.state, toldAt: tell.at, listed: practices.length,
    // Only asked when it decides the line: nothing listed, never told.
    everHad: tell.state === 'none' && practices.length === 0 ? await everHadPractice(card.orgId, teamId) : true,
  });
  const until = coachPageOpenUntil(season.finished_at, now);
  return {
    view, team: card, coaches: coachRows.map(c => c.name), players,
    openUntil: view === 'finished' && until ? until.toISOString() : null,
    contactEmail,
    myTeams,
    practices,
    games: games.games,
    gamesPublished: games.published,
    practiceTold,
    standing: standingOf(standings, teamId, team.division_id, view === 'finished'),
    scores,
    scoresStandings: division?.show_standings !== false,
  };
}

/**
 * THE SCORES SECTION'S READ (House League 9e-3): the team's started games that are on, newest first, each from its LIVE
 * row — not as last sent, so a game the club rained out an hour ago (held or sent) is not listed and offers no "Enter the
 * score" (the Schedule's read above is the families' view and stays so). Each with its score record and the viewer's
 * side: they coach the home team (a coach of both teams is the home coach). `live` false (a finished season): no doors.
 * ⚠ A failed read THROWS.
 */
async function readTeamScores(orgId: string, divisionId: string, teamId: string, userId: string, now: Date, live: boolean): Promise<CoachScoreRow[]> {
  const [gameRes, teamRes, seatRes, places] = await Promise.all([
    supabaseAdmin.from('league_games')
      .select('id, home_team_id, away_team_id, scheduled_at, location, org_venue_id, org_venue_facility_id, status, home_score, away_score, updated_at')
      // The team id was checked as a UUID before any read (readCoachTeamPage), so the filter string is safe.
      .eq('org_id', orgId).eq('division_id', divisionId).or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .in('status', ['scheduled', 'completed']).lte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: false }).order('id').limit(500),
    supabaseAdmin.from('league_teams').select('id, name').eq('division_id', divisionId),
    // This person's own live seats — their id, nobody else's — to know whether they also coach the other team.
    supabaseAdmin.from('league_team_coaches').select('team_id, name').eq('user_id', userId).is('removed_at', null).not('accepted_at', 'is', null),
    getOrgPlaceNames(orgId),
  ]);
  for (const r of [gameRes, teamRes, seatRes]) if (r.error) throw new Error(`Couldn't read the team's scores: ${r.error.message}`);
  type Row = { id: string; home_team_id: string; away_team_id: string; scheduled_at: string; location: string | null; org_venue_id: string | null;
    org_venue_facility_id: string | null; status: LeagueGame['status']; home_score: number | null; away_score: number | null; updated_at: string };
  const rows = (gameRes.data ?? []) as Row[];
  const records = await readScoreRecords(orgId, rows.map(r => r.id));
  const teamName = new Map(((teamRes.data ?? []) as { id: string; name: string }[]).map(t => [t.id, t.name]));
  const seatName = new Map(((seatRes.data ?? []) as { team_id: string; name: string }[]).map(s => [s.team_id, s.name]));
  const placeOf = placeNamer(places);
  const nowMs = now.getTime();
  return rows.map(r => {
    const game = { status: r.status, scheduledAt: r.scheduled_at, homeScore: r.home_score, awayScore: r.away_score };
    const names = { home: teamName.get(r.home_team_id) ?? 'A team', away: teamName.get(r.away_team_id) ?? 'A team' };
    const home = seatName.has(r.home_team_id);
    const view = coachScoreView(game, records.get(r.id) ?? null, { userId, home }, names, nowMs);
    return {
      gameId: r.id, startsAt: r.scheduled_at, homeName: names.home, awayName: names.away,
      place: placeOf({ orgVenueId: r.org_venue_id, orgVenueFacilityId: r.org_venue_facility_id, location: r.location }),
      home, homeScore: r.home_score, awayScore: r.away_score,
      view: live ? view : { ...view, door: null },
      seen: r.updated_at, enteredAs: home ? seatName.get(r.home_team_id) ?? null : null,
    };
  }).filter(r => r.view.state !== 'notStarted' && r.view.state !== 'calledOff');
}

/** "Maple Grove Park · Diamond 2", or the typed place: the club's venue names for a game's place. */
function placeNamer(places: Awaited<ReturnType<typeof getOrgPlaceNames>>) {
  return (g: Pick<GameFaceFields, 'orgVenueId' | 'orgVenueFacilityId' | 'location'>) => {
    const venue = g.orgVenueId ? places.venues.get(g.orgVenueId)?.name : null;
    if (!venue) return g.location || null;
    const facility = g.orgVenueFacilityId ? places.facilities.get(g.orgVenueFacilityId) : null;
    return facility ? `${venue} · ${facility}` : venue;
  };
}

/**
 * The coach's standing line, with the division it links to ("See the standings" opens that division's table). A finished
 * season's line is "Final place: …"; with nothing scored it writes no line at all (copy 9f §5 `coach.final.none`).
 */
function standingOf(standings: LeagueStandings | null, teamId: string, divisionId: string | null, final: boolean) {
  const line = standings && divisionId ? coachStandingLine(standings, teamId, { final }) : null;
  if (final && line?.kind === 'none') return null;
  return line && divisionId ? { ...line, divisionId } : null;
}

/** The team's told state (9d-3): its upcoming practices against what its families were told — the Tell step's rule. */
async function readTellOf(orgId: string, teamId: string): Promise<{ state: TeamTellState; at: string | null }> {
  const [now, told] = await Promise.all([readPracticesNow(orgId, [teamId]), readTold([teamId])]);
  const row = told.get(teamId) ?? null;
  return { state: tellStateOf(now.get(teamId) ?? [], row, Date.now()), at: row?.at ?? null };
}

/** Whether the team ever had a practice (cancelled and past ones count): "Nobody has handed any out" must be true. */
async function everHadPractice(orgId: string, teamId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin.from('league_practices')
    .select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('team_id', teamId);
  if (error) throw new Error(`Couldn't read the team's practices: ${error.message}`);
  return (count ?? 0) > 0;
}

/**
 * The team's games as families know them (9d2·7, g3), read once the division's schedule is published (the caller checks
 * the mark on the team's own division read): the team's games from the start of today in the club's zone — and every
 * game waiting for a new date, whatever its old day — each as last SENT (a held change shows only once the league admin sends it; a game added since isn't shown).
 * ⚠ A failed read THROWS: "No games from today on" must never stand in for a read that failed.
 */
async function readTeamGames(orgId: string, seasonId: string, divisionId: string, teamId: string, now: Date): Promise<{ published: boolean; games: CoachGame[] }> {
  const { games, name, placeOf } = await readGamesAsSent(orgId, seasonId, divisionId, teamId);
  const from = Date.parse(zonedWallClockToUtc(orgDayKey(now.toISOString()), '00:00') ?? now.toISOString());
  return {
    published: true,
    games: games
      .filter(g => g.status === 'postponed' || !g.scheduledAt || Date.parse(g.scheduledAt) >= from)
      .map(g => ({
        id: g.id, startsAt: g.scheduledAt, title: `${name(g.homeTeamId)} vs ${name(g.awayTeamId)}`, place: placeOf(g),
        state: publicState(g.status),
        movedFrom: g.movedFrom, result: resultWords(g),
      })),
  };
}

/** The team's games, every one, each as last SENT (the coach's page and the coach's calendar read this one read). */
async function readGamesAsSent(orgId: string, seasonId: string, divisionId: string, teamId: string) {
  const [gameRes, teamRes, places] = await Promise.all([
    supabaseAdmin.from('league_games')
      .select('id, home_team_id, away_team_id, scheduled_at, ends_at, location, org_venue_id, org_venue_facility_id, status, moved_from, home_score, away_score')
      // The team id was checked as a UUID before any read (readCoachTeamPage), so the filter string is safe.
      .eq('org_id', orgId).eq('division_id', divisionId).or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order('scheduled_at', { nullsFirst: false }).order('id').limit(500),
    supabaseAdmin.from('league_teams').select('id, name').eq('division_id', divisionId),
    getOrgPlaceNames(orgId),
  ]);
  if (gameRes.error) throw new Error(`Couldn't read the team's games: ${gameRes.error.message}`);
  // ⚠ The held rows AFTER the games (see publicSeasonGames): a change landing between the reads has its row by now.
  const held = await heldChangesOf(seasonId, divisionId);
  if (teamRes.error) throw new Error(`Couldn't read the division's teams: ${teamRes.error.message}`);
  type Row = { id: string; home_team_id: string; away_team_id: string; status: LeagueGame['status']; home_score: number | null; away_score: number | null }
    & { [K in 'scheduled_at' | 'ends_at' | 'location' | 'org_venue_id' | 'org_venue_facility_id' | 'moved_from']: string | null };
  const games = ((gameRes.data ?? []) as Row[]).map(r => ({
    id: r.id, homeTeamId: r.home_team_id, awayTeamId: r.away_team_id, scheduledAt: r.scheduled_at, endsAt: r.ends_at,
    location: r.location, orgVenueId: r.org_venue_id, orgVenueFacilityId: r.org_venue_facility_id, status: r.status,
    movedFrom: r.moved_from, homeScore: r.home_score, awayScore: r.away_score,
  } satisfies GameFaceFields & Pick<LeagueGame, 'homeTeamId' | 'awayTeamId' | 'homeScore' | 'awayScore'>));
  const teamName = new Map(((teamRes.data ?? []) as { id: string; name: string }[]).map(t => [t.id, t.name]));
  const name = (id: string) => teamName.get(id) ?? 'A team';
  return { games: asLastSent(games, held), name, placeOf: placeNamer(places) };
}

/**
 * THE COACH'S CALENDAR (House League 9d-3 Part 6, 9d3·5): the team's whole season as the feed's entries — the games as
 * last SENT once the division's schedule is published (a held change is never in a feed), and every practice, a cancelled
 * one marked. The whole season, not "from today": a subscribed calendar that drops last week reads as lost. A postponed
 * game is KEPT on the day it had, marked 'postponed' (recipe F3, owner 2026-11-10 — Prospect Demo P2b), so the family page
 * says "Postponed · new date to come" and a calendar shows it as free time instead of losing it; it moves when it is
 * re-dated. A game with no date at all is still left out until it has one.
 */
export async function readCoachFeedEvents(p: {
  orgId: string; seasonId: string; divisionId: string | null; schedulePublished: boolean; teamId: string;
}): Promise<FeedTeamEvent[]> {
  const [sent, practices] = await Promise.all([
    p.divisionId && p.schedulePublished ? readGamesAsSent(p.orgId, p.seasonId, p.divisionId, p.teamId) : Promise.resolve(null),
    fetchAll<{ id: string; scheduled_at: string; ends_at: string | null; location: string | null; status: string }>((a, b) =>
      supabaseAdmin.from('league_practices').select('id, scheduled_at, ends_at, location, status')
        .eq('org_id', p.orgId).eq('team_id', p.teamId).order('scheduled_at').order('id').range(a, b)),
  ]);
  const blank = { arrivalTime: null, locationAddress: null, fieldNumber: null } as const;
  const games: FeedTeamEvent[] = (sent?.games ?? [])
    .filter(g => g.scheduledAt)
    .map(g => {
      const home = g.homeTeamId === p.teamId;
      const opponent = sent!.name(home ? g.awayTeamId : g.homeTeamId);
      return {
        id: g.id, name: opponent, eventType: 'league_game', opponent, homeAway: home ? 'home' : 'away',
        startsAt: g.scheduledAt, endsAt: g.endsAt, location: sent!.placeOf(g),
        status: g.status === 'cancelled' ? 'cancelled' : g.status === 'postponed' ? 'postponed' : 'scheduled', ...blank,
      };
    });
  return [
    ...games,
    ...practices.map(r => ({
      id: r.id, name: 'Practice', eventType: 'practice', opponent: null, homeAway: null, startsAt: r.scheduled_at, endsAt: r.ends_at,
      location: r.location, status: r.status === 'cancelled' ? 'cancelled' : 'scheduled', ...blank,
    })),
  ];
}

/** A team as its coach's calendar finds it: the card, the season's state and the division's publish mark. */
export async function readCoachFeedTeam(teamId: string): Promise<{
  card: CoachTeamCard; seasonId: string; divisionId: string | null; schedulePublished: boolean;
  season: { status: string; finishedAt: string | null };
} | null> {
  const found = await readTeamRow(teamId);
  if (!found) return null;
  const { team, card } = found;
  return {
    card, seasonId: team.season_id, divisionId: team.division_id,
    schedulePublished: !!one(team.league_divisions)?.schedule_published_at,
    season: { status: team.league_seasons!.status, finishedAt: team.league_seasons!.finished_at },
  };
}

/**
 * The team's practices from the start of today, in the club's zone (11b·C): club ones and hand-booked ones, a cancelled
 * one marked. Practices are a coach's and the club's, never a family-facing page's (the public schedule shows games).
 */
async function readTeamPractices(orgId: string, teamId: string, now: Date): Promise<CoachPractice[]> {
  const today = orgDayKey(now.toISOString());
  const from = zonedWallClockToUtc(today, '00:00') ?? now.toISOString();
  const { data, error } = await supabaseAdmin.from('league_practices')
    .select('id, scheduled_at, ends_at, location, status, club_schedule_slot_id')
    .eq('org_id', orgId).eq('team_id', teamId).gte('scheduled_at', from).order('scheduled_at').limit(200);
  if (error) throw new Error(`Couldn't read the team's practices: ${error.message}`);
  const rows = (data ?? []) as { id: string; scheduled_at: string; ends_at: string | null; location: string | null; status: string; club_schedule_slot_id: string | null }[];
  const slotIds = [...new Set(rows.map(r => r.club_schedule_slot_id).filter((x): x is string => !!x))];
  const scheduleOf = new Map<string, string>();
  if (slotIds.length) {
    const { data: slots } = await supabaseAdmin.from('club_schedule_slots').select('id, club_schedules!inner(name)')
      .eq('org_id', orgId).in('id', slotIds);
    for (const r of (slots ?? []) as { id: string; club_schedules: { name: string } | { name: string }[] }[]) {
      const sched = Array.isArray(r.club_schedules) ? r.club_schedules[0] : r.club_schedules;
      if (sched?.name) scheduleOf.set(r.id, sched.name);
    }
  }
  return rows.map(r => ({
    id: r.id, startsAt: r.scheduled_at, endsAt: r.ends_at, location: r.location,
    fromSchedule: r.club_schedule_slot_id ? scheduleOf.get(r.club_schedule_slot_id) ?? null : null,
    fromClub: !!r.club_schedule_slot_id, cancelled: r.status === 'cancelled',
  }));
}

async function readCoachNames(teamId: string): Promise<{ name: string }[]> {
  const { data, error } = await supabaseAdmin.from('league_team_coaches')
    .select('name').eq('team_id', teamId).is('removed_at', null).order('created_at');
  if (error) throw new Error(`Couldn't read the team's coaches: ${error.message}`);
  return (data ?? []) as { name: string }[];
}

/** The team's accepted players and their families' contacts — the whole of what 9c·9 lets a coach see. */
async function readTeamPlayers(teamId: string): Promise<CoachPlayer[]> {
  const { data, error } = await supabaseAdmin.from('league_registrations')
    .select(COACH_PLAYER_COLUMNS).eq('team_id', teamId).eq('status', 'active')
    .order('player_last_name').order('player_first_name');
  if (error) throw new Error(`Couldn't read the team's players: ${error.message}`);
  return (data ?? []).map(r => ({
    id: r.id,
    firstName: r.player_first_name,
    lastName: r.player_last_name,
    guardianName: [r.guardian_first_name, r.guardian_last_name].filter(Boolean).join(' '),
    guardianEmail: r.guardian_email,
    guardianEmail2: r.guardian_email_2 ?? null,
    guardianPhone: r.guardian_phone?.trim() ? r.guardian_phone.trim() : null,
  }));
}
