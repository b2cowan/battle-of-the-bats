import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { chunked, fetchAll, fetchAllIn } from './supabase-paging';
import { getLeagueSeasonById, resolveCoachUserIdentities } from './db';
import { getClubVenueLibrary } from './venue-clash-lookup';
import { childrenOnTeams } from './league-game-changes-server';
import { familiesFor, teamsHearing } from './league-game-changes';
import { loadHeadCoaches } from './club-team-board';
import { listActiveStaffForTeams } from './coach-membership';
import { hasModuleEntitlement, type EntitlementOrg } from './module-entitlements';
import { sendRainout } from './league-rainout-send';
import { addCalendarDays, orgDayKey, tournamentToday, zonedWallClockToUtc } from './timezone';
import { isAllDiamonds, markPlaceOfAll, markSpent, type ClosureScope, type ClosureVerb, type RepMark } from './place-closures';
import { placeClosureSource } from './place-closures-server';
import { isUuid } from './utils';
import { closedParks, mayCloseEveryPlace, seesEveryProgram, type CloseFrame, type CloseSource, type RepReach, type StaffClosure } from './place-closure-window';
import { sendClosureCoachEmails, type CoachMailTeam } from './place-closure-mail';
import type { RainSendDivision } from './league-rainout';
import type { OrgRole } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLOSE A PLACE, THE WINDOW'S SERVER (Club Website Stage 2, Session 2B). The window's frame and read (2A's
 * `placeClosureSource` with the names, the families as team sets and each rep team's reach), the sends that follow the
 * press, the Venue library's closed rows, and Reopen's emails. No job: every read is live.
 *
 * ⚖ K1: a house league admin gets rep games as ids and times only (no team, no opponent, no typed words) and the
 *   tournaments with no door; the window shows them as counts. Rep typed or started games are not offered to them at all.
 * ⚖ K14: rep is absent where the club runs no rep teams; house league where it runs none; tournaments likewise.
 * ⚖ The sends follow the press (K5): every Rainout record the press wrote is sent per division (`sendRainout`, the
 *   Rainout's own path, so the families' email and its legal ground are unchanged); then one email per marked rep team.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

type Org = EntitlementOrg & { id: string; name: string; planId: string | null; slug: string };
type MailOrg = Parameters<typeof sendRainout>[0]['org'];

/** The window's frame: the club's (active) places, its day, and what this person may do. */
export async function closeFrame(org: Org, role: OrgRole): Promise<CloseFrame> {
  const lib = await getClubVenueLibrary({ id: org.id, planId: org.planId } as Parameters<typeof getClubVenueLibrary>[0]);
  return {
    today: tournamentToday(),
    venues: lib.venues.map(v => ({
      id: v.id, name: v.name, facilities: v.facilities.map(f => ({ id: f.id, name: f.name })),
      allDiamonds: isAllDiamonds(v.facilities.map(f => f.kind)),
    })),
    canAll: seesEveryProgram(role),
    rep: hasModuleEntitlement(org, 'module_rep_teams'),
  };
}

/**
 * K1 + T1, on the server: may this person close every place at once? An owner or an admin, always; a house league admin
 * only in a club with no places, and only when the request names one of the club's own seasons (the schedule's button).
 * The press itself checks no role, so this is the one gate (the window read and the press both ask it).
 */
export async function mayCloseEveryPlaceHere(org: Org, role: OrgRole, venues: number, seasonId: unknown): Promise<boolean> {
  if (seesEveryProgram(role)) return true;
  if (venues > 0 || typeof seasonId !== 'string' || !isUuid(seasonId)) return false;
  return mayCloseEveryPlace(role, { noPlaces: true, fromSeason: !!(await getLeagueSeasonById(seasonId, org.id)) });
}

/**
 * K15: the places this season's games use on the closure's days (by id) — the house league schedule's button opens on these. Unordered: the
 * caller orders them by the club's place names (the window's order is the press's order).
 */
export async function seasonPlacesOn(orgId: string, seasonId: string, firstDay: string, lastDay: string = firstDay): Promise<string[]> {
  const from = zonedWallClockToUtc(firstDay, '00:00');
  const to = zonedWallClockToUtc(addCalendarDays(lastDay, 1), '00:00');
  if (!from || !to) return [];
  const rows = await fetchAll<{ org_venue_id: string | null }>((a, b) => supabaseAdmin.from('league_games')
    .select('org_venue_id').eq('org_id', orgId).eq('season_id', seasonId).eq('status', 'scheduled')
    .not('org_venue_id', 'is', null).gte('scheduled_at', from).lt('scheduled_at', to).order('id').range(a, b));
  return [...new Set(rows.map(r => r.org_venue_id!))];
}

/** K15: the first day from `from` (within the closure's 13-day reach) on which this season has a game at one of the club's
 *  places — the schedule button opens there, as the Rainout opened on "today, or the next day with games". Null: none. */
export async function seasonNextDay(orgId: string, seasonId: string, from: string): Promise<string | null> {
  const start = zonedWallClockToUtc(from, '00:00');
  const end = zonedWallClockToUtc(addCalendarDays(from, 14), '00:00');
  if (!start || !end) return null;
  const { data, error } = await supabaseAdmin.from('league_games').select('scheduled_at')
    .eq('org_id', orgId).eq('season_id', seasonId).eq('status', 'scheduled').not('org_venue_id', 'is', null)
    .gte('scheduled_at', start).lt('scheduled_at', end).order('scheduled_at').limit(1);
  if (error) throw error;
  const at = (data ?? [])[0] as { scheduled_at: string } | undefined;
  return at ? orgDayKey(at.scheduled_at) : null;
}

/** Each rep team's reach for the coach email: its head coach, else its other coaches, else nobody (K10). */
async function repReachOf(orgId: string, teamIds: readonly string[]): Promise<Record<string, RepReach>> {
  const out: Record<string, RepReach> = {};
  if (!teamIds.length) return out;
  // The same rule as the send (`mailTeamsOf`): a coach counts only with an address it can reach, so the window never
  // promises an email the press then can't send.
  const [heads, staff] = await Promise.all([loadHeadCoaches(orgId, teamIds), listActiveStaffForTeams(teamIds)]);
  const otherStaff = staff.filter(m => m.coachRole !== 'head_coach');
  const ids = await resolveCoachUserIdentities(orgId, [...new Set(otherStaff.map(m => m.userId))]);
  const others = new Set(otherStaff.filter(m => !!ids.get(m.userId)?.email).map(m => m.teamId));
  for (const id of teamIds) {
    const head = (heads.get(id)?.people ?? []).some(p => !!p.email);
    out[id] = head ? 'head' : others.has(id) ? 'others' : 'none';
  }
  return out;
}

/**
 * The window's read (2A's matching, the names the rows say, and the counts' inputs). Null when a place is not the club's.
 * ⚠ A failed read THROWS.
 */
export async function closeSource(org: Org, role: OrgRole, input: {
  places: { venueId: string | null; facilityId: string | null }[]; firstDay: string; lastDay: string;
}): Promise<CloseSource | null> {
  const src = await placeClosureSource(org.id, input);
  if (!src) return null;
  const everyProgram = seesEveryProgram(role);
  const runsLeague = hasModuleEntitlement(org, 'module_house_league');
  const runsRep = hasModuleEntitlement(org, 'module_rep_teams');
  const runsTournaments = hasModuleEntitlement(org, 'module_tournaments');

  const lib = await getClubVenueLibrary({ id: org.id, planId: org.planId } as Parameters<typeof getClubVenueLibrary>[0]);
  const fieldName = new Map(lib.venues.flatMap(v => v.facilities.map(f => [f.id, f.name] as const)));

  const league = runsLeague ? src.league : [];
  const teamIds = [...teamsHearing(league)];
  const teams = await fetchAllIn<{ id: string; name: string }>(teamIds, (c, a, b) =>
    supabaseAdmin.from('league_teams').select('id, name').in('id', c).order('id').range(a, b));
  const teamName = new Map(teams.map(t => [t.id, t.name]));

  // The families of the teams playing, per season (a send is per division; a family is counted per division it hears).
  const families: string[][] = [];
  for (const s of src.seasons) {
    const mine = league.filter(g => g.seasonId === s.id);
    if (!mine.length) continue;
    const playing = teamsHearing(mine);
    const fam = familiesFor(await childrenOnTeams(s.id, [...playing]), playing);
    for (const kids of fam.values()) families.push([...new Set(kids.map(k => k.teamId))]);
  }

  // Rep: a house league admin gets the games on the place, still to start, as ids and times (K1: a count, no names).
  const rep = !runsRep ? [] : everyProgram ? src.rep : src.rep.filter(g => g.match === 'linked' && !g.started);
  const repReach = await repReachOf(org.id, [...new Set(rep.map(g => g.teamId))]);

  return {
    today: tournamentToday(),
    places: src.places,
    seasons: src.seasons.filter(s => league.some(g => g.seasonId === s.id)),
    league: league.map(g => ({
      id: g.id, seasonId: g.seasonId, divisionId: g.divisionId, published: g.published,
      homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId,
      home: teamName.get(g.homeTeamId) ?? '', away: teamName.get(g.awayTeamId) ?? '', scheduledAt: g.scheduledAt,
      field: g.facilityId ? fieldName.get(g.facilityId) ?? null : null, venueId: g.venueId,
      typed: g.typed, linkedToPlace: !!g.venueId,
      place: g.place, match: g.match, started: g.started, seen: g.seen,
    })),
    rep: rep.map(g => ({
      id: g.id, teamId: g.teamId,
      teamName: everyProgram ? g.teamName : '', opponent: everyProgram ? g.opponent : null, startsAt: g.startsAt,
      field: everyProgram && g.facilityId ? fieldName.get(g.facilityId) ?? null : null,
      venueId: everyProgram ? g.venueId : null,
      typed: everyProgram ? g.typed : null, linkedToPlace: !!g.venueId,
      place: g.place, match: g.match, started: g.started, seen: g.seen,
    })),
    repHidden: !everyProgram,
    tournaments: (runsTournaments ? src.tournaments : []).map(t => ({
      id: t.id, name: t.name, games: t.games, atPlace: t.atPlace, diamondIds: t.diamondIds, door: everyProgram,
    })),
    practices: src.practices,
    families,
    repReach,
  };
}

// ── After the press: the sends ─────────────────────────────────────────────────────────────────────────────────────

export interface ClosureSendResult {
  league: {
    verb: ClosureVerb; games: number; teams: number; divisions: (RainSendDivision & { seasonId: string })[];
    /** A season's send could not even start (its read failed): its changes wait in Changes to send. */
    unsent: boolean;
  };
  rep: { games: number; teams: { teamId: string; name: string; reach: RepReach; sent: boolean }[] };
}

/**
 * The sends that follow a press (K5): each Rainout record it wrote, per division, through the Rainout's own send; then the
 * rep coach email for the marks not yet emailed. Never throws: a failed division stays waiting in Changes to send (its
 * banner retries), a failed coach email is said in the result.
 * ⚖ A RETRIED PRESS (same key) runs this again: the house league send claims its held rows (one send wins), and the coach
 *   marks are CLAIMED before the email (a stamp only where none is), so two runs never email a coach twice; a failed email
 *   gives its claim back for the next retry.
 */
export async function sendAfterPress(p: {
  org: Org; actor: { id: string; email: string | null; role: OrgRole; name: string | null };
  closureIds: readonly string[]; rainoutIds: readonly string[];
}): Promise<ClosureSendResult> {
  const out: ClosureSendResult = { league: { verb: 'postponed', games: 0, teams: 0, divisions: [], unsent: false }, rep: { games: 0, teams: [] } };

  // House league, one Rainout record per closure, season and day: sent per season, its divisions together.
  let rainouts: { id: string; season_id: string; verb: ClosureVerb; game_ids: string[]; division_ids: string[] }[] = [];
  try {
    rainouts = await fetchAllIn<{ id: string; season_id: string; verb: ClosureVerb; game_ids: string[]; division_ids: string[] }>(
      [...p.rainoutIds], (c, a, b) => supabaseAdmin.from('league_rainouts').select('id, season_id, verb, game_ids, division_ids')
        .eq('org_id', p.org.id).in('id', c).order('id').range(a, b));
  } catch (err) {
    out.league.unsent = p.rainoutIds.length > 0;
    console.error('[place-closure] the house league records did not read (the changes wait in Changes to send):', err instanceof Error ? err.message : String(err));
  }
  const bySeason = new Map<string, { games: Set<string>; divisions: Set<string> }>();
  for (const r of rainouts) {
    out.league.verb = r.verb;
    const x = bySeason.get(r.season_id) ?? bySeason.set(r.season_id, { games: new Set(), divisions: new Set() }).get(r.season_id)!;
    r.game_ids.forEach(id => x.games.add(id)); r.division_ids.forEach(id => x.divisions.add(id));
  }
  const allGames = [...new Set(rainouts.flatMap(r => r.game_ids))];
  out.league.games = allGames.length;
  if (allGames.length) {
    try {
      const rows = await fetchAllIn<{ home_team_id: string; away_team_id: string }>(allGames, (c, a, b) =>
        supabaseAdmin.from('league_games').select('home_team_id, away_team_id').eq('org_id', p.org.id).in('id', c).order('id').range(a, b));
      out.league.teams = teamsHearing(rows.map(r => ({ homeTeamId: r.home_team_id, awayTeamId: r.away_team_id }))).size;
    } catch { /* the count is a courtesy; the sends below still run */ }
  }
  for (const [seasonId, x] of bySeason) {
    const divisionIds = [...x.divisions].sort();
    // One season's failure never hides another's: a season that can't start says its divisions failed (still waiting).
    const failedAll = () => divisionIds.map(divisionId => ({ divisionId, name: '', outcome: 'failed' as const, emails: 0, missed: 0, games: 0, seasonId }));
    try {
      const season = await getLeagueSeasonById(seasonId, p.org.id);
      if (!season) { out.league.divisions.push(...failedAll()); continue; }
      const divisions = await sendRainout({ org: p.org as unknown as MailOrg, season, actorId: p.actor.id, gameIds: [...x.games], divisionIds });
      out.league.divisions.push(...divisions.map(d => ({ ...d, seasonId })));
    } catch (err) {
      out.league.divisions.push(...failedAll());
      console.error('[place-closure] a season\'s send did not run (its changes wait in Changes to send):', err instanceof Error ? err.message : String(err));
    }
  }

  // Rep: one email per marked team (K10), the marks not yet emailed — claimed first.
  try {
    const marks = await fetchAllIn<{ id: string; closure_id: string; event_id: string; team_id: string; coach_emailed_at: string | null }>(
      [...p.closureIds], (c, a, b) => supabaseAdmin.from('rep_event_closure_marks').select('id, closure_id, event_id, team_id, coach_emailed_at')
        .eq('org_id', p.org.id).in('closure_id', c).order('id').range(a, b));
    // A game counts once, however many closures of the press marked it (D1, mig 549).
    out.rep.games = new Set(marks.map(m => m.event_id)).size;
    if (marks.length) {
      const teams = await mailTeamsOf(p.org.id, p.closureIds, marks.map(m => ({ markId: m.id, closureId: m.closure_id, eventId: m.event_id, teamId: m.team_id })));
      // A game is CLAIMED by its first mark (`markIds[0]`) alone, so two retries can never split one game's marks and both
      // email it; its other marks are stamped with it after the claim.
      const stamped = new Map(marks.map(m => [m.id, m.coach_emailed_at]));
      const games = teams.flatMap(t => t.games);
      const pending = games.filter(g => !stamped.get(g.markIds[0])).map(g => g.markIds[0]);
      const claimed = new Set<string>();
      if (pending.length && p.actor.email) {
        const at = new Date().toISOString();
        const { data, error } = await supabaseAdmin.from('rep_event_closure_marks').update({ coach_emailed_at: at })
          .eq('org_id', p.org.id).in('id', pending).is('coach_emailed_at', null).select('id');
        if (error) throw error;
        for (const r of (data ?? []) as { id: string }[]) claimed.add(r.id);
        const siblings = games.filter(g => claimed.has(g.markIds[0])).flatMap(g => g.markIds.slice(1));
        for (const ids of chunked(siblings)) {
          const { error: sErr } = await supabaseAdmin.from('rep_event_closure_marks').update({ coach_emailed_at: at })
            .eq('org_id', p.org.id).in('id', ids).is('coach_emailed_at', null);
          if (sErr) console.error('[place-closure] a game\'s other marks were not stamped:', sErr.message);
        }
      }
      const toSend = teams.map(t => ({ ...t, games: t.games.filter(g => claimed.has(g.markIds[0])) })).filter(t => t.games.length);
      const sent = await sendClosureCoachEmails({ org: p.org, actor: p.actor, kind: 'closed', teams: toSend });
      // A failed email gives its claim back (every mark of its games), so the next retry of this press tries that coach again.
      const failedMarks = toSend.filter(t => !sent.find(x => x.teamId === t.teamId)?.sent).flatMap(t => t.games.flatMap(g => g.markIds));
      for (const ids of chunked(failedMarks)) {
        const { error } = await supabaseAdmin.from('rep_event_closure_marks').update({ coach_emailed_at: null }).eq('org_id', p.org.id).in('id', ids);
        if (error) console.error('[place-closure] a failed coach email\'s claim was not given back:', error.message);
      }
      const failedSet = new Set(failedMarks);
      // A team is told when every one of its games is now emailed (this run or an earlier one).
      const emailedNow = (g: { markIds: string[] }) => !!stamped.get(g.markIds[0]) || (claimed.has(g.markIds[0]) && !failedSet.has(g.markIds[0]));
      out.rep.teams = teams.map(t => ({ teamId: t.teamId, name: t.teamName, reach: t.reach,
        sent: t.games.length > 0 && t.games.every(emailedNow) }));
    }
  } catch (err) {
    console.error('[place-closure] the rep coach emails did not run:', err instanceof Error ? err.message : String(err));
  }
  return out;
}

/** Marks grouped by their game, in first-seen order. */
function byEvent<T extends { eventId: string }>(marks: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const m of marks) (out.get(m.eventId) ?? out.set(m.eventId, []).get(m.eventId)!).push(m);
  return out;
}

/**
 * The rep teams a set of marks belongs to, with their games' words and whom each email reaches. ONE entry per game: a game
 * two closures marked (D1) lists once, its marks together (`markIds`, the first claims it), named by its park
 * ("2 diamonds at Lions Park", `markPlaceOfAll`). `severalDiamonds`: Reopen's D1 games, whose words say "the diamonds at
 * Lions Park that were closed" (/legal).
 */
async function mailTeamsOf(orgId: string, closureIds: readonly string[], marks: { markId: string; closureId: string; eventId: string; teamId: string }[],
  severalDiamonds?: ReadonlySet<string>): Promise<CoachMailTeam[]> {
  const teamIds = [...new Set(marks.map(m => m.teamId))];
  const [closures, events, teams, heads, staff] = await Promise.all([
    fetchAllIn<{ id: string; scope: ClosureScope; org_venue_id: string | null; place_name: string | null; facility_name: string | null; first_day: string; last_day: string; press_seq: number }>(
      [...closureIds], (c, a, b) => supabaseAdmin.from('org_place_closures').select('id, scope, org_venue_id, place_name, facility_name, first_day, last_day, press_seq')
        .eq('org_id', orgId).in('id', c).order('id').range(a, b)),
    fetchAllIn<{ id: string; starts_at: string; opponent: string | null }>([...new Set(marks.map(m => m.eventId))], (c, a, b) =>
      supabaseAdmin.from('rep_team_events').select('id, starts_at, opponent').in('id', c).order('id').range(a, b)),
    fetchAllIn<{ id: string; name: string }>(teamIds, (c, a, b) =>
      supabaseAdmin.from('rep_teams').select('id, name').in('id', c).order('id').range(a, b)),
    loadHeadCoaches(orgId, teamIds),
    listActiveStaffForTeams(teamIds),
  ]);
  const closureOf = new Map(closures.map(c => [c.id, c]));
  const eventOf = new Map(events.map(e => [e.id, e]));
  const nameOf = new Map(teams.map(t => [t.id, t.name]));
  const otherIds = [...new Set(staff.filter(s => s.coachRole !== 'head_coach').map(s => s.userId))];
  const ids = await resolveCoachUserIdentities(orgId, otherIds);
  return teamIds.map(teamId => {
    const headPeople = (heads.get(teamId)?.people ?? []).filter(p => !!p.email).map(p => ({ name: p.name, email: p.email! }));
    const otherPeople = staff.filter(s => s.teamId === teamId && s.coachRole !== 'head_coach')
      .map(s => ids.get(s.userId)).filter((x): x is { displayName: string | null; email: string } => !!x?.email)
      .map(x => ({ name: x.displayName, email: x.email }));
    const reach: RepReach = headPeople.length ? 'head' : otherPeople.length ? 'others' : 'none';
    return {
      teamId, teamName: nameOf.get(teamId) ?? '', reach,
      to: reach === 'head' ? headPeople : reach === 'others' ? otherPeople : [],
      games: [...byEvent(marks.filter(m => m.teamId === teamId))].flatMap(([eventId, mine]) => {
        const e = eventOf.get(eventId);
        const cs = mine.flatMap(m => { const c = closureOf.get(m.closureId); return c ? [{ m, c }] : []; })
          .sort((x, y) => x.c.press_seq - y.c.press_seq || x.m.markId.localeCompare(y.m.markId));
        if (!e || !cs.length) return [];
        const c = cs[0].c;
        const words = cs.length > 1 ? markPlaceOfAll(cs.map(x => ({ scope: x.c.scope, venueId: x.c.org_venue_id, placeName: x.c.place_name, facilityName: x.c.facility_name }))) : undefined;
        const reopenPark = severalDiamonds?.has(eventId) ? c.place_name : null;
        return [{
          markIds: cs.map(x => x.m.markId), startsAt: e.starts_at, opponent: e.opponent,
          closure: { scope: c.scope, placeName: c.place_name, facilityName: c.facility_name, firstDay: c.first_day, lastDay: c.last_day },
          ...(words ? { placeWords: words } : {}), ...(reopenPark ? { reopenPark } : {}),
        }];
      }).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    };
  });
}

// ── The Venue library's closed rows ────────────────────────────────────────────────────────────────────────────────

/** The club's closures still showing (not reopened, not past Until): the Venue library's rows and the Overview's line. */
export async function showingClosures(orgId: string, now: Date = new Date()): Promise<StaffClosure[]> {
  const at = now.toISOString();
  const { data, error } = await supabaseAdmin.from('org_place_closures')
    .select('id, scope, org_venue_id, place_name, facility_name, first_day, last_day, verb, created_at, closed_by, shows_from, ends_at')
    .eq('org_id', orgId).is('reopened_at', null).lte('shows_from', at).gt('ends_at', at)
    .order('created_at').order('press_seq');
  if (error) throw error;
  const rows = (data ?? []) as { id: string; scope: ClosureScope; org_venue_id: string | null; place_name: string | null; facility_name: string | null;
    first_day: string; last_day: string; verb: ClosureVerb; created_at: string; closed_by: string | null; shows_from: string; ends_at: string }[];
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const [rainouts, marks, people] = await Promise.all([
    fetchAllIn<{ closure_id: string; season_id: string; game_ids: string[] }>(ids, (c, a, b) =>
      supabaseAdmin.from('league_rainouts').select('closure_id, season_id, game_ids').in('closure_id', c).order('id').range(a, b)),
    standingMarksBy(orgId, 'closure_id', ids),
    resolveCoachUserIdentities(orgId, [...new Set(rows.flatMap(r => (r.closed_by ? [r.closed_by] : [])))]),
  ]);
  const gameIds = [...new Set(rainouts.flatMap(r => r.game_ids))];
  const games = await fetchAllIn<{ id: string; status: string }>(gameIds, (c, a, b) =>
    supabaseAdmin.from('league_games').select('id, status').in('id', c).order('id').range(a, b));
  const statusOf = new Map(games.map(g => [g.id, g.status]));
  const teamIds = [...new Set(marks.map(m => m.teamId))];
  const [teams, onGames] = await Promise.all([
    fetchAllIn<{ id: string; name: string }>(teamIds, (c, a, b) =>
      supabaseAdmin.from('rep_teams').select('id, name').in('id', c).order('id').range(a, b)),
    standingMarksBy(orgId, 'event_id', marks.map(m => m.eventId)),
  ]);
  const teamName = new Map(teams.map(t => [t.id, t.name]));
  return rows.map(r => {
    const mine = rainouts.filter(x => x.closure_id === r.id);
    const own = marks.filter(x => x.closureId === r.id);
    // D1: a game another closure still marks keeps its mark when this one reopens, and its coach isn't told yet.
    const facts = reopenFacts(own, onGames, at);
    const kept = own.filter(x => facts.holders.has(x.id));
    const m = own.filter(x => !facts.holders.has(x.id));
    const holders = [...new Map(kept.flatMap(x => facts.holders.get(x.id)!).map(h => [h.closureId, h.closure])).values()];
    return {
      id: r.id, scope: r.scope, venueId: r.org_venue_id, placeName: r.place_name, facilityName: r.facility_name,
      firstDay: r.first_day, lastDay: r.last_day, verb: r.verb, closedAt: r.created_at, showsFrom: r.shows_from, endsAt: r.ends_at,
      closedBy: r.closed_by ? people.get(r.closed_by)?.displayName ?? null : null,
      // Still as this closure left them (postponed still postponed, cancelled still cancelled); only a postponed one waits
      // for a date (Reopen reads `verb` with it).
      leagueCalledOff: new Set(mine.flatMap(x => x.game_ids).filter(id => statusOf.get(id) === r.verb)).size,
      seasonIds: [...new Set(mine.map(x => x.season_id))],
      marks: own.length, markTeams: [...new Set(m.map(x => x.teamId))],
      markTeamNames: [...new Set(m.map(x => teamName.get(x.teamId) ?? ''))].filter(Boolean),
      marksKept: kept.length,
      keptWhile: closedParks(holders),
      marksSeveral: m.length > 0 && m.every(x => facts.severalDiamonds.has(x.eventId)),
    };
  });
}

// ── The marks Reopen reads ─────────────────────────────────────────────────────────────────────────────────────────

/** A rep mark that still stands by its game (not moved, not cancelled), with its closure, reopened or not. */
type GameMark = RepMark & {
  reopenToldAt: string | null;
  closure: Pick<StaffClosure, 'scope' | 'venueId' | 'placeName' | 'facilityName'> & { reopenedAt: string | null; endsAt: string };
};

/** The standing-by-the-game marks of these closures, or on these games. */
async function standingMarksBy(orgId: string, by: 'closure_id' | 'event_id', ids: readonly string[]): Promise<GameMark[]> {
  type Closure = { scope: ClosureScope; org_venue_id: string | null; place_name: string | null; facility_name: string | null; reopened_at: string | null; ends_at: string };
  type Row = { id: string; closure_id: string; event_id: string; team_id: string; marked_starts_at: string;
    marked_org_venue_id: string | null; marked_facility_id: string | null; marked_place_id: string | null; marked_location: string | null;
    coach_emailed_at: string | null; reopen_told_at: string | null; org_place_closures: Closure | Closure[] | null };
  const rows = await fetchAllIn<Row>([...ids], (c, a, b) => supabaseAdmin.from('rep_event_closure_marks')
    .select('id, closure_id, event_id, team_id, marked_starts_at, marked_org_venue_id, marked_facility_id, marked_place_id, marked_location, coach_emailed_at, reopen_told_at, org_place_closures!inner(scope, org_venue_id, place_name, facility_name, reopened_at, ends_at)')
    .eq('org_id', orgId).in(by, c).order('id').range(a, b));
  if (!rows.length) return [];
  const events = await fetchAllIn<{ id: string; starts_at: string; status: string; org_venue_id: string | null; org_venue_facility_id: string | null; place_id: string | null; location: string | null }>(
    [...new Set(rows.map(r => r.event_id))], (c, a, b) => supabaseAdmin.from('rep_team_events')
      .select('id, starts_at, status, org_venue_id, org_venue_facility_id, place_id, location').in('id', c).order('id').range(a, b));
  const now = new Map(events.map(e => [e.id, { id: e.id, startsAt: e.starts_at, status: e.status, venueId: e.org_venue_id, facilityId: e.org_venue_facility_id, placeId: e.place_id, location: e.location }]));
  return rows.flatMap(r => {
    const c = Array.isArray(r.org_place_closures) ? r.org_place_closures[0] : r.org_place_closures;
    const mark: RepMark = {
      id: r.id, closureId: r.closure_id, eventId: r.event_id, teamId: r.team_id, markedStartsAt: r.marked_starts_at,
      markedVenueId: r.marked_org_venue_id, markedFacilityId: r.marked_facility_id, markedPlaceId: r.marked_place_id,
      markedLocation: r.marked_location, coachEmailedAt: r.coach_emailed_at,
    };
    if (!c || markSpent(mark, now.get(r.event_id))) return [];
    return [{ ...mark, reopenToldAt: r.reopen_told_at, closure: {
      scope: c.scope, venueId: c.org_venue_id, placeName: c.place_name, facilityName: c.facility_name, reopenedAt: c.reopened_at, endsAt: c.ends_at,
    } }];
  });
}

/**
 * D1 (mig 549), for each of one closure's marks against every standing mark on its game (`onGames`):
 *   `holders` — the OTHER closures still closing that game (not reopened, not past their last day): reopening leaves such a
 *   game marked, and its coach gets no "reopened" line until the last of them reopens.
 *   `severalDiamonds` — the games (by id) whose marks span two or more diamonds of this closure's park.
 */
function reopenFacts(own: readonly GameMark[], onGames: readonly GameMark[], nowIso: string) {
  const holders = new Map<string, GameMark[]>();
  const severalDiamonds = new Set<string>();
  const nowMs = Date.parse(nowIso);
  const byGame = byEvent(onGames);
  for (const m of own) {
    const all = byGame.get(m.eventId) ?? [];
    const held = all.filter(x => x.closureId !== m.closureId && !x.closure.reopenedAt && Date.parse(x.closure.endsAt) > nowMs);
    if (held.length) holders.set(m.id, held);
    if (m.closure.scope === 'diamond' && m.closure.venueId) {
      const diamonds = new Set(all.filter(x => x.closure.scope === 'diamond' && x.closure.venueId === m.closure.venueId).map(x => x.closure.facilityName));
      if (diamonds.size > 1) severalDiamonds.add(m.eventId);
    }
  }
  return { holders, severalDiamonds };
}

/** What a Reopen tells the coaches. */
export interface ReopenTold {
  /** This closure's marks whose coach is told now. */
  standing: RepMark[];
  /** Of their games, the ones that had marks on two or more diamonds of this park (the email says "the diamonds at …"). */
  severalDiamonds: Set<string>;
  /** Per such game, every standing mark on it not yet told, in one order: the telling claims them all at once. */
  gameMarks: Map<string, string[]>;
}

/**
 * What Reopen of one closure tells the coaches (K11 A, D1): its standing marks, not yet told, whose game no other closure
 * still closes. ⚠ Read AFTER the reopen stamps the closure: two diamonds reopened at the same moment would otherwise each
 * see the other still holding the game, and nobody would be told. After the stamps, at least the later read sees neither.
 */
export async function reopenTold(orgId: string, closureId: string, now: Date = new Date()): Promise<ReopenTold> {
  const own = await standingMarksBy(orgId, 'closure_id', [closureId]);
  const onGames = await standingMarksBy(orgId, 'event_id', own.map(m => m.eventId));
  const facts = reopenFacts(own, onGames, now.toISOString());
  const standing = own.filter(m => !m.reopenToldAt && !facts.holders.has(m.id));
  const byGame = byEvent(onGames.filter(m => !m.reopenToldAt));
  const gameMarks = new Map(standing.map(m => [m.eventId, (byGame.get(m.eventId) ?? []).map(x => x.id).sort()]));
  return { standing, severalDiamonds: facts.severalDiamonds, gameMarks };
}

/**
 * Reopen's emails (K11 A): each marked game's coach that still stands (the coach hasn't moved or cancelled it) gets one
 * line. Never throws.
 */
export async function reopenCoachEmails(p: ReopenTold & {
  org: Org; actor: { id: string; email: string | null; role: OrgRole; name: string | null }; closureId: string;
}) {
  try {
    if (!p.standing.length || !p.actor.email) return { teams: 0 };
    // A game is CLAIMED whole (`reopen_told_at`, a stamp only where none is), every closure's mark on it in one statement,
    // and it is this run's only if its first mark came back: so a retried Reopen, a second Reopen at the same moment, or
    // Reopen pressed again on an earlier diamond never emails a coach twice. A failed email gives the claim back.
    const marksOfGames = p.standing.flatMap(m => p.gameMarks.get(m.eventId) ?? []);
    const claimed = new Set<string>();
    for (const ids of chunked([...new Set(marksOfGames)])) {
      const { data, error } = await supabaseAdmin.from('rep_event_closure_marks').update({ reopen_told_at: new Date().toISOString() })
        .eq('org_id', p.org.id).in('id', ids).is('reopen_told_at', null).select('id');
      if (error) throw error;
      for (const r of (data ?? []) as { id: string }[]) claimed.add(r.id);
    }
    const mine = p.standing.filter(m => claimed.has(p.gameMarks.get(m.eventId)?.[0] ?? ''));
    if (!mine.length) return { teams: 0 };
    const teams = (await mailTeamsOf(p.org.id, [p.closureId], mine.map(m => ({ markId: m.id, closureId: m.closureId, eventId: m.eventId, teamId: m.teamId })), p.severalDiamonds))
      .filter(t => t.games.length);
    const sent = await sendClosureCoachEmails({ org: p.org, actor: p.actor, kind: 'reopened', teams });
    const failed = new Set(teams.filter(t => !sent.find(x => x.teamId === t.teamId)?.sent).flatMap(t => t.games.flatMap(g => g.markIds)));
    const back = mine.filter(m => failed.has(m.id)).flatMap(m => (p.gameMarks.get(m.eventId) ?? []).filter(id => claimed.has(id)));
    for (const ids of chunked(back)) {
      const { error } = await supabaseAdmin.from('rep_event_closure_marks').update({ reopen_told_at: null }).eq('org_id', p.org.id).in('id', ids);
      if (error) console.error('[place-closure] a failed reopen email\'s claim was not given back:', error.message);
    }
    return { teams: sent.filter(x => x.sent).length };
  } catch (err) {
    console.error('[place-closure] the reopen coach emails did not run:', err instanceof Error ? err.message : String(err));
    return { teams: 0 };
  }
}
