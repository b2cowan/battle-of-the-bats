import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { getLeagueSeasons } from './db';
import { addCalendarDays, formatShortWeekdayDate, orgDayKey, zonedWallClockToUtc } from './timezone';
import { COACH_GAME_EVENT_TYPES } from './coach-tournament-games';
import {
  STRIP_CLOSURE_COLUMNS, firstClosureMatch, isAllDiamonds, markPlaceOfAll, markStanding, placeEntriesValid, repTypedText, stripClosureOf,
  type ClosedPlace, type MarkWords, type ClosureScope, type ClosureVerb, type MarkedEventNow, type PlaceMatch, type RepMark, type StripClosure,
} from './place-closures';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLOSE A PLACE, THE SERVER (Club Website Stage 2, Session 2A; mig 539). The press and Reopen (each one database step),
 * and the reads: the window's matching, the strip's closures, the rep marks that still stand, and why a house league game
 * was called off. No job: a closure ends by its own dates.
 *
 * ⚖ WHAT REACHES A PUBLIC PAGE (the guard `place-closures-guard`): the strip reads `closuresShowing` (place words and days
 *   only, through `stripClosureOf`); a mark or a closure reason is read ONLY for game ids the caller already has from the
 *   reads that decide what is public (a private team's events never get that far; a house league game only through the
 *   published, last-sent read). So `standingRepMarks` and `leagueClosureReasons` take ids, never a team, season or club.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

// ── The press ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ClosurePressInput {
  orgId: string;
  actorId: string;
  /** The window's key for this press (a uuid made when it opens): a retried press runs once. */
  pressKey: string;
  /** In the window's order. One entry with `venueId: null` = every place ("All our fields"). */
  places: { venueId: string | null; facilityId: string | null }[];
  firstDay: string;
  lastDay: string;
  verb: ClosureVerb;
  line: string | null;
  /** House league games to call off, each as the window saw it. */
  league: { id: string; seen: string }[];
  /** Rep games to mark, each as the window saw it. */
  rep: { id: string; seen: string }[];
  /** Typed-in games to link to a closed place ("Link both"); a linked game may be left on. */
  links: { kind: 'league' | 'rep'; id: string; venueId: string }[];
}

export type ClosureRefusal = 'invalid' | 'past' | 'not_found' | 'finished' | 'draft' | 'changed';

export type ClosurePressResult =
  | { refusal: null; closureIds: string[]; rainoutIds: string[]; marks: number; replay: boolean }
  /** `changed`: the games that changed since the window read them (empty when the database refused a lock wait). */
  | { refusal: 'changed'; changed: string[] }
  | { refusal: Exclude<ClosureRefusal, 'changed'> };

/** THE PRESS (mig 539's `org_place_closure_press`): every program at the place, all or nothing. Never sends an email. */
export async function pressPlaceClosure(p: ClosurePressInput): Promise<ClosurePressResult> {
  const { data, error } = await supabaseAdmin.rpc('org_place_closure_press', {
    p_org: p.orgId, p_actor: p.actorId, p_press_key: p.pressKey,
    p_places: p.places.map(x => (x.venueId ? { venueId: x.venueId, facilityId: x.facilityId } : {})),
    p_first_day: p.firstDay, p_last_day: p.lastDay, p_verb: p.verb, p_line: p.line,
    p_league: p.league, p_rep: p.rep, p_links: p.links,
  });
  // A deadlock (40P01), a serialization failure (40001), a lock wait or a statement timed out (55P03, 57014): a send or a
  // Rainout held these games at the same moment. The call rolled back whole, so nothing was written: try again.
  if (error && ['40P01', '40001', '55P03', '57014'].includes(error.code ?? '')) return { refusal: 'changed', changed: [] };
  if (error) throw new Error(`The closure didn't save: ${error.message}`);
  const r = ((data ?? []) as {
    refusal: ClosureRefusal | null; changed: string[] | null; closures: string[] | null; rainouts: string[] | null;
    marks: number; replay: boolean;
  }[])[0];
  if (!r) throw new Error('The closure answered nothing');
  if (r.refusal === 'changed') return { refusal: 'changed', changed: r.changed ?? [] };
  if (r.refusal) return { refusal: r.refusal };
  return { refusal: null, closureIds: r.closures ?? [], rainoutIds: r.rainouts ?? [], marks: r.marks, replay: r.replay };
}

/** REOPEN (K11 A): the strip and the marks come down; no game moves. `already` when it had been reopened. */
export async function reopenPlaceClosure(orgId: string, closureId: string, actorId: string):
  Promise<{ refusal: 'not_found' } | { refusal: null; reopenedAt: string; already: boolean }> {
  const { data, error } = await supabaseAdmin.rpc('org_place_closure_reopen', { p_org: orgId, p_closure: closureId, p_actor: actorId });
  if (error) throw new Error(`The reopen didn't save: ${error.message}`);
  const r = ((data ?? []) as { refusal: 'not_found' | null; reopened: string | null; already: boolean }[])[0];
  if (!r || r.refusal === 'not_found') return { refusal: 'not_found' };
  return { refusal: null, reopenedAt: r.reopened!, already: r.already };
}

// ── The strip ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The club's closures showing now (K3): from the press to the end of Until, not reopened — the strip's whole read, in the
 * order they were pressed. Place words and days only (`stripClosureOf`), and the place's id for the cover rule (S1), which
 * the strip's box never carries. A whole park's row reads "all diamonds" only when every facility it has is a diamond: the
 * facilities' kinds are read for those parks (no names). ⚠ A failed read THROWS; the page decides.
 */
export async function closuresShowing(orgId: string, now: Date = new Date()): Promise<StripClosure[]> {
  const at = now.toISOString();
  const { data, error } = await supabaseAdmin.from('org_place_closures')
    .select(STRIP_CLOSURE_COLUMNS)
    .eq('org_id', orgId).is('reopened_at', null).lte('shows_from', at).gt('ends_at', at)
    .order('created_at').order('press_seq');
  if (error) throw error;
  const rows = (data ?? []) as unknown as Parameters<typeof stripClosureOf>[0][];
  const parks = [...new Set(rows.filter(r => r.scope === 'place' && r.org_venue_id).map(r => r.org_venue_id!))];
  // Only the words "all diamonds" ride on this read: a failure costs those words, never the strip (the closures still show,
  // a whole park by its name alone).
  const kinds = parks.length ? await fetchAllIn<{ org_venue_id: string; facility_type: string }>(parks, (c, a, b) =>
    supabaseAdmin.from('org_venue_facilities').select('org_venue_id, facility_type').eq('org_id', orgId).in('org_venue_id', c)
      .order('id').range(a, b)).catch(() => []) : [];
  const byPark = new Map<string, string[]>();
  for (const k of kinds) (byPark.get(k.org_venue_id) ?? byPark.set(k.org_venue_id, []).get(k.org_venue_id)!).push(k.facility_type);
  const diamondParks = new Set(parks.filter(v => isAllDiamonds(byPark.get(v) ?? [])));
  return rows.map(r => stripClosureOf(r, diamondParks));
}

// ── The rep marks ──────────────────────────────────────────────────────────────────────────────────────────────────

/** A standing mark, with the words its surfaces say: the closed place and its first day. */
export interface StandingMark {
  mark: RepMark;
  closure: { id: string; scope: ClosureScope; venueId: string | null; placeName: string | null; facilityName: string | null; firstDay: string };
}

/**
 * The marks that still stand on these rep games (K9): closure not reopened, game not moved or cancelled. ⚖ Ids only, of
 * one club: the caller passes the games its own read already decided may be shown (a private team's never reach a public
 * caller); the club is a second fence, never the selector.
 */
export async function standingRepMarks(orgId: string, eventIds: readonly string[]): Promise<Map<string, StandingMark[]>> {
  const out = new Map<string, StandingMark[]>();
  if (!eventIds.length) return out;
  type Row = {
    id: string; closure_id: string; event_id: string; team_id: string; marked_starts_at: string;
    marked_org_venue_id: string | null; marked_facility_id: string | null; marked_place_id: string | null;
    marked_location: string | null; coach_emailed_at: string | null;
    org_place_closures: MarkClosureRow | MarkClosureRow[] | null;
  };
  type MarkClosureRow = { scope: ClosureScope; org_venue_id: string | null; place_name: string | null; facility_name: string | null; first_day: string; reopened_at: string | null; created_at: string; press_seq: number };
  const rows = await fetchAllIn<Row>([...eventIds], (c, a, b) => supabaseAdmin.from('rep_event_closure_marks')
    .select('id, closure_id, event_id, team_id, marked_starts_at, marked_org_venue_id, marked_facility_id, marked_place_id, marked_location, coach_emailed_at, org_place_closures!inner(scope, org_venue_id, place_name, facility_name, first_day, reopened_at, created_at, press_seq)')
    .eq('org_id', orgId).in('event_id', c).is('org_place_closures.reopened_at', null).order('created_at').order('id').range(a, b));
  if (!rows.length) return out;
  const events = await fetchAllIn<{ id: string; starts_at: string; status: string; org_venue_id: string | null; org_venue_facility_id: string | null; place_id: string | null; location: string | null }>(
    [...new Set(rows.map(r => r.event_id))], (c, a, b) => supabaseAdmin.from('rep_team_events')
      .select('id, starts_at, status, org_venue_id, org_venue_facility_id, place_id, location').in('id', c).order('id').range(a, b));
  const now = new Map<string, MarkedEventNow>(events.map(e => [e.id, {
    id: e.id, startsAt: e.starts_at, status: e.status, venueId: e.org_venue_id, facilityId: e.org_venue_facility_id,
    placeId: e.place_id, location: e.location,
  }]));
  // A game's marks in the order PRESSED: one press's marks share their instant, so its own order (`press_seq`, the
  // window's) breaks the tie — the same "first" the coach's email names.
  const closureOfRow = (r: Row) => (Array.isArray(r.org_place_closures) ? r.org_place_closures[0] : r.org_place_closures);
  const pressed = (a: Row, b: Row) => {
    const x = closureOfRow(a); const y = closureOfRow(b);
    return x && y ? x.created_at.localeCompare(y.created_at) || x.press_seq - y.press_seq : 0;
  };
  for (const r of [...rows].sort(pressed)) {
    const c = closureOfRow(r);
    if (!c) continue;
    const mark: RepMark = {
      id: r.id, closureId: r.closure_id, eventId: r.event_id, teamId: r.team_id, markedStartsAt: r.marked_starts_at,
      markedVenueId: r.marked_org_venue_id, markedFacilityId: r.marked_facility_id, markedPlaceId: r.marked_place_id,
      markedLocation: r.marked_location, coachEmailedAt: r.coach_emailed_at,
    };
    if (!markStanding(mark, now.get(r.event_id), { reopenedAt: c.reopened_at })) continue;
    const entry: StandingMark = {
      mark, closure: { id: r.closure_id, scope: c.scope, venueId: c.org_venue_id, placeName: c.place_name, facilityName: c.facility_name, firstDay: c.first_day },
    };
    (out.get(r.event_id) ?? out.set(r.event_id, []).get(r.event_id)!).push(entry);
  }
  return out;
}

/**
 * The mark's words on each of these rep games (Session 2C, K9): `{ place, day }` per event id, for the games whose mark
 * still stands; the first mark pressed when two stand — except two or more diamonds of one park standing over one game
 * (D1: "2 diamonds at Lions Park", `markPlaceOfAll`). ⚖ The same fence as `standingRepMarks`: ids the caller's own read
 * already decided may be shown. ⚠ A failed read is no mark, never a broken page (the strip's rule): a surface reads as it
 * did before the closure.
 */
export async function repMarkWords(orgId: string, eventIds: readonly string[]): Promise<Record<string, MarkWords>> {
  const out: Record<string, MarkWords> = {};
  if (!eventIds.length) return out;
  const marks = await standingRepMarks(orgId, eventIds).catch(() => new Map<string, StandingMark[]>());
  for (const [eventId, list] of marks) {
    const first = list[0];
    if (!first) continue;
    out[eventId] = { place: markPlaceOfAll(list.map(x => x.closure)), day: formatShortWeekdayDate(orgDayKey(first.mark.markedStartsAt)) };
  }
  return out;
}

// ── Why a house league game was called off ─────────────────────────────────────────────────────────────────────────

/**
 * The closure that called off each of these house league games, if one did (the home's "Place closed" row, Session 2C).
 * ⚖ Ids only, of one club, from the published, last-sent read. ⚠ Pass only games that read as called off NOW (postponed or
 * cancelled as families last heard): a game given a date since keeps its old record here. A closure reopened since still
 * answers: the game is still waiting.
 */
export async function leagueClosureReasons(orgId: string, gameIds: readonly string[]): Promise<Map<string, { scope: ClosureScope; placeName: string | null; facilityName: string | null; day: string }>> {
  const out = new Map<string, { scope: ClosureScope; placeName: string | null; facilityName: string | null; day: string }>();
  if (!gameIds.length) return out;
  const wanted = new Set(gameIds);
  type Row = { game_ids: string[]; day: string; created_at: string; org_place_closures: { scope: ClosureScope; place_name: string | null; facility_name: string | null } | { scope: ClosureScope; place_name: string | null; facility_name: string | null }[] | null };
  const rows = await fetchAllIn<Row>([...gameIds], (c, a, b) => supabaseAdmin.from('league_rainouts')
    .select('game_ids, day, created_at, org_place_closures!inner(scope, place_name, facility_name)')
    .eq('org_id', orgId).overlaps('game_ids', c).is('put_back_at', null).order('created_at').order('id').range(a, b));
  // The latest closure that called a game off wins (a game postponed, given a date, then closed again).
  for (const r of rows.sort((x, y) => x.created_at.localeCompare(y.created_at))) {
    const c = Array.isArray(r.org_place_closures) ? r.org_place_closures[0] : r.org_place_closures;
    if (!c) continue;
    for (const id of r.game_ids) {
      if (wanted.has(id)) out.set(id, { scope: c.scope, placeName: c.place_name, facilityName: c.facility_name, day: r.day });
    }
  }
  return out;
}

// ── The window's read ──────────────────────────────────────────────────────────────────────────────────────────────

export interface ClosureLeagueGame {
  id: string; seasonId: string; divisionId: string; published: boolean;
  homeTeamId: string; awayTeamId: string; scheduledAt: string;
  venueId: string | null; facilityId: string | null; typed: string | null;
  /** Which closed place (index into `places`) and how (`maybe` = listed unticked, K7). */
  place: number; match: PlaceMatch;
  /** Its start has passed (K6: listed unticked, "Started"). */
  started: boolean;
  seen: string;
}

export interface ClosureRepGame {
  id: string; teamId: string; teamName: string; opponent: string | null; startsAt: string;
  venueId: string | null; facilityId: string | null; typed: string | null;
  place: number; match: PlaceMatch; started: boolean; seen: string;
}

export interface ClosureTournament {
  id: string; name: string; slug: string;
  /** Its games those days still to play (K13: every tournament playing is listed, linked diamonds or not). */
  games: number;
  /** Of them, on its diamonds linked to a closed place — what its own Rain delay would move. */
  atPlace: number;
  /** Its diamonds linked to a closed place (the Rain delay opens with these picked). */
  diamondIds: string[];
}

export interface ClosureSource {
  places: ClosedPlace[];
  seasons: { id: string; name: string; divisions: { id: string; name: string; published: boolean }[] }[];
  league: ClosureLeagueGame[];
  rep: ClosureRepGame[];
  tournaments: ClosureTournament[];
  /** House league and rep practices at a closed place (by its id) those days: "Not changed here". */
  practices: number;
}

/**
 * What the window plans from (Session 2B draws it): every program's games at the closed places on those club days, by
 * the one matching rule. House league: every live season (not a draft, not finished), its games still to play, a draft
 * division's too (flagged, the press refuses them). Rep: games (not a club tournament's), on, unscored. Tournaments: every
 * one playing those days. Scored, called-off and cancelled games are never listed (K6). Null when a place is not the
 * club's. ⚠ A failed read THROWS.
 */
export async function placeClosureSource(orgId: string, input: {
  places: { venueId: string | null; facilityId: string | null }[]; firstDay: string; lastDay: string; now?: Date;
}): Promise<ClosureSource | null> {
  const fromIso = zonedWallClockToUtc(input.firstDay, '00:00');
  const toIso = zonedWallClockToUtc(addCalendarDays(input.lastDay, 1), '00:00');
  if (!fromIso || !toIso || !input.places.length) return null;
  const nowMs = (input.now ?? new Date()).getTime();

  // The places, as the press resolves them.
  let places: ClosedPlace[];
  // As the press (mig 549): every entry a place of the club, each place or diamond once, never a whole place beside its
  // diamond — or every place alone.
  if (!placeEntriesValid(input.places)) return null;
  if (!input.places[0].venueId) {
    places = [{ scope: 'all', venueId: null, facilityId: null, name: null }];
  } else {
    const { data, error } = await supabaseAdmin.from('org_venues').select('id, name, org_venue_facilities(id, name)')
      .eq('org_id', orgId).in('id', input.places.map(p => p.venueId!));
    if (error) throw error;
    const byId = new Map(((data ?? []) as { id: string; name: string; org_venue_facilities: { id: string; name: string }[] | null }[]).map(v => [v.id, v]));
    const resolved: ClosedPlace[] = [];
    for (const p of input.places) {
      const v = byId.get(p.venueId!);
      if (!v || (p.facilityId && !(v.org_venue_facilities ?? []).some(f => f.id === p.facilityId))) return null;
      const facilityName = p.facilityId ? (v.org_venue_facilities ?? []).find(f => f.id === p.facilityId)?.name ?? null : null;
      resolved.push({ scope: p.facilityId ? 'diamond' : 'place', venueId: v.id, facilityId: p.facilityId, name: v.name, facilityName });
    }
    places = resolved;
  }
  const venueIds = places.flatMap(p => (p.venueId ? [p.venueId] : []));
  const everyPlace = places[0].scope === 'all';

  const [league, rep, tournaments, practices] = await Promise.all([
    leagueAt(orgId, places, fromIso, toIso, nowMs),
    repAt(orgId, places, fromIso, toIso, nowMs),
    tournamentsAt(orgId, venueIds, everyPlace, input.firstDay, input.lastDay),
    practicesAt(orgId, places, fromIso, toIso),
  ]);
  return { places, seasons: league.seasons, league: league.games, rep, tournaments, practices };
}

async function leagueAt(orgId: string, places: readonly ClosedPlace[], fromIso: string, toIso: string, nowMs: number) {
  const seasons = (await getLeagueSeasons(orgId, { strict: true }))
    .filter(s => s.status !== 'draft' && s.status !== 'completed' && s.status !== 'archived');
  if (!seasons.length) return { seasons: [], games: [] as ClosureLeagueGame[] };
  const ids = seasons.map(s => s.id);
  const [divisions, rows] = await Promise.all([
    fetchAllIn<{ id: string; season_id: string; name: string; sort_order: number; schedule_published_at: string | null }>(ids, (c, a, b) =>
      supabaseAdmin.from('league_divisions').select('id, season_id, name, sort_order, schedule_published_at')
        .in('season_id', c).order('sort_order').order('name').order('id').range(a, b)),
    fetchAllIn<{ id: string; season_id: string; division_id: string; home_team_id: string; away_team_id: string; scheduled_at: string;
      location: string | null; org_venue_id: string | null; org_venue_facility_id: string | null; updated_at: string }>(ids, (c, a, b) =>
      supabaseAdmin.from('league_games')
        .select('id, season_id, division_id, home_team_id, away_team_id, scheduled_at, location, org_venue_id, org_venue_facility_id, updated_at')
        .eq('org_id', orgId).in('season_id', c).eq('status', 'scheduled').gte('scheduled_at', fromIso).lt('scheduled_at', toIso)
        .order('scheduled_at').order('id').range(a, b)),
  ]);
  const published = new Map(divisions.map(d => [d.id, !!d.schedule_published_at]));
  const games: ClosureLeagueGame[] = [];
  for (const g of rows) {
    const hit = firstClosureMatch(places, { venueId: g.org_venue_id, facilityId: g.org_venue_facility_id, typed: g.location });
    if (!hit) continue;
    games.push({
      id: g.id, seasonId: g.season_id, divisionId: g.division_id, published: published.get(g.division_id) ?? false,
      homeTeamId: g.home_team_id, awayTeamId: g.away_team_id, scheduledAt: g.scheduled_at,
      venueId: g.org_venue_id, facilityId: g.org_venue_facility_id, typed: g.location,
      place: hit.index, match: hit.match, started: Date.parse(g.scheduled_at) <= nowMs, seen: g.updated_at,
    });
  }
  return {
    seasons: seasons.map(s => ({
      id: s.id, name: s.name,
      divisions: divisions.filter(d => d.season_id === s.id).map(d => ({ id: d.id, name: d.name, published: !!d.schedule_published_at })),
    })),
    games,
  };
}

async function repAt(orgId: string, places: readonly ClosedPlace[], fromIso: string, toIso: string, nowMs: number): Promise<ClosureRepGame[]> {
  const rows = await fetchAll<{ id: string; team_id: string; starts_at: string; opponent: string | null; location: string | null;
    place_id: string | null; org_venue_id: string | null; org_venue_facility_id: string | null; updated_at: string }>((a, b) =>
    supabaseAdmin.from('rep_team_events')
      .select('id, team_id, starts_at, opponent, location, place_id, org_venue_id, org_venue_facility_id, updated_at')
      .eq('org_id', orgId).in('event_type', COACH_GAME_EVENT_TYPES).is('source_tournament_game_id', null).eq('status', 'scheduled')
      .is('team_score', null).is('opponent_score', null).is('result', null)
      .gte('starts_at', fromIso).lt('starts_at', toIso).order('starts_at').order('id').range(a, b));
  if (!rows.length) return [];
  // The team's own place is read as typed text (repTypedText), beside the game's own typed place.
  const placeIds = [...new Set(rows.flatMap(r => (r.place_id ? [r.place_id] : [])))];
  const [teamPlaces, teams] = await Promise.all([
    fetchAllIn<{ id: string; name: string }>(placeIds, (c, a, b) =>
      supabaseAdmin.from('rep_team_places').select('id, name').in('id', c).order('id').range(a, b)),
    fetchAllIn<{ id: string; name: string }>([...new Set(rows.map(r => r.team_id))], (c, a, b) =>
      supabaseAdmin.from('rep_teams').select('id, name').in('id', c).order('id').range(a, b)),
  ]);
  const placeName = new Map(teamPlaces.map(p => [p.id, p.name]));
  const teamName = new Map(teams.map(t => [t.id, t.name]));
  const out: ClosureRepGame[] = [];
  for (const r of rows) {
    const typed = repTypedText(r.location, r.place_id ? placeName.get(r.place_id) ?? null : null);
    const hit = firstClosureMatch(places, { venueId: r.org_venue_id, facilityId: r.org_venue_facility_id, typed });
    if (!hit) continue;
    out.push({
      id: r.id, teamId: r.team_id, teamName: teamName.get(r.team_id) ?? '', opponent: r.opponent, startsAt: r.starts_at,
      venueId: r.org_venue_id, facilityId: r.org_venue_facility_id, typed,
      place: hit.index, match: hit.match, started: Date.parse(r.starts_at) <= nowMs, seen: r.updated_at,
    });
  }
  return out;
}

/**
 * Every tournament of the club playing those days (K13), and what of it is at a closed place. A tournament diamond links
 * to a PLACE (`diamonds.source_org_venue_id`), never to one of its diamonds, so a one-diamond closure counts the place's
 * linked diamonds; the Rain delay picks among them.
 */
async function tournamentsAt(orgId: string, venueIds: readonly string[], everyPlace: boolean, firstDay: string, lastDay: string): Promise<ClosureTournament[]> {
  const { data: ts, error } = await supabaseAdmin.from('tournaments').select('id, name, slug').eq('org_id', orgId);
  if (error) throw error;
  const tournaments = (ts ?? []) as { id: string; name: string; slug: string }[];
  if (!tournaments.length) return [];
  const ids = tournaments.map(t => t.id);
  const [games, diamonds] = await Promise.all([
    fetchAllIn<{ id: string; tournament_id: string; diamond_id: string | null }>(ids, (c, a, b) =>
      supabaseAdmin.from('games').select('id, tournament_id, diamond_id').in('tournament_id', c).eq('status', 'scheduled')
        .gte('game_date', firstDay).lte('game_date', lastDay).order('id').range(a, b)),
    fetchAllIn<{ id: string; tournament_id: string; source_org_venue_id: string | null }>(ids, (c, a, b) =>
      supabaseAdmin.from('diamonds').select('id, tournament_id, source_org_venue_id').in('tournament_id', c)
        .not('source_org_venue_id', 'is', null).order('id').range(a, b)),
  ]);
  const closedVenues = new Set(venueIds);
  const atPlace = new Set(diamonds.filter(d => everyPlace || closedVenues.has(d.source_org_venue_id!)).map(d => d.id));
  const out: ClosureTournament[] = [];
  for (const t of tournaments) {
    const mine = games.filter(g => g.tournament_id === t.id);
    if (!mine.length) continue;
    out.push({
      id: t.id, name: t.name, slug: t.slug, games: mine.length,
      atPlace: mine.filter(g => g.diamond_id && atPlace.has(g.diamond_id)).length,
      diamondIds: diamonds.filter(d => d.tournament_id === t.id && atPlace.has(d.id)).map(d => d.id),
    });
  }
  return out;
}

/** Practices at a closed place, by its id (a typed practice is not counted): they are never changed by a closure. */
async function practicesAt(orgId: string, places: readonly ClosedPlace[], fromIso: string, toIso: string): Promise<number> {
  const at = (venueId: string | null, facilityId: string | null) =>
    places.some(p => p.scope === 'all' || (!!venueId && venueId === p.venueId && (!p.facilityId || facilityId === p.facilityId)));
  const [league, rep] = await Promise.all([
    fetchAll<{ org_venue_id: string | null; org_venue_facility_id: string | null }>((a, b) =>
      supabaseAdmin.from('league_practices').select('org_venue_id, org_venue_facility_id')
        .eq('org_id', orgId).neq('status', 'cancelled').gte('scheduled_at', fromIso).lt('scheduled_at', toIso).order('id').range(a, b)),
    fetchAll<{ org_venue_id: string | null; org_venue_facility_id: string | null }>((a, b) =>
      supabaseAdmin.from('rep_team_events').select('org_venue_id, org_venue_facility_id')
        .eq('org_id', orgId).eq('event_type', 'practice').eq('status', 'scheduled').gte('starts_at', fromIso).lt('starts_at', toIso)
        .order('id').range(a, b)),
  ]);
  return [...league, ...rep].filter(p => at(p.org_venue_id, p.org_venue_facility_id)).length;
}
