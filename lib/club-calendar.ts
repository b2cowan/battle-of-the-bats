/**
 * club-calendar.ts (server-only — touches supabaseAdmin) — THE CLUB CALENDAR's read (Club Tier Stage 6b, Asks 6–7;
 * D5: an internal, READ-ONLY club calendar in the first release; D3: the club never writes a team's schedule).
 *
 * One read of one club's week (or month) across its three programs:
 *   · every club team's events — games, practices, team events — and its tryout days, as the coaches wrote them;
 *   · house league's games and practices;
 *   · the club's tournaments, ONE booking per tournament per day with its game count. A club team's own games in that
 *     tournament (the coach's mirrored copies) sit inside it, never twice (S6-06) — unless the reader cannot see the
 *     tournament, when the team's copy is the only place the game shows.
 * Then 6a's ONE clash rule (`findClashPairs`, the same pair rule the writers run) over every booking on the club's
 * venues in the window, padded a day each side — so each booking knows both sides of its clash.
 *
 * WHO SEES WHAT (Ask 6): each reader sees only the programs they can open (`canOpenModule`, the one gate every route
 * asks; a staff member's tournament assignments narrow tournaments further). The clash rule still reads the whole
 * club, because a clash is real whoever can open the other side: a league admin's game on Kinsmen B is marked when a
 * rep practice holds it, and the other side is named the way 6a names it to a coach — name, kind, time, where — with
 * its head coach only for a reader who can open rep teams, and no door into a program the reader can't open.
 *
 * Not on it, said out loud: an OUTSIDE tournament's dates container (no time, no venue — not a booking); a cancelled
 * booking, and a postponed league game (each vacates its slot, the rule's own exclusions).
 */
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { canOpenModule, type MemberAccessInput } from './member-access';
import type { EntitlementOrg } from './module-entitlements';
import { addCalendarDays, orgDayKey, zonedWallClockToUtc } from './timezone';
import { loadHeadCoaches, type ClubBoardHeadCoach } from './club-team-board';
import { listActiveStaffForTeams } from './coach-membership';
import {
  findClashPairs, leagueBooking, repEventBooking, tournamentGameBooking, tournamentGameMinutes, tryoutSessionBooking,
  type ClubBooking,
} from './venue-clash';
import { clashOtherName, facilityWords } from './venue-clash-words';
import { VENUE_FACILITY_SEPARATOR } from './venue-label';
import { SCRIMMAGE_LABEL } from './coach-schedule-vocab';
import { DEFAULT_BOOKING_MINUTES } from './booking-length';
import {
  CALENDAR_WORDS as W, type CalendarBooking, type CalendarDoor, type CalendarOther, type CalendarProgram, type CalendarRead,
  type CalendarWhere,
} from './club-calendar-view';

const DAY = 86_400_000;
/** The longest range one read covers — a month's grid (six weeks) and no more. */
export const MAX_CALENDAR_DAYS = 42;

export interface CalendarReader {
  org: EntitlementOrg & { id: string; slug: string };
  member: MemberAccessInput;
  userId: string;
  /** A staff member's tournament assignments (null = every tournament). */
  assignedTournamentIds: string[] | null;
}

/** The programs this reader can open — the only ones the page shows (Ask 6). The rail's Calendar door reads the same. */
export function calendarPrograms(member: MemberAccessInput, org: EntitlementOrg): CalendarProgram[] {
  const out: CalendarProgram[] = [];
  if (canOpenModule(member, org, 'module_rep_teams')) out.push('rep');
  if (canOpenModule(member, org, 'module_house_league')) out.push('league');
  if (canOpenModule(member, org, 'module_tournaments')) out.push('tournament');
  return out;
}

type RepRow = {
  id: string; team_id: string; event_type: string; name: string; opponent: string | null; home_away: string | null;
  is_scrimmage: boolean | null; starts_at: string; ends_at: string | null; status: string; location: string | null;
  location_address: string | null; field_number: string | null; org_venue_id: string | null; org_venue_facility_id: string | null;
  source_tournament_game_id: string | null;
};
type TryoutRow = {
  id: string; team_id: string; starts_at: string; ends_at: string | null; status: string; label: string | null;
  location: string | null; location_address: string | null; field_number: string | null;
  org_venue_id: string | null; org_venue_facility_id: string | null;
};
type LeagueGameRow = {
  id: string; season_id: string; division_id: string; home_team_id: string; away_team_id: string; scheduled_at: string;
  ends_at: string | null; status: string; location: string | null; org_venue_id: string | null; org_venue_facility_id: string | null;
};
type LeaguePracticeRow = Omit<LeagueGameRow, 'home_team_id' | 'away_team_id' | 'division_id'> & { team_id: string; division_id: string | null };
type GameRow = {
  id: string; tournament_id: string; division_id: string | null; game_date: string | null; game_time: string | null;
  status: string | null; duration_minutes: number | null; diamond_id: string | null; venue_facility_id: string | null;
};
type Named = { id: string; name: string };
type TournamentRow = { id: string; name: string; sport: string | null; settings: { game_duration_minutes?: unknown } | null };

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** A valid window, or the reason it isn't. */
export function calendarWindow(from: string | null, to: string | null): { from: string; to: string } | { error: string } {
  if (!from || !to || !isDay(from) || !isDay(to)) return { error: 'Pick the days to show.' };
  const days = Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY) + 1;
  if (days < 1 || days > MAX_CALENDAR_DAYS) return { error: 'The calendar reads up to six weeks at a time.' };
  return { from, to };
}

/** House league keeps one line, "Venue — Facility": read back into its two halves (as it was played, renames included). */
function splitLeagueLine(line: string | null, hasFacility: boolean): { venue: string | null; facility: string | null } {
  const text = line ?? '';
  const at = hasFacility ? text.lastIndexOf(VENUE_FACILITY_SEPARATOR) : -1;
  return at > 0
    ? { venue: text.slice(0, at), facility: text.slice(at + VENUE_FACILITY_SEPARATOR.length) }
    : { venue: text || null, facility: null };
}

function repWhat(r: RepRow): string {
  if (r.event_type === 'practice') return 'Practice';
  if (r.event_type === 'team_event') return r.name;
  const vs = r.opponent ? `${r.home_away === 'away' ? '@' : 'vs'} ${r.opponent}` : (r.name || 'Game');
  return r.is_scrimmage ? `${SCRIMMAGE_LABEL} · ${vs}` : vs;
}

const repKind = (t: string): CalendarBooking['kind'] =>
  t === 'practice' ? 'practice' : t === 'team_event' ? 'team_event' : 'game';

export async function readClubCalendar(reader: CalendarReader, from: string, to: string): Promise<CalendarRead> {
  const programs = calendarPrograms(reader.member, reader.org);
  const orgId = reader.org.id;
  const slug = reader.org.slug;
  const empty: CalendarRead = { from, to, programs, bookings: [], venues: [] };
  if (!programs.length) return empty;

  const startIso = zonedWallClockToUtc(from, '00:00')!;
  const endIso = zonedWallClockToUtc(addCalendarDays(to, 1), '00:00')!;
  // The clash pool is padded a day each side: a booking late the evening before still overlaps one at midnight.
  const padFrom = new Date(Date.parse(startIso) - DAY).toISOString();
  const padTo = new Date(Date.parse(endIso) + DAY).toISOString();
  const dayFrom = addCalendarDays(from, -1);
  const dayTo = addCalendarDays(to, 1);
  const inRange = (day: string) => day >= from && day <= to;

  // ── The reads (every one scoped by the club's org_id) ──
  const [repRows, tryoutRows, gameRows, practiceRows, tournaments, libVenues, libFacilities] = await Promise.all([
    fetchAll<RepRow>((a, b) => supabaseAdmin.from('rep_team_events')
      .select('id, team_id, event_type, name, opponent, home_away, is_scrimmage, starts_at, ends_at, status, location, location_address, field_number, org_venue_id, org_venue_facility_id, source_tournament_game_id')
      .eq('org_id', orgId).neq('status', 'cancelled').neq('event_type', 'external_tournament')
      .gte('starts_at', padFrom).lt('starts_at', padTo).order('id').range(a, b)),
    fetchAll<TryoutRow>((a, b) => supabaseAdmin.from('rep_tryout_sessions')
      .select('id, team_id, starts_at, ends_at, status, label, location, location_address, field_number, org_venue_id, org_venue_facility_id')
      .eq('org_id', orgId).neq('status', 'cancelled')
      .gte('starts_at', padFrom).lt('starts_at', padTo).order('id').range(a, b)),
    fetchAll<LeagueGameRow>((a, b) => supabaseAdmin.from('league_games')
      .select('id, season_id, division_id, home_team_id, away_team_id, scheduled_at, ends_at, status, location, org_venue_id, org_venue_facility_id')
      .eq('org_id', orgId).neq('status', 'cancelled').neq('status', 'postponed')
      .gte('scheduled_at', padFrom).lt('scheduled_at', padTo).order('id').range(a, b)),
    fetchAll<LeaguePracticeRow>((a, b) => supabaseAdmin.from('league_practices')
      .select('id, season_id, division_id, team_id, scheduled_at, ends_at, status, location, org_venue_id, org_venue_facility_id')
      .eq('org_id', orgId).neq('status', 'cancelled')
      .gte('scheduled_at', padFrom).lt('scheduled_at', padTo).order('id').range(a, b)),
    fetchAll<TournamentRow>((a, b) => supabaseAdmin
      .from('tournaments').select('id, name, sport, settings').eq('org_id', orgId).order('id').range(a, b)),
    fetchAll<{ id: string; name: string; address: string | null }>((a, b) => supabaseAdmin
      .from('org_venues').select('id, name, address').eq('org_id', orgId).order('id').range(a, b)),
    fetchAll<Named>((a, b) => supabaseAdmin.from('org_venue_facilities').select('id, name').eq('org_id', orgId).order('id').range(a, b)),
  ]);

  const games = await fetchAllIn<GameRow>(tournaments.map(t => t.id), (c, a, b) => supabaseAdmin.from('games')
    .select('id, tournament_id, division_id, game_date, game_time, status, duration_minutes, diamond_id, venue_facility_id')
    .in('tournament_id', c).neq('status', 'cancelled').gte('game_date', dayFrom).lte('game_date', dayTo).order('id').range(a, b));

  const teamIds = [...new Set([...repRows, ...tryoutRows].map(r => r.team_id))];
  const canOpenRep = programs.includes('rep');
  const [teams, seasons, leagueDivisions, leagueTeams, copies, facilityCopies, divisions, heads, staff] = await Promise.all([
    fetchAllIn<{ id: string; name: string; color: string | null; sport: string | null }>(teamIds, (c, a, b) => supabaseAdmin
      .from('rep_teams').select('id, name, color, sport').in('id', c).order('id').range(a, b)),
    fetchAllIn<{ id: string; name: string; sport: string | null }>([...gameRows, ...practiceRows].map(r => r.season_id), (c, a, b) => supabaseAdmin
      .from('league_seasons').select('id, name, sport').in('id', c).order('id').range(a, b)),
    fetchAllIn<Named>([...gameRows.map(g => g.division_id), ...practiceRows.map(p => p.division_id).filter((d): d is string => !!d)], (c, a, b) => supabaseAdmin
      .from('league_divisions').select('id, name').in('id', c).order('id').range(a, b)),
    fetchAllIn<Named>([...gameRows.flatMap(g => [g.home_team_id, g.away_team_id]), ...practiceRows.map(p => p.team_id)], (c, a, b) => supabaseAdmin
      .from('league_teams').select('id, name').in('id', c).order('id').range(a, b)),
    fetchAllIn<{ id: string; name: string; address: string | null; source_org_venue_id: string | null }>(games.map(g => g.diamond_id).filter((d): d is string => !!d), (c, a, b) => supabaseAdmin
      .from('diamonds').select('id, name, address, source_org_venue_id').in('id', c).order('id').range(a, b)),
    fetchAllIn<{ id: string; name: string; source_org_facility_id: string | null }>(games.map(g => g.venue_facility_id).filter((d): d is string => !!d), (c, a, b) => supabaseAdmin
      .from('venue_facilities').select('id, name, source_org_facility_id').in('id', c).order('id').range(a, b)),
    fetchAllIn<{ id: string; name: string; settings: { game_duration_minutes?: unknown } | null }>(games.map(g => g.division_id).filter((d): d is string => !!d), (c, a, b) => supabaseAdmin
      .from('divisions').select('id, name, settings').in('id', c).order('id').range(a, b)),
    // Each team's head coach (the read window's contact) and who among the reader's teams they coach (the door):
    // read only for a reader who opens rep teams.
    canOpenRep ? loadHeadCoaches(orgId, teamIds) : Promise.resolve(new Map<string, ClubBoardHeadCoach>()),
    canOpenRep ? listActiveStaffForTeams(teamIds) : Promise.resolve([]),
  ]);

  const team = new Map(teams.map(t => [t.id, t]));
  const season = new Map(seasons.map(s => [s.id, s]));
  const leagueDivision = new Map(leagueDivisions.map(d => [d.id, d.name]));
  const leagueTeam = new Map(leagueTeams.map(t => [t.id, t.name]));
  const tournament = new Map(tournaments.map(t => [t.id, t]));
  const copy = new Map(copies.map(d => [d.id, d]));
  const facilityCopy = new Map(facilityCopies.map(f => [f.id, f]));
  const division = new Map(divisions.map(d => [d.id, d]));
  const venueName = new Map(libVenues.map(v => [v.id, v.name]));
  const venueAddress = new Map(libVenues.map(v => [v.id, v.address]));
  const facilityName = new Map(libFacilities.map(f => [f.id, f.name]));

  // Which of the club's tournaments this reader sees (a staff member's assignments narrow them), and so which games are
  // inside a tournament booking on the page.
  const seesTournaments = programs.includes('tournament');
  const assigned = reader.assignedTournamentIds ? new Set(reader.assignedTournamentIds) : null;
  const allowedTournament = (id: string) => seesTournaments && (!assigned || assigned.has(id));
  const clubGameIds = new Set(games.filter(g => allowedTournament(g.tournament_id)).map(g => g.id));
  /** A tournament game the reader can't see but whose club team's copy they can: its clashes are said on that copy (the
   *  one place the game shows for them), under the copy's key — so the pair is counted once, from either side. */
  const mirrorKeyOfGame = new Map<string, string>();
  if (canOpenRep) {
    for (const r of repRows) {
      const gid = r.source_tournament_game_id;
      if (gid && !clubGameIds.has(gid) && !mirrorKeyOfGame.has(gid)) mirrorKeyOfGame.set(gid, `rep_event:${r.id}`);
    }
  }

  // ── The clash pool: every booking on one of the club's venues, in the padded window, whoever can read it ──
  const pool: ClubBooking[] = [];
  /** The underlying booking's calendar key (a tournament game's is its day's) and its sport (the facility's word). */
  const calendarKeyOf = new Map<string, string>();
  const sportOf = new Map<string, string | null>();
  const add = (b: ClubBooking | null, sport: string | null | undefined, calendarKey?: string) => {
    if (!b) return;
    pool.push(b);
    calendarKeyOf.set(b.key, calendarKey ?? b.key);
    sportOf.set(b.key, sport ?? null);
  };
  const teamName = (id: string) => team.get(id)?.name ?? 'A team';
  const placeNames = (v: string | null, f: string | null) => ({ venue: v ? venueName.get(v) ?? null : null, facility: f ? facilityName.get(f) ?? null : null });
  const minutesOf = (g: GameRow, t: TournamentRow) =>
    tournamentGameMinutes(g, g.division_id ? division.get(g.division_id)?.settings?.game_duration_minutes : undefined, t.settings?.game_duration_minutes);
  for (const r of repRows) {
    if (r.source_tournament_game_id || !r.org_venue_id) continue; // a mirror is its game's booking (S6-06)
    add(repEventBooking(r, { team: teamName(r.team_id), ...placeNames(r.org_venue_id, r.org_venue_facility_id) }), team.get(r.team_id)?.sport);
  }
  for (const r of tryoutRows) {
    if (!r.org_venue_id) continue;
    add(tryoutSessionBooking(r, { team: teamName(r.team_id), ...placeNames(r.org_venue_id, r.org_venue_facility_id) }), team.get(r.team_id)?.sport);
  }
  for (const [rows, kind] of [[gameRows, 'game'], [practiceRows, 'practice']] as const) {
    for (const r of rows) {
      if (!r.org_venue_id) continue;
      add(leagueBooking({ ...r, kind }, { season: season.get(r.season_id)?.name ?? 'House league', ...placeNames(r.org_venue_id, r.org_venue_facility_id) }), season.get(r.season_id)?.sport);
    }
  }
  for (const g of games) {
    const d = g.diamond_id ? copy.get(g.diamond_id) : undefined;
    const t = tournament.get(g.tournament_id);
    if (!d?.source_org_venue_id || !t || !g.game_date) continue; // a venue the tournament made itself is never the club's diamond
    const libFacility = g.venue_facility_id ? facilityCopy.get(g.venue_facility_id)?.source_org_facility_id ?? null : null;
    add(tournamentGameBooking(g, { venueId: d.source_org_venue_id, facilityId: libFacility, minutes: minutesOf(g, t) }, {
      tournament: t.name, ...placeNames(d.source_org_venue_id, libFacility),
    }), t.sport, mirrorKeyOfGame.get(g.id) ?? `tday:${t.id}:${g.game_date}`);
  }

  // ── Each calendar booking's other sides ──
  const headOf = (teamId: string | null | undefined): string | null => {
    if (!teamId) return null;
    const names = (heads.get(teamId)?.people ?? []).map(p => p.name ?? p.email).filter((x): x is string => !!x);
    return names.length ? `${names.join(', ')}, head coach` : null;
  };
  const teamOfKey = new Map<string, string>([...repRows.map(r => [`rep_event:${r.id}`, r.team_id] as const), ...tryoutRows.map(r => [`tryout_session:${r.id}`, r.team_id] as const)]);
  const others = new Map<string, Map<string, CalendarOther>>();
  const note = (self: ClubBooking, other: ClubBooking, kind: 'booked_by' | 'busy_then') => {
    const selfKey = calendarKeyOf.get(self.key)!;
    const otherKey = calendarKeyOf.get(other.key)!;
    if (selfKey === otherKey) return;
    const list = others.get(selfKey) ?? new Map<string, CalendarOther>();
    const was = list.get(otherKey);
    if (was && (was.clash === 'booked_by' || kind === 'busy_then')) return; // keep the stronger finding, once per other side
    list.set(otherKey, {
      key: otherKey, program: other.program, kind: other.kind, label: clashOtherName(other),
      startMs: other.startMs, endMs: other.endMs,
      where: facilityWords(sportOf.get(other.key), other.facilityName) || other.venueName || '',
      contact: other.program === 'rep' ? headOf(teamOfKey.get(other.key)) : null,
      clash: kind,
    });
    others.set(selfKey, list);
  };
  for (const { a, b, kind } of findClashPairs(pool)) { note(a, b, kind); note(b, a, kind); }
  const clashOf = (key: string): Pick<CalendarBooking, 'clash' | 'clashesWith'> => {
    const list = [...(others.get(key)?.values() ?? [])].sort((x, y) => (x.clash === y.clash ? x.startMs - y.startMs : x.clash === 'booked_by' ? -1 : 1));
    return { clash: list.some(o => o.clash === 'booked_by') ? 'booked_by' : list.length ? 'busy_then' : null, clashesWith: list };
  };

  // ── The bookings the reader sees ──
  const coached = new Set(staff.filter(m => m.userId === reader.userId).map(m => m.teamId));
  const bookings: CalendarBooking[] = [];

  /** A stored start and end as the page draws them; no stored end is the one booking length (the rule's), said by its start. */
  const span = (startIso: string, endIso: string | null) => {
    const startMs = Date.parse(startIso);
    const endParsed = endIso ? Date.parse(endIso) : NaN;
    const hasEnd = endParsed > startMs;
    return { startMs, endMs: hasEnd ? endParsed : startMs + DEFAULT_BOOKING_MINUTES * 60_000, hasEnd, allDay: false };
  };
  /** A team's side of a rep booking: its name, colour, sport and head coach. */
  const teamSide = (teamId: string) => {
    const t = team.get(teamId);
    const name = t?.name ?? 'A team';
    return { teamId, ownerName: name, who: name, colour: t?.color ?? null, sport: t?.sport ?? null, headCoach: headOf(teamId) };
  };
  /** The door into a team's own page — the Coaches Portal for someone who coaches the team, else the admin's read. */
  const teamDoor = (teamId: string, page: 'schedule' | 'tryouts'): CalendarDoor => coached.has(teamId)
    ? { label: W.doorPortal, href: `/${slug}/coaches/teams/${teamId}/${page}` }
    : { label: page === 'schedule' ? W.doorTeam(teamName(teamId)) : W.doorTryouts(teamName(teamId)), href: `/${slug}/admin/rep-teams/teams/${teamId}/${page}` };
  /** A rep booking's OWN words — a club venue's are its copy (a past booking keeps the name it was played under); a team's
   *  own place or typed words as the coach wrote them, never compared. */
  const repWhere = (r: Pick<TryoutRow, 'location' | 'location_address' | 'field_number' | 'org_venue_id'>, club: boolean, sport: string | null): CalendarWhere => club && r.org_venue_id
    ? { venueId: r.org_venue_id, venueName: r.location, facility: r.field_number, address: r.location_address ?? venueAddress.get(r.org_venue_id) ?? null, text: null }
    : { venueId: null, venueName: null, facility: null, address: r.location_address, text: [r.location, r.field_number ? facilityWords(sport, r.field_number) : null].filter(Boolean).join(' · ') || null };

  if (canOpenRep) {
    for (const r of repRows) {
      const day = orgDayKey(r.starts_at);
      if (!inRange(day)) continue;
      // A club team's game inside a tournament the reader sees is in that tournament's booking, never twice (S6-06).
      if (r.source_tournament_game_id && clubGameIds.has(r.source_tournament_game_id)) continue;
      const side = teamSide(r.team_id);
      const key = `rep_event:${r.id}`;
      bookings.push({
        key, program: 'rep', kind: repKind(r.event_type), day, ...span(r.starts_at, r.ends_at), ...side, what: repWhat(r),
        where: repWhere(r, !r.source_tournament_game_id, side.sport), ...clashOf(key), door: teamDoor(r.team_id, 'schedule'),
      });
    }
    for (const r of tryoutRows) {
      const day = orgDayKey(r.starts_at);
      if (!inRange(day)) continue;
      const side = teamSide(r.team_id);
      const key = `tryout_session:${r.id}`;
      bookings.push({
        key, program: 'rep', kind: 'tryout', day, ...span(r.starts_at, r.ends_at), ...side, what: r.label ? `Tryout · ${r.label}` : 'Tryout',
        where: repWhere(r, true, side.sport), ...clashOf(key), door: teamDoor(r.team_id, 'tryouts'),
      });
    }
  }

  if (programs.includes('league')) {
    for (const [rows, kind] of [[gameRows, 'game'], [practiceRows, 'practice']] as const) {
      for (const r of rows) {
        const day = orgDayKey(r.scheduled_at);
        if (!inRange(day)) continue;
        const s = season.get(r.season_id);
        const seasonName = s?.name ?? 'House league';
        const div = r.division_id ? leagueDivision.get(r.division_id) ?? null : null;
        const g = r as LeagueGameRow;
        const p = r as LeaguePracticeRow;
        const who = kind === 'game'
          ? `${leagueTeam.get(g.home_team_id) ?? 'Home'} vs ${leagueTeam.get(g.away_team_id) ?? 'Away'}`
          : `${leagueTeam.get(p.team_id) ?? 'A team'} practice`;
        const line = splitLeagueLine(r.location, !!r.org_venue_facility_id);
        const key = `league_${kind}:${r.id}`;
        bookings.push({
          key, program: 'league', kind, day, ...span(r.scheduled_at, r.ends_at),
          teamId: null, ownerName: seasonName, colour: null, headCoach: null,
          who, what: [div, kind === 'practice' ? 'Practice' : null].filter(Boolean).join(' · ') || seasonName, sport: s?.sport ?? null,
          where: r.org_venue_id
            ? { venueId: r.org_venue_id, venueName: line.venue ?? venueName.get(r.org_venue_id) ?? null, facility: line.facility, address: venueAddress.get(r.org_venue_id) ?? null, text: null }
            : { venueId: null, venueName: null, facility: null, address: null, text: r.location },
          ...clashOf(key),
          door: { label: W.doorSeason(seasonName), href: `/${slug}/admin/house-league/seasons/${r.season_id}/schedule` },
        });
      }
    }
  }

  // A tournament day: ONE booking — its span, its game count, its divisions, its venues (the tournament's own copies).
  const days = new Map<string, GameRow[]>();
  for (const g of games) {
    if (!g.game_date || !inRange(g.game_date) || !allowedTournament(g.tournament_id)) continue;
    const k = `tday:${g.tournament_id}:${g.game_date}`;
    const list = days.get(k);
    if (list) list.push(g); else days.set(k, [g]);
  }
  for (const [key, list] of days) {
    const t = tournament.get(list[0].tournament_id)!;
    const day = list[0].game_date!;
    const timed: { s: number; e: number }[] = [];
    const venueCopies = new Map<string, NonNullable<ReturnType<typeof copy.get>>>();
    /** The Venue filter's key: the club's venue its games stand on (the most-used one when they stand on several). */
    const libCounts = new Map<string, number>();
    for (const g of list) {
      const iso = zonedWallClockToUtc(g.game_date, g.game_time ? g.game_time.slice(0, 5) : null);
      if (iso) { const s = Date.parse(iso); timed.push({ s, e: s + minutesOf(g, t) * 60_000 }); }
      const d = g.diamond_id ? copy.get(g.diamond_id) : undefined;
      if (!d) continue;
      venueCopies.set(d.id, d);
      if (d.source_org_venue_id) libCounts.set(d.source_org_venue_id, (libCounts.get(d.source_org_venue_id) ?? 0) + 1);
    }
    const startMs = timed.length ? Math.min(...timed.map(x => x.s)) : Date.parse(zonedWallClockToUtc(day, '00:00')!);
    const endMs = timed.length ? Math.max(...timed.map(x => x.e)) : startMs + DAY;
    const divisionNames = [...new Set(list.map(g => (g.division_id ? division.get(g.division_id)?.name : null)).filter((n): n is string => !!n))];
    const libVenue = [...libCounts].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
    const names = [...venueCopies.values()].map(v => v.name).join(', ');
    bookings.push({
      key, program: 'tournament', kind: 'tournament_day', day, startMs, endMs, hasEnd: timed.length > 0, allDay: timed.length === 0,
      teamId: null, ownerName: t.name, colour: null, headCoach: null,
      who: t.name, what: [divisionNames.join(', '), `${list.length} ${list.length === 1 ? 'game' : 'games'}`].filter(Boolean).join(' · '), sport: t.sport,
      where: libVenue
        ? { venueId: libVenue, venueName: names || venueName.get(libVenue) || null, facility: null, address: venueAddress.get(libVenue) ?? null, text: null }
        : { venueId: null, venueName: null, facility: null, address: [...venueCopies.values()][0]?.address ?? null, text: names || null },
      ...clashOf(key),
      door: { label: W.doorTournament(t.name), href: `/${slug}/admin/tournaments/dashboard`, tournamentId: t.id },
    });
  }

  return {
    from, to, programs,
    bookings: bookings.sort((a, b) => a.startMs - b.startMs),
    venues: libVenues.map(v => ({ id: v.id, name: v.name })).sort((a, b) => a.name.localeCompare(b.name, 'en-CA', { numeric: true })),
  };
}
