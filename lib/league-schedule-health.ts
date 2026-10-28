/**
 * league-schedule-health.ts — A HOUSE-LEAGUE SEASON'S SCHEDULE HEALTH (House League Stage 9d-2a; ruling 9d2·4, frames d1–d4,
 * drawings TdXm5jmTEJ9qPvR3T5H9qU v4; words HOUSE_LEAGUE_STAGE9D2_11B_COPY.md "Stage 9d-2a" d). Client-safe, pure.
 *
 * ⚖ THE TOURNAMENT'S BUTTON AND WINDOW, A LEAGUE'S RULES (9d2·4). The tournament engine (lib/schedule-metrics.ts) asks a
 * tournament's questions — rest between games on one day, venue moves, early and late starts — and scored Dev House League
 * 2026 97, Healthy, with a cancelled game never replayed and a postponed game with no date (`.probe/hl/h9d2.mts`): it counts
 * a cancelled game as nothing at all and a postponed one as played. A league's questions are a season's:
 *   GAMES ON PLAN (30) — every team gets the games the schedule promised. The plan is a division's own: the number of games
 *     most of its teams were given, counting every game the schedule holds whatever became of it (there is nowhere to store
 *     "games per team" without a migration, and the schedule already says it). A team HAS its games that are on or played;
 *     a postponed game is not had until it has a date (it is said as "1 postponed"), and a cancelled one is not had and is
 *     never replayed by itself — "Their Jun 14 game was cancelled and not replayed".
 *   CLASHES (30) — two bookings on one facility at once, games AND practices together (the clash pool the convenor books
 *     from), by house league's own rule (lib/league-schedule-conflict.ts — the club's cross-program rule never compares two of
 *     one program's bookings). Each clash costs a third of the 30. A booking at a typed place cannot be checked, so the clash
 *     rating is only claimed for the share of bookings that could be ("2 not checked"), as the tournament's coverage does.
 *     Clashes with the club's OTHER programs are the server's to add (`clashReportForLeagueRows`); they are not in this score.
 *   TWICE IN A DAY (15) — a team on twice in one day, when the rules say no (9d2·4's "twice in a day allowed = no").
 *   HOME AND AWAY (15) — each team's home and away within the tolerance (1): counted over the games the schedule holds, a
 *     postponed one included (it is still that team's home game), a cancelled one not.
 *   BYES (10) — no team with byes two weeks running (the generator's own check, lib/league-game-generator.ts).
 * Why these weights (the drawing's −5/−3/−1 were placeholders): the two that break a family's evening — a game owed and
 * not given, two teams sent to one diamond — carry 60 between them, equally; the three that are fairness, not breakage,
 * carry the rest, byes least because a bye two weeks running is a team waiting, not a night gone wrong. A season with one
 * of the first two badly wrong falls below Healthy on that alone. Bands are the tournament's: 85 Healthy, 70 Review, below
 * Needs work.
 * Movement is dropped (9d2·4): a house-league team does not travel between games in a day. "Places" stays in team detail
 * as a fact, and so does "Prime time" (each team's share of its division's rarest time, as the generator shares it out);
 * neither costs a point.
 *
 * ⚖ THE RULES ARE SAID, NOT ADJUSTED, IN 9d-2a (owner 2026-10-27, step 6). No column holds a season's rules, and 9d-2a adds
 * no migration, so the window's foot says the three rules the score uses and has no "Adjust the rules" door; the door and
 * its save arrive with 9d-2b's migrations. Games per team is each division's own plan (above), said per division.
 */
import {
  byesBackToBack, GENERATE_WORDS, primeTimeWords, shortDayWords, twiceInADay, type DatedGame, type SlotTime,
} from './league-game-generator.ts';
import {
  bookingKey, findLeagueBookingConflicts, isBlockingConflict, type LeagueBooking,
} from './league-schedule-conflict.ts';
import { formatStoredDate, mondayOfDay, orgDayKey, utcToZonedInputs } from './timezone.ts';
import { formatTime, pluralize } from './utils.ts';
import { weekdayOf } from './permit-time.ts';
import type { ScheduleHealthTone } from './schedule-metrics.ts';
import type { LeagueGame, LeaguePractice } from './types.ts';

/** A `league_games` row as health reads a game. Typed `Required` on purpose (as `scheduleMetricGameFromRow`): a field health
 *  learns to read fails the build here until the server passes it too. */
export interface LeagueHealthGame {
  id: string;
  divisionId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: string | null;
  endsAt: string | null;
  status: string;
  venueId: string | null;
  facilityId: string | null;
  location: string | null;
}
export interface LeagueHealthPractice {
  id: string;
  divisionId: string | null;
  teamId: string;
  scheduledAt: string | null;
  endsAt: string | null;
  status: string;
  venueId: string | null;
  facilityId: string | null;
  location: string | null;
  clubSlotId: string | null;
}
export interface LeagueHealthTeam { id: string; name: string; divisionId: string }

export function leagueHealthGameFromRow(row: {
  id: string; division_id: string; home_team_id: string; away_team_id: string; scheduled_at: string | null;
  ends_at: string | null; status: string; org_venue_id: string | null; org_venue_facility_id: string | null; location: string | null;
}): Required<LeagueHealthGame> {
  return {
    id: row.id, divisionId: row.division_id, homeTeamId: row.home_team_id, awayTeamId: row.away_team_id,
    scheduledAt: row.scheduled_at, endsAt: row.ends_at, status: row.status,
    venueId: row.org_venue_id, facilityId: row.org_venue_facility_id, location: row.location,
  };
}

export function leagueHealthPracticeFromRow(row: {
  id: string; division_id: string | null; team_id: string; scheduled_at: string | null; ends_at: string | null; status: string;
  org_venue_id: string | null; org_venue_facility_id: string | null; location: string | null; club_schedule_slot_id: string | null;
}): Required<LeagueHealthPractice> {
  return {
    id: row.id, divisionId: row.division_id, teamId: row.team_id, scheduledAt: row.scheduled_at, endsAt: row.ends_at,
    status: row.status, venueId: row.org_venue_id, facilityId: row.org_venue_facility_id, location: row.location,
    clubSlotId: row.club_schedule_slot_id,
  };
}

/** The page's season as health reads it (the page holds every division's games and practices already; no second read). */
export function leagueHealthGameOf(g: LeagueGame): Required<LeagueHealthGame> {
  return {
    id: g.id, divisionId: g.divisionId, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId, scheduledAt: g.scheduledAt,
    endsAt: g.endsAt, status: g.status, venueId: g.orgVenueId, facilityId: g.orgVenueFacilityId, location: g.location,
  };
}
export function leagueHealthPracticeOf(p: LeaguePractice): Required<LeagueHealthPractice> {
  return {
    id: p.id, divisionId: p.divisionId, teamId: p.teamId, scheduledAt: p.scheduledAt, endsAt: p.endsAt, status: p.status,
    venueId: p.orgVenueId, facilityId: p.orgVenueFacilityId, location: p.location, clubSlotId: p.clubScheduleSlotId,
  };
}

/** The season's rules (frame d3). No column holds them yet, so these are the rules 9d2·4 drew. */
export interface LeagueHealthRules { twiceInADayAllowed: boolean; homeAwayTolerance: number }
export const DEFAULT_LEAGUE_HEALTH_RULES: LeagueHealthRules = { twiceInADayAllowed: false, homeAwayTolerance: 1 };

export const LEAGUE_HEALTH_WEIGHTS = { games: 30, clashes: 30, twice: 15, homeAway: 15, byes: 10 } as const;
/** One clash costs this share of the clash weight. */
const CLASH_COST = 1 / 3;

export type LeagueHealthIssue =
  /** A team (or a cancelled game's two teams) short of its division's plan. `cancelled` names the game that was never
   *  replayed when that is why. */
  | { kind: 'short'; teamIds: string[]; have: number; plan: number; cancelled: { gameId: string; day: string } | null }
  | { kind: 'postponed'; gameId: string; homeTeamId: string; awayTeamId: string; day: string | null }
  | { kind: 'clash'; keys: [string, string]; venueId: string; facilityId: string | null; day: string; startMs: number }
  | { kind: 'twice_in_a_day'; teamId: string; day: string }
  | { kind: 'byes_back_to_back'; teamId: string; weeks: [string, string] }
  /** A division's teams off by more than the tolerance. */
  | { kind: 'home_away'; divisionId: string; teams: { teamId: string; home: number; away: number }[] }
  /** Bookings at a typed place; `keys` are the page's booking keys, in date order (the door shows the first). */
  | { kind: 'unchecked'; games: number; practices: number; keys: string[] };

export interface LeagueTeamHealth {
  teamId: string;
  name: string;
  divisionId: string;
  have: number;
  plan: number;
  postponed: number;
  home: number;
  away: number;
  byes: number;
  places: number;
  /** Its share of its division's rarest time: 'even' when every team's is within one (or the division has one time). */
  primeTime: 'even' | { games: number; time: SlotTime };
}

export interface LeagueScheduleHealth {
  /** Games with a date that aren't cancelled or postponed: none scores nothing ("—"). */
  timedGames: number;
  /** Divisions with games ("both divisions"). */
  divisions: number;
  score: number;
  tone: ScheduleHealthTone;
  tiles: {
    games: { onPlan: number; teams: number };
    homeAway: { off: number; tolerance: number };
    byes: { backToBack: number };
    clashes: { pairs: number; notChecked: number };
  };
  breakdown: Record<keyof typeof LEAGUE_HEALTH_WEIGHTS, number>;
  issues: LeagueHealthIssue[];
  teams: LeagueTeamHealth[];
  rules: LeagueHealthRules;
  /** Each division's games per team, the plan the score measures against (the foot says it). */
  plans: { divisionId: string; games: number }[];
}

const isOn = (status: string) => status === 'scheduled' || status === 'completed';

/** The most common count in a list (the larger on a tie); 0 for none. */
function modeOf(counts: readonly number[]): number {
  const m = new Map<number, number>();
  for (const c of counts) m.set(c, (m.get(c) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0;
}

export function buildLeagueScheduleHealth(input: {
  games: readonly LeagueHealthGame[];
  practices: readonly LeagueHealthPractice[];
  teams: readonly LeagueHealthTeam[];
  rules?: LeagueHealthRules;
}): LeagueScheduleHealth {
  const rules = input.rules ?? DEFAULT_LEAGUE_HEALTH_RULES;
  const teams = input.teams;
  const issues: LeagueHealthIssue[] = [];
  const live = input.games.filter(g => g.status !== 'cancelled');
  const onGames = input.games.filter(g => isOn(g.status) && g.scheduledAt);
  const timedGames = onGames.length;
  const divisionIds = [...new Set(input.games.map(g => g.divisionId))];

  // ── Games on plan ──
  const count = (pred: (g: LeagueHealthGame) => boolean) => {
    const m = new Map(teams.map(t => [t.id, 0]));
    for (const g of input.games) if (pred(g)) for (const t of [g.homeTeamId, g.awayTeamId]) if (m.has(t)) m.set(t, m.get(t)! + 1);
    return m;
  };
  const planned = count(() => true);
  const have = count(g => isOn(g.status) && !!g.scheduledAt);
  const postponedOf = count(g => g.status === 'postponed' || (g.status === 'scheduled' && !g.scheduledAt));
  const plan = new Map<string, number>();
  for (const d of divisionIds) {
    const mine = teams.filter(t => t.divisionId === d);
    const p = modeOf(mine.map(t => planned.get(t.id)!));
    for (const t of mine) plan.set(t.id, p);
  }
  const short = (id: string) => have.get(id)! < (plan.get(id) ?? 0);

  // Postponed (and undated) games first: each says so, with its date.
  for (const g of input.games.filter(x => x.status === 'postponed' || (x.status === 'scheduled' && !x.scheduledAt))) {
    issues.push({ kind: 'postponed', gameId: g.id, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId, day: g.scheduledAt ? orgDayKey(g.scheduledAt) : null });
  }
  // A cancelled game whose two teams are short: one issue naming the game. Any other short team: one issue each, unless
  // its postponed games already explain it (that issue is said above).
  const explained = new Set<string>();
  for (const g of input.games.filter(x => x.status === 'cancelled')) {
    const both = [g.homeTeamId, g.awayTeamId].filter(t => short(t) && !explained.has(t));
    if (!both.length) continue;
    both.forEach(t => explained.add(t));
    issues.push({ kind: 'short', teamIds: both, have: have.get(both[0])!, plan: plan.get(both[0])!, cancelled: { gameId: g.id, day: g.scheduledAt ? orgDayKey(g.scheduledAt) : '' } });
  }
  for (const t of teams) {
    if (!short(t.id) || explained.has(t.id)) continue;
    if (have.get(t.id)! + postponedOf.get(t.id)! >= plan.get(t.id)!) continue;
    issues.push({ kind: 'short', teamIds: [t.id], have: have.get(t.id)!, plan: plan.get(t.id)!, cancelled: null });
  }

  // ── Clashes: games and practices together, by house league's own rule (lib/league-schedule-conflict.ts — the club's
  //    cross-program rule never compares two of one program's bookings; this is the check the schedule's saves run).
  //    A structured match is a clash; two identical typed names only MIGHT be one place and are not counted. Two teams'
  //    practices from one club slot are that slot's one booking ("teams at once", 11b), never a clash.
  const onPractices = input.practices.filter(p => p.status !== 'cancelled' && p.scheduledAt);
  const gameBookings: LeagueBooking[] = onGames.map(x => ({ id: x.id, kind: 'game', startsAt: x.scheduledAt, endsAt: x.endsAt, status: x.status, orgVenueId: x.venueId, orgVenueFacilityId: x.facilityId, location: x.location }));
  const practiceBookings: LeagueBooking[] = onPractices.map(x => ({ id: x.id, kind: 'practice', startsAt: x.scheduledAt, endsAt: x.endsAt, status: x.status, orgVenueId: x.venueId, orgVenueFacilityId: x.facilityId, location: x.location }));
  const pool = [...gameBookings, ...practiceBookings];
  const clubSlotOf = new Map(onPractices.map(x => [`practice:${x.id}`, x.clubSlotId]));
  const pageKey = (b: LeagueBooking) => `league_${b.kind}:${b.id}`;
  const clashes: Extract<LeagueHealthIssue, { kind: 'clash' }>[] = [];
  for (const b of pool) {
    for (const c of findLeagueBookingConflicts(b, pool)) {
      const ka = bookingKey(b), kb = bookingKey(c.partner);
      if (ka >= kb || !isBlockingConflict(c)) continue;
      const slotA = clubSlotOf.get(ka), slotB = clubSlotOf.get(kb);
      if (slotA && slotA === slotB) continue;
      clashes.push({
        kind: 'clash', keys: [pageKey(b), pageKey(c.partner)], venueId: b.orgVenueId ?? '', facilityId: b.orgVenueFacilityId ?? null,
        day: orgDayKey(b.startsAt!), startMs: Math.max(Date.parse(b.startsAt!), Date.parse(c.partner.startsAt!)),
      });
    }
  }
  issues.push(...clashes);
  // Not checked = not on one of the club's venues: the place field's own words ("A typed place isn't checked for clashes").
  // The league rule's text match (two identical typed names) only warns, so it is not a check this score can claim.
  const unchecked = pool.filter(x => !x.orgVenueId).sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));
  const uncheckedGames = unchecked.filter(x => x.kind === 'game').length;
  const uncheckedPractices = unchecked.length - uncheckedGames;
  const bookings = pool.length;
  const notChecked = unchecked.length;

  // ── Twice in a day, byes: the generator's own checks, per division ──
  const datedOf = (d: string): DatedGame[] => onGames.filter(g => g.divisionId === d).map(g => ({ homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId, day: orgDayKey(g.scheduledAt!) }));
  const twice = rules.twiceInADayAllowed ? [] : divisionIds.flatMap(d => twiceInADay(teams.filter(t => t.divisionId === d).map(t => t.id), datedOf(d)));
  const byes = divisionIds.flatMap(d => byesBackToBack(teams.filter(t => t.divisionId === d).map(t => t.id), datedOf(d)));
  issues.push(...twice, ...byes);

  // ── Home and away ──
  const home = new Map(teams.map(t => [t.id, 0]));
  const away = new Map(teams.map(t => [t.id, 0]));
  for (const g of live) {
    if (home.has(g.homeTeamId)) home.set(g.homeTeamId, home.get(g.homeTeamId)! + 1);
    if (away.has(g.awayTeamId)) away.set(g.awayTeamId, away.get(g.awayTeamId)! + 1);
  }
  const offTeams = teams.filter(t => Math.abs(home.get(t.id)! - away.get(t.id)!) > rules.homeAwayTolerance);
  for (const d of divisionIds) {
    const mine = offTeams.filter(t => t.divisionId === d);
    if (mine.length) issues.push({ kind: 'home_away', divisionId: d, teams: mine.map(t => ({ teamId: t.id, home: home.get(t.id)!, away: away.get(t.id)! })) });
  }
  if (notChecked) issues.push({ kind: 'unchecked', games: uncheckedGames, practices: uncheckedPractices, keys: unchecked.map(pageKey) });

  // ── The score ──
  const teamsWithGames = teams.filter(t => divisionIds.includes(t.divisionId));
  const n = teamsWithGames.length || 1;
  const onPlan = teamsWithGames.filter(t => !short(t.id)).length;
  const coverage = bookings ? (bookings - notChecked) / bookings : 1;
  const W = LEAGUE_HEALTH_WEIGHTS;
  const breakdown = {
    games: W.games * (onPlan / n),
    clashes: W.clashes * Math.max(0, 1 - clashes.length * CLASH_COST) * coverage,
    twice: W.twice * (1 - Math.min(1, new Set(twice.map(w => w.teamId)).size / n)),
    homeAway: W.homeAway * (1 - offTeams.length / n),
    byes: W.byes * (1 - byes.length / n),
  };
  const score = Math.max(0, Math.min(100, Math.round(Object.values(breakdown).reduce((a, b) => a + b, 0))));
  const tone: ScheduleHealthTone = score >= 85 ? 'good' : score >= 70 ? 'warning' : 'danger';

  // ── Team detail ──
  const placesOf = new Map(teams.map(t => [t.id, new Set<string>()]));
  for (const g of onGames) for (const t of [g.homeTeamId, g.awayTeamId]) placesOf.get(t)?.add(g.venueId ? `${g.venueId}|${g.facilityId ?? ''}` : `typed:${g.location ?? ''}`);
  const byeWeeks = new Map<string, number>();
  for (const d of divisionIds) {
    const dated = datedOf(d);
    const weeks = new Set(dated.map(g => mondayOfDay(g.day)));
    for (const t of teams.filter(x => x.divisionId === d)) {
      const plays = new Set(dated.filter(g => g.homeTeamId === t.id || g.awayTeamId === t.id).map(g => mondayOfDay(g.day)));
      byeWeeks.set(t.id, [...weeks].filter(w => !plays.has(w)).length);
    }
  }
  // Prime time, as the generator shares it out: the division's rarest time as it is SAID (a weekday and its part of the day).
  const primeOf = new Map<string, LeagueTeamHealth['primeTime']>();
  for (const d of divisionIds) {
    const mine = teams.filter(x => x.divisionId === d);
    const times = new Map<string, SlotTime & { games: number }>();
    const per = new Map<string, number>();
    for (const g of onGames.filter(x => x.divisionId === d)) {
      const { date, time } = utcToZonedInputs(g.scheduledAt);
      const k = `${weekdayOf(date)}|${partOfDay(time)}`;
      const was = times.get(k) ?? { weekday: weekdayOf(date), start: time, games: 0 };
      was.games += 1;
      if (time < was.start) was.start = time;
      times.set(k, was);
      for (const id of [g.homeTeamId, g.awayTeamId]) per.set(`${id}|${k}`, (per.get(`${id}|${k}`) ?? 0) + 1);
    }
    const rarest = [...times.values()].sort((a, b) => a.games - b.games || a.weekday - b.weekday || a.start.localeCompare(b.start))[0];
    const counts = mine.map(x => per.get(`${x.id}|${rarest ? `${rarest.weekday}|${partOfDay(rarest.start)}` : ''}`) ?? 0);
    const even = times.size < 2 || Math.max(...counts) - Math.min(...counts) <= 1;
    mine.forEach((x, i) => primeOf.set(x.id, even ? 'even' : { games: counts[i], time: { weekday: rarest.weekday, start: rarest.start } }));
  }
  const teamRows: LeagueTeamHealth[] = teamsWithGames.map(t => ({
    teamId: t.id, name: t.name, divisionId: t.divisionId, have: have.get(t.id)!, plan: plan.get(t.id) ?? 0,
    postponed: postponedOf.get(t.id)!, home: home.get(t.id)!, away: away.get(t.id)!, byes: byeWeeks.get(t.id) ?? 0,
    places: placesOf.get(t.id)!.size, primeTime: primeOf.get(t.id) ?? 'even',
  }));

  return {
    timedGames, divisions: divisionIds.length, score, tone,
    tiles: {
      games: { onPlan, teams: teamsWithGames.length },
      homeAway: { off: offTeams.length, tolerance: rules.homeAwayTolerance },
      byes: { backToBack: byes.length },
      clashes: { pairs: clashes.length, notChecked },
    },
    breakdown, issues: orderIssues(issues), teams: teamRows, rules,
    plans: divisionIds.map(d => ({ divisionId: d, games: plan.get(teams.find(t => t.divisionId === d)?.id ?? '') ?? 0 })),
  };
}

/** The part of a day a clock starts in (the generator's "Saturday mornings"). */
const partOfDay = (clock: string) => {
  const h = Number(clock.split(':')[0]);
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
};

/** The window's order: what a family would notice first. */
const ORDER: Record<LeagueHealthIssue['kind'], number> = { short: 0, postponed: 1, clash: 2, twice_in_a_day: 3, byes_back_to_back: 4, home_away: 5, unchecked: 6 };
const orderIssues = (list: LeagueHealthIssue[]) => list.map((x, i) => ({ x, i })).sort((a, b) => ORDER[a.x.kind] - ORDER[b.x.kind] || a.i - b.i).map(e => e.x);

// ── THE WINDOW'S WORDS (copy file "Stage 9d-2a" d; [build] = chosen by the build, not settled by /marketing) ──────────

/** One team's home and away, said: "both games at home", "all 3 games at home", "3 games at home and 1 away". */
function homeAwayWords(home: number, away: number): string {
  if (away === 0) return home === 2 ? 'both games at home' : `all ${pluralize(home, 'game')} at home`;
  if (home === 0) return away === 2 ? 'both away' : `all ${away} away`;
  return `${pluralize(home, 'game')} at home and ${away} away`;
}

const andJoin = (names: readonly string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

export const LEAGUE_HEALTH_WORDS = {
  nothingToScore: 'Nothing to score yet. Schedule health appears once games have a time.',
  games: 'Games', gamesValue: (a: number, b: number) => `${a} of ${b}`, gamesDetail: 'teams on plan',
  homeAway: 'Home/away', homeAwayValue: (n: number) => `${n} off`, homeAwayDetail: (tolerance: number) => `off by more than ${tolerance}`,
  byes: 'Byes', byesSpread: 'Spread', byesNone: 'none back to back',
  /** [build] byes back to back: the tile's count, and what it counts. */
  byesDetail: 'back to back',
  clashes: 'Clashes', notChecked: (k: number) => `${k} not checked`,
  /** [build] every booking is at one of the club's venues. */
  allChecked: 'all checked',
  show: 'Show them', showIt: 'Show it', giveDate: 'Give it a new date',
  /** [build] the phone's fold under its first two issues (d4). */
  more: (n: number) => `${n} more.`, showAll: 'Show all',
  /** [build] nothing to look at (the tournament's line says it for a tournament). */
  noIssues: 'Nothing to look at. Every team has its games, and nothing clashes.',
  teamDetail: 'Team detail',
  columns: { team: 'Team', games: 'Games', homeAway: 'Home–away', byes: 'Byes', primeTime: 'Prime time', places: 'Places' },
  gamesCell: (have: number, plan: number, postponed: number) => `${have} of ${plan}${postponed ? ` · ${postponed} postponed` : ''}`,
  even: 'even',
  rulesNote: 'The score uses this season’s rules.',
  gamesPerTeam: 'Games per team',
  twice: 'A team can play twice in a day',
  yes: 'Yes', no: 'No',
  homeAwayRule: 'Home and away can differ by',
  homeAwayRuleValue: (n: number) => pluralize(n, 'game'),
  /** [build] where games per team comes from: there is no target to set until 9d-2b. */
  gamesPerTeamHint: 'Games per team is the number most of a division’s teams were given.',
} as const;

/** What an issue's one door does: show its bookings in the schedule, open the postponed game, or open team detail. */
export type LeagueIssueDoor = 'show' | 'showIt' | 'date' | 'teams';

/** An issue, said, with its door and tone. `team` names a team by id, `label` a booking by the page's key ("Tigers vs
 *  Braves", "Tigers practice"), `place` a venue and facility ("Kinsmen Park · Diamond 2"). */
export function leagueIssueWords(issue: LeagueHealthIssue, ctx: {
  team: (id: string) => string;
  label: (key: string) => string;
  place: (venueId: string, facilityId: string | null) => string;
}): { text: string; door: LeagueIssueDoor; tone: 'error' | 'warning' | 'info' } {
  const day = (d: string) => formatStoredDate(d, { withYear: false });
  switch (issue.kind) {
    case 'short': {
      const names = issue.teamIds.map(ctx.team);
      const head = `${andJoin(names)} ${names.length === 1 ? 'has' : 'have'} ${issue.have} of ${pluralize(issue.plan, 'game')}.`;
      if (!issue.cancelled) return { text: head, door: 'teams', tone: 'warning' };
      const whose = names.length === 1 ? 'Its' : 'Their';
      return { text: `${head} ${whose} ${issue.cancelled.day ? `${day(issue.cancelled.day)} ` : ''}game was cancelled and not replayed.`, door: 'show', tone: 'warning' };
    }
    case 'postponed': {
      const match = `${ctx.team(issue.homeTeamId)} vs ${ctx.team(issue.awayTeamId)}`;
      // [build] a game saved with no date at all is not postponed (the public page's "Date to come"): it needs a date.
      return { text: issue.day ? `${match} was postponed from ${day(issue.day)} and still needs a new date.` : `${match} still needs a date.`, door: 'date', tone: 'warning' };
    }
    case 'clash': {
      const clock = formatTime(utcToZonedInputs(new Date(issue.startMs).toISOString()).time);
      return {
        text: `${ctx.place(issue.venueId, issue.facilityId)} is booked twice on ${shortDayWords(issue.day)} at ${clock}: ${ctx.label(issue.keys[0])} and ${ctx.label(issue.keys[1])}.`,
        door: 'show', tone: 'error',
      };
    }
    case 'twice_in_a_day': return { text: GENERATE_WORDS.warnTwice(ctx.team(issue.teamId), shortDayWords(issue.day)), door: 'showIt', tone: 'warning' };
    case 'byes_back_to_back':
      return { text: GENERATE_WORDS.warnByes(ctx.team(issue.teamId), day(issue.weeks[0]), day(issue.weeks[1])), door: 'showIt', tone: 'warning' };
    case 'home_away':
      return { text: `${issue.teams.map(t => `${ctx.team(t.teamId)} has ${homeAwayWords(t.home, t.away)}`).join('; ')}.`, door: 'teams', tone: 'warning' };
    case 'unchecked': {
      const n = issue.games + issue.practices;
      const what = [issue.games ? pluralize(issue.games, 'game') : '', issue.practices ? pluralize(issue.practices, 'practice') : ''].filter(Boolean).join(' and ');
      return { text: `${what} ${n === 1 ? 'is' : 'are'} at a typed place, so ${n === 1 ? 'it' : 'they'} can’t be checked for clashes.`, door: 'show', tone: 'info' };
    }
  }
}

/** The Prime time cell: "even", or the team's share of its division's rarest time ("1 Saturday morning"). */
export const primeTimeCell = (p: LeagueTeamHealth['primeTime']) =>
  p === 'even' ? LEAGUE_HEALTH_WORDS.even : `${p.games} ${primeTimeWords(p.time, p.games)}`;
