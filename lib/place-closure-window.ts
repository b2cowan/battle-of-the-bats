import { joinWithAnd, pluralize, possessive, formatTime } from './utils';
import { addCalendarDays, formatShortWeekdayDate, utcToZonedInputs, zonedWallClockToUtc } from './timezone';
import { CLUB_EMAIL_CAP } from './families-words';
import { teamsHearing } from './league-game-changes';
import { LEAGUE_RUNNER_ROLES } from './house-league-access';
import { RAIN_LINE_MAX, shortDivision } from './league-rainout';
import {
  CLOSURE_MAX_EXTRA_DAYS, byNatural, closedPlaceName, closureSaysAlready, coveringClosures, diamondsAt, diamondsNamed, isAre,
  stripSentence, toStripClosure,
  type ClosedPlace, type ClosureVerb, type PlaceMatch,
} from './place-closures';
import { closureStrip, type ClosureStrip } from './club-notice';
import type { OrgRole } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLOSE A PLACE, THE WINDOW'S PLAN AND WORDS (Club Website Stage 2, Session 2B; rulings K1–K17, plan
 * CLUB_WEBSITE_ENHANCEMENTS_PLAN.md §7; the drawing's tabs 2, 3 and 7; the words its tab 9 lists and plan §10). Pure and
 * client-safe: the window, the routes and the tests read the same plan and the same words.
 *
 * ⚖ WHO (K1): the Rainout's people — owner, admin, house league admin (`canClosePlace`). A house league admin sees the rep
 *   games as a count with no names (`repHidden`) and each tournament by its name with no door (`door`), as drawn (tab 2).
 * ⚖ WHAT IS TICKED when the window opens: a game ON the place (its id), still to start, in a published division. A game
 *   found by its typed text (K7), a game already started (K6) and a draft division's game are listed unticked (the draft's
 *   can't be ticked at all: the press refuses it). Scored and called-off games are never listed (the server's read).
 * ⚖ THE COUNTS are the send's own (the Rainout's rule): one email per family PER DIVISION, so two seasons on one Saturday
 *   are two seasons' sends. The rep coach is one email per team, whatever its games.
 * ⚖ NO HOLD (K5): nothing here offers "Email the families now". The press sends.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** K1: owner, admin and house league admin close and reopen a place (the Rainout's people). */
export function canClosePlace(role: OrgRole | null | undefined): boolean {
  return !!role && LEAGUE_RUNNER_ROLES.includes(role);
}
/** K1: only an owner or an admin may close every place at once, or open a tournament's Rain delay from here. */
export function seesEveryProgram(role: OrgRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Every place at once ("All our fields"): an owner or an admin (K1); and (T1, owner 2026-11-26) a house league admin, but
 * ONLY from a season's schedule in a club with no places — where "All our fields" is the only thing there is to close. The
 * owner took this with its cost: that admin can then close fields for every program. Reopen's people are unchanged.
 */
export function mayCloseEveryPlace(role: OrgRole | null | undefined, at: { noPlaces: boolean; fromSeason: boolean }): boolean {
  return seesEveryProgram(role) || (canClosePlace(role) && at.noPlaces && at.fromSeason);
}

export const CLOSE_LINE_MAX = RAIN_LINE_MAX;

// ── What the window reads (`GET /api/admin/org/place-closures`) ────────────────────────────────────────────────────

export interface CloseVenue {
  id: string; name: string; facilities: { id: string; name: string }[];
  /** Every facility it has is a diamond (and it has some): a whole-park row on the strip reads "all diamonds". */
  allDiamonds: boolean;
}

/** The window's frame: the club's places, its day, and whether this person may close every place. */
export interface CloseFrame {
  today: string;
  venues: CloseVenue[];
  /** Owner or admin (K1, K15: "All our places" stays in the Place picker for them). */
  canAll: boolean;
  /** The club runs rep teams (K14: the rep steps are absent where rep teams are absent). */
  rep: boolean;
}

export interface CloseLeagueGame {
  id: string; seasonId: string; divisionId: string; published: boolean;
  homeTeamId: string; awayTeamId: string; home: string; away: string; scheduledAt: string;
  /** Its diamond's name (a game on the place), or null. */
  field: string | null;
  /** The club place it is on (by id), or null — a row names it when two or more parks are chosen (note 6). */
  venueId: string | null;
  typed: string | null; linkedToPlace: boolean;
  place: number; match: PlaceMatch; started: boolean; seen: string;
}
export interface CloseRepGame {
  id: string; teamId: string;
  /** Empty when the person can't see rep (K1: a count, no names). */
  teamName: string; opponent: string | null; startsAt: string;
  field: string | null; venueId: string | null; typed: string | null; linkedToPlace: boolean;
  place: number; match: PlaceMatch; started: boolean; seen: string;
}

/** T2 (mig 551): a rep game a closure still showing already marks. The press marks it again with its coach already told,
 *  whatever is ticked, so the window lists it apart, never ticked, never counted. */
export interface CloseHeldGame {
  id: string;
  /** Empty when the person can't see rep (K1: a count, no names). */
  teamName: string; opponent: string | null;
  /** The places still closed that mark it ("Diamond 1 at Lions Park"), and how many closures they are. */
  by: string; closures: number;
}
export interface CloseTournament {
  id: string; name: string; games: number; atPlace: number; diamondIds: string[];
  /** The person may open its Rain delay (K1, K13). */
  door: boolean;
}

/** Whom the rep email reaches for a team: its head coach, its other coaches (no head coach on file), or nobody. */
export type RepReach = 'head' | 'others' | 'none';

export interface CloseSource {
  today: string;
  places: ClosedPlace[];
  seasons: { id: string; name: string; divisions: { id: string; name: string; published: boolean }[] }[];
  league: CloseLeagueGame[];
  rep: CloseRepGame[];
  /** T2: the rep games already marked (apart from `rep`, which holds only what this press may tick). */
  repHeld: CloseHeldGame[];
  /** K1: a house league admin sees rep as a count. */
  repHidden: boolean;
  tournaments: CloseTournament[];
  practices: number;
  /** One entry per family per season (a guardian email): the teams its children play on. No email leaves the server. */
  families: string[][];
  /** Per rep team listed: whom its email reaches. */
  repReach: Record<string, RepReach>;
}

/** A closure still showing, as staff read it: the Venue library's row, the Overview's line, Reopen's question. */
export interface StaffClosure {
  id: string; scope: ClosedPlace['scope']; venueId: string | null; placeName: string | null; facilityName: string | null;
  firstDay: string; lastDay: string; verb: ClosureVerb; closedAt: string; closedBy: string | null;
  /** When the site started saying it, and the midnight it stops (the strip's own instants: the window's preview reads them). */
  showsFrom: string; endsAt: string;
  // What it did to games is the server's to count (the rows' fact lines, Reopen's `reopenPreview`): never added up here.
}

/**
 * A showing closure with what it did, by game id — the server's read for the Venue library's rows (S4): a row counts each
 * game once, however many of its closures marked or called it off. The ids never leave the server (`closureRows` keeps
 * the words only).
 */
export interface ClosureFacts {
  closure: StaffClosure;
  /** House league games it called off that still read as it left them (its `verb`). */
  calledOff: string[];
  /** The rep games its standing marks are on. */
  markEvents: string[];
}

/** One diamond of a park's row: its own closures (two presses on one diamond are one diamond) and its facts. */
export interface ClosureRowDiamond { name: string; closureIds: string[]; lines: string[] }

/**
 * A row of the Venue library's "Closed places" box (S4, the summary drawing's tabs 3–4): one per park and dates — every
 * place, a whole park, or that park's diamonds. `under`: the row it sits under, "Also closed on their own" (every other
 * row under "All our fields"; with none, a park's diamonds under that park's whole closure).
 */
export interface ClosureRow {
  key: string;
  scope: 'all' | 'place' | 'diamonds';
  venueId: string | null;
  placeName: string | null;
  firstDay: string;
  lastDay: string;
  closureIds: string[];
  /** A diamonds row's diamonds, in the park's natural order. */
  diamonds: ClosureRowDiamond[];
  /** "Diamond 1 and Diamond 2 at Lions Park" · "All diamonds at Lions Park" · "Riverside Gym" · "All our fields". */
  title: string;
  /** Two plain lines, never a dotted one (owner 2026-11-26): the days and the presses; what it did to games. */
  lines: string[];
  under: string | null;
}

/** What Reopen of a chosen set does to the coaches and the games (`GET …/place-closures/reopen`), counted by the server. */
export interface ReopenPreview {
  /** Rep games whose mark comes off (no closure outside the set still holds them), each once. */
  marksOff: number;
  /** The teams whose coach is emailed; its name when it is one team and the person sees rep (K1). */
  coaches: number;
  team: string | null;
  /** Rep games that stay marked (a closure outside the set holds them), and those places by park. */
  kept: number;
  keptWhile: string[];
  /** Postponed house league games of the set still waiting for a date, each once. */
  stillWaiting: number;
  seasonIds: string[];
}

// ── The plan ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ticked when the window opens: on the place by its id, not started, and (house league) in a published division. */
export function defaultTicks(src: CloseSource): Set<string> {
  const out = new Set<string>();
  for (const g of src.league) if (g.match === 'linked' && !g.started && g.published) out.add(g.id);
  for (const g of src.rep) if (g.match === 'linked' && !g.started) out.add(g.id);
  return out;
}

/**
 * The ticks after a new read (Session 2D: the admin's ticks survive a change of places, diamonds or days). `chosen` holds
 * ONLY what the admin ticked or unticked themselves, with whether the game had started when they did. Every other game
 * gets the opening tick for how it stands NOW (`defaultTicks`): the window's own tick is never carried, so a game that
 * becomes a "maybe" (a whole park narrowed to one diamond) is unticked again (K7), and one that becomes definitely at the
 * place is ticked. A tick set before the game STARTED is dropped once it has (K6: never called off mid-game unless ticked
 * as started).
 */
export function carryTicks(src: CloseSource, chosen: ReadonlyMap<string, { ticked: boolean; started: boolean }>): Set<string> {
  const fresh = defaultTicks(src);
  const out = new Set<string>();
  for (const g of [...src.league, ...src.rep]) {
    const was = chosen.get(g.id);
    if (was ? was.ticked && !(g.started && !was.started) : fresh.has(g.id)) out.add(g.id);
  }
  return out;
}

/** A game in the typed-by-hand group: found by its place's name, not its id (K7). */
export const isTyped = (g: { match: PlaceMatch }) => g.match === 'maybe';
/** "Link both" can link it: it has no place at all, only typed words (a game on the place with no diamond is not typed). */
export const canLink = (g: { linkedToPlace: boolean; typed: string | null }) => !g.linkedToPlace && !!g.typed;

export interface CloseSummary {
  /** House league and rep games ticked. */
  games: number;
  league: number;
  rep: number;
  teams: number;
  /** One send per division. */
  divisions: number;
  families: number;
  emails: number;
  multi: number;
  /** Rep teams with a ticked game, and their reach. */
  repTeams: { teamId: string; name: string; reach: RepReach }[];
}

/** What the press will do with these ticks: the summary and the button's count (the Rainout's arithmetic). */
export function closeSummary(src: CloseSource, ticked: ReadonlySet<string>): CloseSummary {
  const league = src.league.filter(g => ticked.has(g.id) && g.published);
  const rep = src.rep.filter(g => ticked.has(g.id));
  const byDivision = new Map<string, CloseLeagueGame[]>();
  for (const g of league) (byDivision.get(g.divisionId) ?? byDivision.set(g.divisionId, []).get(g.divisionId)!).push(g);
  const reachedBy = new Map<number, number>();
  for (const mine of byDivision.values()) {
    const divTeams = teamsHearing(mine);
    src.families.forEach((f, i) => { if (f.some(t => divTeams.has(t))) reachedBy.set(i, (reachedBy.get(i) ?? 0) + 1); });
  }
  const counts = [...reachedBy.values()];
  const repTeams = [...new Map(rep.map(g => [g.teamId, { teamId: g.teamId, name: g.teamName, reach: src.repReach[g.teamId] ?? 'none' }])).values()];
  return {
    games: league.length + rep.length, league: league.length, rep: rep.length,
    teams: teamsHearing(league).size, divisions: byDivision.size,
    families: counts.length, emails: counts.reduce((n, c) => n + c, 0), multi: counts.filter(c => c > 1).length,
    repTeams,
  };
}

/** The typed games "Link both" links: the ticked ones when any are ticked, else every linkable one listed (K7). */
export function linkTargets(src: CloseSource, ticked: ReadonlySet<string>): { kind: 'league' | 'rep'; id: string; venueId: string }[] {
  const typed = [
    ...src.league.filter(g => isTyped(g) && canLink(g) && g.published).map(g => ({ kind: 'league' as const, g })),
    ...(src.repHidden ? [] : src.rep.filter(g => isTyped(g) && canLink(g)).map(g => ({ kind: 'rep' as const, g }))),
  ];
  const anyTicked = typed.some(t => ticked.has(t.g.id));
  return typed.filter(t => !anyTicked || ticked.has(t.g.id)).flatMap(t => {
    const venueId = src.places[t.g.place]?.venueId;
    return venueId ? [{ kind: t.kind, id: t.g.id, venueId }] : [];
  });
}

/** The last day a calendar offers: 13 days after `from`. Day runs from today to this; Until from the Day to the Day's
 *  (mig 539's limit). */
export const lastCloseDay = (from: string) => addCalendarDays(from, CLOSURE_MAX_EXTRA_DAYS);

/** Midnight after a club day: when a closure for that Until takes itself down (the press writes the same `ends_at`). */
const endOfDay = (day: string) => zonedWallClockToUtc(addCalendarDays(day, 1), '00:00') ?? '';

/** The window's preview (S1–S3, the summary drawing's tab 6). */
export interface ClosePreview {
  /** The strip exactly as it will read after the press: what already shows plus what is chosen. Null: nothing would. */
  strip: ClosureStrip | null;
  /** Every chosen place is already said by a wider closure, so the site won't change: the words that already say it
   *  ("all our fields are closed today."). Null when the press changes the site. */
  alreadySays: string | null;
  /** Every day in the strip ends with the chosen Until, so "until the end of {day}" is true of all of it. */
  sameEnd: boolean;
}

/**
 * The strip the chosen places will put up, read with the closures already showing (S1: a wider one speaks for a narrower
 * one; S2: by day and park; S3 folds in the box). Fixed words over place words and days only (K16): the admin's own words
 * for the families' email are never an input here.
 */
export function closePreview(places: readonly ClosedPlace[], firstDay: string, lastDay: string,
  showing: readonly Pick<StaffClosure, 'scope' | 'venueId' | 'placeName' | 'facilityName' | 'firstDay' | 'lastDay' | 'showsFrom' | 'endsAt'>[],
  nowIso: string, diamondParks: ReadonlySet<string>): ClosePreview {
  const endsAt = endOfDay(lastDay);
  const chosen = places.map(p => toStripClosure({
    scope: p.scope, venueId: p.venueId, placeName: p.name, facilityName: p.facilityName ?? null, firstDay, lastDay, showsFrom: nowIso, endsAt,
  }, diamondParks));
  const today = utcToZonedInputs(nowIso).date;
  const live = showing.filter(c => Date.parse(c.endsAt) > Date.parse(nowIso)).map(c => toStripClosure(c, diamondParks));
  // The widest closure already saying each chosen place (a wider one first, else the same place pressed again for those
  // days); every one said already = the site won't change.
  const by = chosen.map(n => coveringClosures(n, live, today)[0] ?? live.find(w => closureSaysAlready(w, n, today)) ?? null);
  let alreadySays: string | null = null;
  if (chosen.length && by.every(Boolean)) {
    const said = [...new Set(by.filter(w => w !== null))];
    alreadySays = said.length === 1
      ? lowerEvery(stripSentence(said[0], today, formatShortWeekdayDate))
      : 'their parks are closed for those days.';
  }
  const strip = closureStrip([...live, ...chosen], nowIso);
  return { strip, alreadySays, sameEnd: !!strip && strip.groups.every(g => Date.parse(g.endsAt) === Date.parse(endsAt)) };
}

/** The result's last word on the closures: two or more reopen each on its own. */
function doneReopen(closures: number = 1): string {
  return `Reopen ${closures > 1 ? 'them' : 'it'} from the Venue library.`;
}

/** "All our fields are…" read inside a sentence: "all our fields are…". A place's own name keeps its capital. */
export const lowerEvery = (s: string) => (s.startsWith(EVERY_PLACE) ? `all our fields${s.slice(EVERY_PLACE.length)}` : s);

// ── The Places field's rules (Session 2D, M1–M8; the drawing's notes 2, 5, 10, 11) ─────────────────────────────────

/** A chosen park: the whole park (`diamonds` empty, "All diamonds"), or these of its diamonds, in the park's order. */
export interface PlacePick { venueId: string; diamonds: string[] }

/** The press's limit (mig 539): 10 entries, a whole park one, each chosen diamond one (M6, note 10). */
export const CLOSE_MAX_ENTRIES = 10;

/** How many closure entries the picks make. */
export const pickCount = (picks: readonly PlacePick[]) => picks.reduce((n, p) => n + Math.max(1, p.diamonds.length), 0);

/** The press's entries, in the window's order (that order decides which closure claims a game). Every place = one
 *  entry with no place; nothing chosen = none. */
export function pickEntries(picks: readonly PlacePick[], all: boolean): { venueId: string | null; facilityId: string | null }[] {
  if (all) return [{ venueId: null, facilityId: null }];
  return picks.flatMap((p): { venueId: string; facilityId: string | null }[] =>
    (p.diamonds.length ? p.diamonds.map(f => ({ venueId: p.venueId, facilityId: f })) : [{ venueId: p.venueId, facilityId: null }]));
}
/** The window's read parameter: `all`, or `venueId[:facilityId]` comma separated; null when nothing is chosen. */
export function pickParam(picks: readonly PlacePick[], all: boolean): string | null {
  const entries = pickEntries(picks, all);
  if (!entries.length) return null;
  return entries.map(e => (e.venueId ? (e.facilityId ? `${e.venueId}:${e.facilityId}` : e.venueId) : 'all')).join(',');
}

/**
 * A tick in a park's diamond field (note 11). `''` is "All diamonds": ticking it clears the picks; unticking it does
 * nothing (one tick always stays). A diamond ticked from "All diamonds" is that diamond alone; ticking every diamond
 * collapses to "All diamonds" (sent as one whole-park entry, so a game with no diamond reads as at the park); the last
 * ticked diamond can't be unticked (the park's ✕ removes it).
 */
export function toggleDiamond(pick: PlacePick, id: string, on: boolean, order: readonly string[]): PlacePick {
  if (id === '') return on ? { ...pick, diamonds: [] } : pick;
  if (on) {
    if (pick.diamonds.includes(id)) return pick;
    const next = order.filter(f => f === id || pick.diamonds.includes(f));
    return { ...pick, diamonds: next.length >= order.length ? [] : next };
  }
  if (!pick.diamonds.includes(id) || pick.diamonds.length === 1) return pick;
  return { ...pick, diamonds: pick.diamonds.filter(f => f !== id) };
}

/** At the limit, a tick that would ADD an entry is off: an unticked park, or a diamond beyond the first of a park whose
 *  diamonds are picked (ticking the last one, which collapses to the whole park, stays on). */
export function diamondTickOff(pick: PlacePick, id: string, order: readonly string[], count: number): boolean {
  if (count < CLOSE_MAX_ENTRIES || id === '' || !pick.diamonds.length || pick.diamonds.includes(id)) return false;
  return pick.diamonds.length + 1 < order.length;
}

// ── The chosen places, said by park (Session 2D, M8) ───────────────────────────────────────────────────────────────

/** One park as chosen: the whole park, or some of its diamonds (in the window's order); or every place. */
export interface PlaceGroup { scope: 'all' | 'place' | 'diamonds'; venueId: string | null; name: string | null; diamonds: string[] }

/** The closures grouped by their park, in the order first named (the press's entries per diamond say one park). */
export function placeGroups(places: readonly ClosedPlace[]): PlaceGroup[] {
  const out: PlaceGroup[] = [];
  for (const p of places) {
    if (p.scope === 'all') { out.push({ scope: 'all', venueId: null, name: null, diamonds: [] }); continue; }
    // A park met again (several diamonds of it; or, on the Overview, closures from separate presses): a whole park wins,
    // and a diamond is named once.
    const g = p.venueId ? out.find(x => x.scope !== 'all' && x.venueId === p.venueId) : undefined;
    if (g) {
      if (p.scope === 'place') { g.scope = 'place'; g.diamonds = []; }
      else if (g.scope === 'diamonds' && !g.diamonds.includes(p.facilityName ?? '')) g.diamonds.push(p.facilityName ?? '');
      continue;
    }
    out.push({ scope: p.scope === 'diamond' ? 'diamonds' : 'place', venueId: p.venueId, name: p.name, diamonds: p.scope === 'diamond' ? [p.facilityName ?? ''] : [] });
  }
  return out;
}

/** "Lions Park" · "Diamond 2 at Lions Park" · "2 diamonds at Lions Park" · "all our fields". */
export function groupWord(g: PlaceGroup): string {
  if (g.scope === 'all') return 'all our fields';
  if (g.scope === 'place') return g.name ?? '';
  return g.diamonds.length === 1
    ? closedPlaceName({ scope: 'diamond', placeName: g.name, facilityName: g.diamonds[0] }) ?? ''
    : diamondsAt(g.diamonds.length, g.name);
}

/** The park's name when the choice is exactly one park (whole or some of its diamonds), else null. */
function onePark(places: readonly ClosedPlace[]): string | null {
  const groups = placeGroups(places);
  return groups.length === 1 && groups[0].scope !== 'all' ? groups[0].name ?? '' : null;
}

// ── The words ──────────────────────────────────────────────────────────────────────────────────────────────────────

const EVERY_PLACE = 'All our fields';

const gamesWord = (n: number) => pluralize(n, 'game');
const families = (n: number) => pluralize(n, 'family', 'families');
const emailsWord = (n: number) => pluralize(n, 'email');
const teamsCoaches = (teams: number) => `The ${possessive(pluralize(teams, 'team'))} coaches`;
/** "12:30 p.m." in the club's zone. */
export const closeClock = (iso: string) => formatTime(utcToZonedInputs(iso).time);
const q = (s: string) => `“${s}”`;
/** A Reopen button's tail: "… and email 2 coaches" (phone: "…, email 2"); none to email, the verb alone. */
const withEmail = (what: string, coaches: number, phone: boolean) =>
  (coaches === 0 ? what : phone ? `${what}, email ${coaches}` : `${what} and email ${pluralize(coaches, 'coach', 'coaches')}`);

/** By park: "Lions Park" · "2 diamonds at Lions Park" · "Harbourview Park and 2 diamonds at Lions Park" · "those places"
 *  (three parks or more). */
export function placesWord(places: readonly ClosedPlace[]): string {
  const groups = placeGroups(places);
  if (groups.length === 1) return groupWord(groups[0]);
  return groups.length === 2 ? joinWithAnd(groups.map(groupWord)) : 'those places';
}
/** "Link both" sets a park, never a diamond: its words say the park (one park), else "their places". */
const linkTo = (places: readonly ClosedPlace[]) => onePark(places) ?? 'their places';
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const CLOSE_WORDS = {
  title: 'Close a place',
  door: 'Close a place',
  eyebrow: 'Venue library',
  everyPlace: EVERY_PLACE,
  // The Places field (Session 2D, M1–M7; the drawing CLUB_WEBSITE_STAGE2_PLACES_DRAWINGS.html).
  places: 'Places',
  /** The collapsed field: it counts parks. */
  chosen: (parks: number, all: boolean) => (all ? EVERY_PLACE : parks === 0 ? 'Choose places' : parks === 1 ? '1 place chosen' : `${parks} places chosen`),
  /** K15 / M2: the season's parks on the window's day, listed first and chosen. */
  bandSeason: (isToday: boolean) => `This season’s places ${isToday ? 'today' : 'that day'}`,
  bandOther: 'Other places',
  find: 'Find a place',
  /** M6: the press's limit of 10 entries (a whole park is one, each chosen diamond is one). */
  limit: (canAll: boolean) => `Up to ${CLOSE_MAX_ENTRIES} parks or diamonds in one press.${canAll ? ` To close every one, tick ${q(EVERY_PLACE)}.` : ''}`,
  remove: (name: string) => `Remove ${name}`,
  chooseFirst: 'Choose a place to see what’s on it.',
  allDiamonds: 'All diamonds',
  diamonds: 'Diamonds',
  /** The row's diamond field: "All diamonds" · "Diamond 2" · "2 of 3 diamonds". */
  diamondsValue: (chosen: readonly string[], of: number) => (chosen.length === 0 || chosen.length === of ? 'All diamonds'
    : chosen.length === 1 ? chosen[0] : `${chosen.length} of ${of} diamonds`),
  diamondsLabel: (park: string, value: string) => `Diamonds at ${park}: ${value}`,
  day: 'Day',
  until: 'Until the end of',
  what: 'What happens to house league games',
  postpone: 'Postpone them',
  postponeSub: 'They leave their week and wait under “Needs a new date”. You give each a new date later.',
  postponeSubPhone: 'They wait under “Needs a new date”.',
  cancel: 'Cancel them',
  cancelSub: 'They stay on the schedule, struck through. You can put one back on later.',
  cancelSubPhone: 'They stay on the schedule, struck through.',
  /** "What’s at Lions Park that day" · "What’s at those places that day". */
  whatsAt: (places: readonly ClosedPlace[]) => `What’s at ${placesWord(places)} that day`,
  whatsAtDays: (places: readonly ClosedPlace[]) => `What’s at ${placesWord(places)}`,
  colGame: 'Game',
  colTime: 'Time',
  colPlace: 'Place',

  // The groups (drawing tab 2).
  league: 'House league',
  /** "2026 House League · 4 games · 8 teams". */
  leagueCount: (season: string, games: number, teams: number | null) =>
    `${season} · ${gamesWord(games)}${teams != null ? ` · ${pluralize(teams, 'team')}` : ''}`,
  rep: 'Rep',
  repCount: (games: number) => `marked for the coach · ${gamesWord(games)}`,
  /** The folded band's line, by whom the email reaches (/legal 2B: say who is really emailed). */
  repCountPhone: (games: number, reach: RepReach) =>
    `marked, not moved · ${gamesWord(games)} · ${reach === 'none' ? 'no coach to email' : reach === 'others' ? 'its coaches are emailed' : 'its head coach is emailed'}`,
  /** The row's line: the drawn words for a team with a head coach; its other coaches, or nobody, said as they are. */
  repNote: (reach: RepReach) => (reach === 'none'
    ? 'Marked, not moved. It has no coach to email, so let the team know yourself.'
    : reach === 'others'
      ? 'Marked, not moved. Its coaches are emailed (it has no head coach on file) and set the new date.'
      : 'Marked, not moved. Its head coach is emailed and sets the new date.'),
  heldGroup: 'Already marked',
  /** T2: a game a closure still showing already marks (item 10 of the gate): no tick, not counted. */
  heldNote: (g: Pick<CloseHeldGame, 'by' | 'closures'>) =>
    `Already marked: ${g.by} ${isAre(g.by)} closed. It stays marked until ${g.closures > 1 ? 'all of them reopen' : 'both reopen'}, and its coach isn’t emailed again.`,
  heldHidden: (n: number) => (n === 1
    ? '1 rep game is already marked by a place still closed. It stays marked, and its coach isn’t emailed again.'
    : `${n} rep games are already marked by places still closed. They stay marked, and their coaches aren’t emailed again.`),
  doneHeld: (n: number) => (n === 1
    ? '1 rep game was already marked. Its coach wasn’t emailed again.'
    : `${n} rep games were already marked. Their coaches weren’t emailed again.`),
  /** K1: a house league admin's rep row. */
  repHiddenCount: (games: number) => `${gamesWord(games)} · marked for its coach`,
  repHiddenLine: (games: number, places: readonly ClosedPlace[]) =>
    `${games === 1 ? '1 rep game' : `${games} rep games`} at ${placesWord(places)} that day`,
  repHiddenSub: 'It is marked for its coach when you close.',
  repHiddenSubMany: 'They are marked for their coaches when you close.',
  /** The unticked "maybe" group: a place typed by hand, a game at the park with no diamond recorded, or both. */
  typed: (kind: TypedKind) => (kind === 'noDiamond' ? 'No diamond recorded' : kind === 'mixed' ? 'Typed place or no diamond' : 'Place typed by hand'),
  /** "may be Lions Park · 2 games". */
  typedCount: (places: readonly ClosedPlace[], games: number) => `may be ${placesWord(places)} · ${gamesWord(games)}`,
  typedLine: (text: string) => `Typed: ${q(text)}`,
  /** K7: "Link both to Lions Park" · "Link all 5 ticked to Lions Park" · "Link all 3 to Lions Park" — always the park (a
   *  link sets the park, never a diamond). */
  linkLabel: (n: number, anyTicked: boolean, places: readonly ClosedPlace[]) => {
    const to = linkTo(places);
    return anyTicked ? `Link all ${n} ticked to ${to}` : n === 2 ? `Link both to ${to}` : n === 1 ? `Link it to ${to}` : `Link all ${n} to ${to}`;
  },
  linkHelp: 'So they match next time. Families aren’t told: the game is where it was.',
  /** Build words: the link is chosen and happens at the press. */
  linkOn: (n: number, places: readonly ClosedPlace[]) =>
    `${n === 1 ? 'It is' : `${n} are`} linked to ${linkTo(places)} when you close. Families aren’t told.`,
  linkUndo: 'Don’t link',
  /** Under a game's time, which says when. */
  started: 'Started',
  draft: (division: string) => `${division} is a draft, so none of its games are listed.`,
  notChanged: 'Not changed here',
  tournament: 'Tournament',
  tournamentSub: 'moved in its own Rain delay',
  tournamentSubNoDoor: 'its director moves them',
  /** "4 games on Lions Park’s diamonds today". */
  tournamentAt: (n: number, places: readonly ClosedPlace[], isToday: boolean) => {
    const park = onePark(places);
    return `${gamesWord(n)} on ${park != null ? possessive(park) : 'those places’'} diamonds ${isToday ? 'today' : 'that day'}`;
  },
  tournamentAtAll: (n: number, isToday: boolean) => `${gamesWord(n)} ${isToday ? 'today' : 'that day'}`,
  tournamentUnlinked: (isToday: boolean) =>
    `Plays ${isToday ? 'today' : 'that day'}. Its diamonds aren’t linked to your places, so its games aren’t counted here.`,
  tournamentDoor: 'After you close',
  practices: (n: number, places: readonly ClosedPlace[], isToday: boolean) =>
    `${n === 1 ? '1 practice' : `${n} practices`} at ${placesWord(places)} ${isToday ? 'today' : 'that day'} ${n === 1 ? 'isn’t' : 'aren’t'} changed here.`,
  closing: (games: number, teams: number) => `${gamesWord(games)}, ${pluralize(teams, 'team')}.`,
  /** The phone's folded header: "Not changed here · 1 tournament (its own Rain delay) · 2 practices". */
  notChangedCount: (tournaments: number, practices: number, door: boolean) => [
    tournaments ? `${pluralize(tournaments, 'tournament')}${door ? ' (its own Rain delay)' : ''}` : null,
    practices ? pluralize(practices, 'practice') : null,
  ].filter(Boolean).join(' · '),

  // The summary (a Statement) and the site's preview.
  /** Phone: "5 games. 58 families emailed in 2 sends, and 1 rep coach." */
  sumPhone: (s: CloseSummary) => {
    const coaches = s.repTeams.filter(t => t.reach !== 'none').length;
    const mail = s.emails > 0 ? `${s.emails} ${s.emails === 1 ? 'family' : 'families'} emailed${s.divisions > 1 ? ` in ${s.divisions} sends` : ''}` : null;
    const rep = coaches > 0 ? `${coaches} rep ${coaches === 1 ? 'coach' : 'coaches'}` : null;
    if (mail && rep) return `${gamesWord(s.games)}. ${mail}, and ${rep}.`;
    if (mail) return `${gamesWord(s.games)}. ${mail}.`;
    if (rep) return `${gamesWord(s.games)}. ${cap(rep)} emailed.`;
    return `${gamesWord(s.games)}. No families to email.`;
  },
  /** Computer: the Rainout's long sentence, then the rep line. */
  sumComputer: (s: CloseSummary) => {
    const league = s.league === 0 ? ''
      : s.emails === 0 ? `No families to email. ${teamsCoaches(s.teams)} get a copy.`
      : s.divisions > 1
        ? `${emailsWord(s.emails)} to ${families(s.families)}, sent as ${s.divisions}, one per division.`
          + (s.multi > 0 ? ` ${s.multi} of those families ${s.multi === 1 ? 'has' : 'have'} children in two divisions and ${s.multi === 1 ? 'gets' : 'get'} two emails.` : '')
          + ` ${teamsCoaches(s.teams)} get a copy.`
        : `${emailsWord(s.emails)} to ${families(s.families)}. ${teamsCoaches(s.teams)} get a copy.`;
    return [league, ...repLines(s)].filter(Boolean).join(' ');
  },
  sumCap: `Doesn’t count toward today’s ${CLUB_EMAIL_CAP}.`,
  /** Over the preview strip (S1–S3): "Your site shows this at once, until the end of Thu, Nov 26:" — the day only when
   *  every row ends then; with other days in the strip, each row already says its own. */
  siteShows: (sameEnd: boolean, lastDay: string) =>
    `Your site shows this at once${sameEnd ? `, until the end of ${formatShortWeekdayDate(lastDay)}` : ''}:`,
  /** The choice is already said by a wider closure (S1): "Your site won’t change. It already says all our fields are
   *  closed today." The press stays: a diamond can stay shut after the rest reopen. */
  unchanged: 'Your site won’t change.',
  alreadySays: (said: string) => ` It already says ${said}`,
  lineOpen: 'Add a line for the families’ email',
  lineOpenHelp: 'It goes at the top of their email and the coaches’ copy. It isn’t shown on your site.',
  lineLabel: 'A line for the families’ email',
  lineHint: 'You can leave this empty. It goes at the top of the families’ email and the coaches’ copy. It isn’t shown on your site. 120 characters at most.',
  linePlaceholder: 'For example: the fields are flooded.',
  lineCount: (left: number) => `${Math.max(0, left)} left`,
  foot: 'Nothing changes until you press the button.',
  footPhone: 'Nothing changes until you press.',
  notNow: 'Not now',
  /** "Close Lions Park, email 58" · "Close Lions Park and email 58 families" · "Close Pinecrest Park" · "Close 2 diamonds"
   *  (one park, several diamonds) · "Close both" · "Close 3 places" — it counts parks (note 14). */
  go: (places: readonly ClosedPlace[], emails: number, phone: boolean) => {
    const groups = placeGroups(places);
    const one = groups[0];
    const what = groups.length !== 1 ? (groups.length === 2 ? 'both' : `${groups.length} places`)
      : one.scope === 'all' ? 'all our fields' : one.scope === 'place' ? one.name ?? ''
      : one.diamonds.length === 1 ? one.diamonds[0] : `${one.diamonds.length} diamonds`;
    const verb = `Close ${what}`;
    if (emails <= 0) return verb;
    return phone ? `${verb}, email ${emails}` : `${verb} and email ${families(emails)}`;
  },
  sending: 'Closing…',
  /** Nothing on the day. "Closing it still tells families on your site." only while it does (S1: not when a wider closure
   *  already says it). */
  empty: (places: readonly ClosedPlace[], day: string, sitesChanges = true) =>
    `Nothing is scheduled at ${placesWord(places)} on ${formatShortWeekdayDate(day)}.${sitesChanges ? ' Closing it still tells families on your site.' : ''}`,
  noPlacesTitle: 'Your club has no places yet.',
  noPlacesBody: 'Add your parks and diamonds in the Venue library, then close one here. Your schedules can keep their typed places; a closure finds them by the place’s name.',
  noPlacesDoor: 'Open the Venue library',
  /** T1 (owner 2026-11-26): the no-places window that offers "All our fields" says why there is nothing else to pick. */
  noPlacesAll: 'Your club has no places yet. To close one park or diamond, add it in the Venue library.',
  loadFailed: 'The day’s games didn’t load. Close the window and try again.',

  // Refusals (build words).
  errChanged: 'Some games changed while the window was open. Nothing was changed. Look again.',
  errPast: 'That day has passed. Nothing was changed. Pick today or a later day.',
  errDraft: 'A game in a draft division can’t be called off. Nothing was changed. Look again.',
  errFinished: 'A season finished while the window was open, so nothing was changed. Look again.',
  errNotFound: 'A game or place isn’t there any more. Nothing was changed. Look again.',
  errInvalid: 'The request was not understood',
  errNetwork: 'We couldn’t tell if the closure went through. Check your connection, then press again: it closes once, however many times you press.',

  // The result (drawing tab 3).
  doneTitle: (places: readonly ClosedPlace[]) => `${cap(placesWord(places))} closed`,
  /** "4 house league games postponed. 58 emails sent (U11 31, U15 27). The 8 teams’ coaches have a copy." */
  doneLeague: (games: number, verb: ClosureVerb, emails: number, parts: readonly { name: string; emails: number }[], teams: number) =>
    `${games === 1 ? '1 house league game' : `${games} house league games`} ${verb}. `
    + (emails === 0 ? 'No families to email.' : `${emailsWord(emails)} sent${parts.length > 1 ? ` (${parts.map(p => `${shortDivision(p.name)} ${p.emails}`).join(', ')})` : ''}.`)
    + ` ${teamsCoaches(teams)} have a copy.`,
  /** Every division was already emailed (a press pressed again, or someone sent them first): the Rainout's words. */
  doneAlready: (games: number, verb: ClosureVerb) =>
    `${games === 1 ? '1 house league game' : `${games} house league games`} ${verb}. Those families were already emailed. Nothing more was sent.`,
  /** A season's send could not start: its changes wait, as a failed division's do. */
  doneUnsent: 'Some house league emails didn’t go: their changes are waiting in Changes to send.',
  /** One send or more failed: the Rainout's words. */
  doneFailed: (failed: readonly string[], verb: ClosureVerb, changes: number) =>
    (failed.length === 0 ? 'Some emails didn’t go: their ' : `The ${joinWithAnd(failed.map(shortDivision))} ${failed.length === 1 ? 'email' : 'emails'} didn’t go: ${failed.length === 1 ? 'its' : 'their'} `)
    + `${pluralize(changes, verb === 'postponed' ? 'postponement' : 'cancellation')} ${changes === 1 ? 'is' : 'are'} waiting in Changes to send.`,
  failOpen: 'Open Changes to send',
  /** "1 rep game marked. The U13 Ospreys’ head coach was emailed." */
  doneRep: (games: number, teams: readonly { name: string; reach: RepReach; sent: boolean }[]) =>
    [`${games === 1 ? '1 rep game' : `${games} rep games`} marked.`, ...teams.map(repDoneLine)].join(' '),
  doneTyped: (n: number, kind: TypedKind = 'typed') => {
    const what = kind === 'noDiamond' ? 'no diamond recorded' : kind === 'mixed' ? 'a typed place or no diamond' : 'a typed place';
    return n === 1 ? `1 game with ${what} wasn’t changed.` : `${n} games with ${what} weren’t changed.`;
  },
  doneTypedRest: (places: readonly ClosedPlace[]) => ` They may be at ${placesWord(places)}, and they still show as scheduled.`,
  seeTyped: (n: number) => (n === 1 ? 'See the game' : `See the ${n} games`),
  /** "Kestrel Bay Winter Classic: its 4 games at Lions Park aren’t moved yet." */
  doneTournament: (name: string, n: number, places: readonly ClosedPlace[]) =>
    `${name}: ${n === 1 ? 'its 1 game' : `its ${n} games`} at ${placesWord(places)} ${n === 1 ? 'isn’t' : 'aren’t'} moved yet.`,
  doneTournamentRest: ' Its families hear through its Rain delay.',
  doneTournamentNoDoor: ' Its families hear through its Rain delay, which its tournament staff open.',
  doneUnlinked: (name: string, isToday: boolean) => `${name} plays ${isToday ? 'today' : 'that day'}.`,
  doneUnlinkedRest: (places: readonly ClosedPlace[]) =>
    ` Its diamonds aren’t linked to your places. If it plays at ${placesWord(places)}, open its Rain delay.`,
  openRainDelay: 'Open its Rain delay',
  /** The Rain delay's amber line, opened from a closure (K13): "Kestrel Bay Softball Association closed Lions Park today.
   *  Its diamonds are picked below." */
  rainDelayLine: (club: string, place: string, day: string, today: string, several = false) =>
    `${club} closed ${place} ${day === today ? 'today' : `on ${formatShortWeekdayDate(day)}`}. ${several ? 'Their' : 'Its'} diamonds are picked below.`,
  /** What the Rain delay's line calls the closed places, and whether it says "Their": one park or two by name, three or
   *  more by count (the line has no list under it for "those places" to point at). */
  rainDelayPlaces: (places: readonly ClosedPlace[]) => {
    const groups = placeGroups(places);
    return {
      words: groups.length > 2 ? `${groups.length} places` : placesWord(places),
      several: groups.length > 1 || groups[0]?.scope === 'all',
    };
  },
  /** The result over the strip it put up (S1–S3): "Your site shows this until the end of Sat, Nov 28:" · "Your site shows
   *  this now:" (other days in it). */
  doneShows: (sameEnd: boolean, lastDay: string) =>
    (sameEnd ? `Your site shows this until the end of ${formatShortWeekdayDate(lastDay)}:` : 'Your site shows this now:'),
  doneReopen,
  /** S1: a wider closure already said it. "Your site didn’t change: it already says all our fields are closed today.
   *  Reopen it from the Venue library." */
  doneUnchanged: (said: string, closures: number = 1) => `Your site didn’t change: it already says ${said} ${doneReopen(closures)}`,
  doneNoUndo: (verb: ClosureVerb) => (verb === 'postponed'
    ? 'Emails can’t be taken back. To change a game, give it a new date; its families are told again.'
    : 'Emails can’t be taken back. To bring a game back, put it back on the schedule; its families are told again.'),
  done: 'Done',
  newDates: 'Give them new dates',
  replay: 'This closure was already made. Nothing more was sent.',

  // Reopen (drawing tab 3; the summary drawing's tab 5, S5 and S6).
  reopen: 'Reopen',
  reopenTitle: (place: string) => `Reopen ${place}?`,
  /** S5: a park's diamonds, ticked. */
  reopenParkTitle: (park: string) => `Reopen diamonds at ${park}?`,
  reopenLoading: 'Checking what this changes…',
  reopenReadFailed: 'What this changes didn’t load. Close the window and try again.',
  reopenPressFailed: 'We couldn’t tell if it reopened. Check your connection, then press again: nothing reopens twice.',
  /** "Your site stops saying it’s closed, at once." · "… they’re closed …" · "… Diamond 1 is closed …" · (something of
   *  the place still shows) "… Diamond 2 at Lions Park is closed through Sun, Nov 29, at once." */
  reopenSite: (what: string = 'it’s closed') => `Your site stops saying ${what}, at once.`,
  /** S5: what the site still says of the place (one sentence, bold). */
  reopenStillSays: ' It still says ',
  reopenStillShows: 'Your site still shows this:',
  /** S6: the site after the press, as the tick decides. */
  reopenThenSays: 'Your site will then say ',
  reopenThenShows: 'Your site will then show this:',
  reopenNothingLeft: 'Your site will stop saying anything is closed, at once.',
  reopenNone: 'Tick a diamond to reopen it.',
  /** What the press does to the marks, one email per coach ("the diamond" · "the diamonds" · "the place"; every place,
   *  as S6 is drawn, says no place). */
  reopenMarksSet: (marks: number, oneTeam: string | null, what: string | null) => {
    const line = what ? `: ${what} reopened, the game wasn’t moved, keep it or move it.` : '.';
    return marks === 1
      ? `${oneTeam ? `The ${possessive(oneTeam)} game` : '1 rep game'} loses its mark. Its coach gets one email${line}`
      : `${marks} rep games lose their marks. Each coach gets one email${line}`;
  },
  /** A closure a wider one covers (the summary drawing's "Remove Diamond 1’s own closure?"). */
  removeTitle: (name: string) => `Remove ${possessive(name)} own closure?`,
  removeParkTitle: (park: string) => `Remove the diamonds’ own closures at ${park}?`,
  /** "It stays closed. All our fields are closed today, so your site doesn’t change." */
  removeStays: (several: boolean) => (several ? 'They stay closed.' : 'It stays closed.'),
  removeBy: (bySentence: string) => ` ${bySentence.replace(/\.$/, '')}, so your site doesn’t change.`,
  /** "Diamond 1 will then open when you reopen all our fields." */
  removeThen: (name: string | null, byName: string) => `${name ?? 'They'} will then open when you reopen ${byName}.`,
  removeGo: (several: boolean) => (several ? 'Remove their closures' : 'Remove its closure'),
  /** S6: "Diamond 1 and Diamond 2 at Lions Park are also closed on their own." */
  alsoClosed: (names: string, one: boolean) => `${names} ${one ? 'is' : 'are'} also closed on ${one ? 'its' : 'their'} own.`,
  /** "Reopen it as well" · "Reopen those two diamonds as well" · "Reopen those 3 places as well". */
  alsoTick: (count: number, diamonds: boolean) => (count === 1 ? 'Reopen it as well'
    : `Reopen those ${count === 2 ? 'two' : count} ${diamonds ? 'diamonds' : 'places'} as well`),
  /** S5 button: "Reopen 2 diamonds and email 2 coaches" (phone: "Reopen 2 diamonds, email 2"). */
  reopenParkGo: (ticked: readonly string[], coaches: number, phone: boolean) =>
    (ticked.length ? withEmail(`Reopen ${ticked.length === 1 ? ticked[0] : `${ticked.length} diamonds`}`, coaches, phone) : 'Reopen'),
  /** S6 button: "Reopen all our fields" · "Reopen everything and email 2 coaches"; a park: "Reopen Lions Park" · "Reopen
   *  all of Lions Park". */
  reopenWideGo: (wide: string | null, also: boolean, coaches: number, phone: boolean) =>
    withEmail(wide == null ? (also ? 'Reopen everything' : 'Reopen all our fields') : also ? `Reopen all of ${wide}` : `Reopen ${wide}`, coaches, phone),
  /** D1: "1 rep game stays marked while Diamond 1 at Lions Park is still closed. Its coach is told when that reopens." */
  reopenKept: (n: number, places: readonly string[]) => {
    const said = places.map(p => (p === EVERY_PLACE ? 'all our fields' : p));
    const many = said.length > 1;
    const still = `${joinWithAnd(said)} ${many ? 'are' : isAre(said[0] ?? '')} still closed`;
    const when = many ? 'those reopen' : 'that reopens';
    return n === 1
      ? `1 rep game stays marked while ${still}. Its coach is told when ${when}.`
      : `${n} rep games stay marked while ${still}. Their coaches are told when ${when}.`;
  },
  reopenStill: (n: number) => (n === 1 ? 'The 1 postponed game stays under “Needs a new date”.' : `The ${n} postponed games stay under “Needs a new date”.`),
  reopenStillRest: (n: number) => (n === 1
    ? ' Its families were emailed, so give it a new date from the schedule and they’re told again.'
    : ' Their families were emailed, so give each a new date from the schedule and they’re told again.'),
  reopenKeep: 'Keep it closed',
  reopenGo: (coaches: number, phone = false) => withEmail('Reopen', coaches, phone),
  /** The button while the press is out. */
  reopening: 'Reopening…',
  removing: 'Removing…',
  /** S5: what a screen reader calls the diamonds' ticks. */
  reopenTicksLabel: 'Diamonds to reopen',
  reopened: (place: string) => `${place} reopened`,
  reopenedStill: (n: number) => (n === 1 ? '1 game still needs a new date.' : `${n} games still need new dates.`),
  reopenedStillRest: (n: number) => (n === 1 ? ' Its families are told when you give it one.' : ' Their families are told when you give each one.'),

  // The results (Session B; not drawn, ruled at the gate 2026-11-26).
  reopenedPark: (names: string) => `${names} reopened`,
  removed: (name: string) => `${possessive(name)} own closure removed`,
  removedPark: 'The diamonds’ own closures removed',
  /** One of two closures of all our fields (the longer one still says it): "All our fields’ own closure" reads wrong. */
  removeAllTitle: 'Remove this closure of all our fields?',
  removedAll: 'Closure of all our fields removed',
  /** Some of the set reopened and some didn't: the title claims neither (the warning under it names what didn't). */
  partlyReopened: 'Partly reopened',
  partlyRemoved: 'Partly removed',
  /** "It stays closed: all our fields are closed today, so your site didn’t change." */
  removedSite: (several: boolean, by: string) => `${several ? 'They stay' : 'It stays'} closed: ${by.replace(/\.$/, '')}, so your site didn’t change.`,
  /** "Your site no longer says it’s closed." · "… they’re closed." · "… anything is closed." */
  reopenedGone: (what: 'it' | 'they' | 'anything') => `Your site no longer says ${what === 'it' ? 'it’s' : what === 'they' ? 'they’re' : 'anything is'} closed.`,
  reopenedNowSays: 'Your site now says ',
  reopenedNowShows: 'Your site now shows this:',
  reopenedCoaches: (coaches: number, team: string | null) =>
    (coaches === 0 ? ''
      : coaches === 1 ? (team ? ` The ${possessive(team)} coach was emailed.` : ' 1 coach was emailed.')
      : ` ${coaches} coaches were emailed.`),
  /** A closure that did not reopen (one of the set's stamps failed): "Diamond 2 at Lions Park didn’t reopen. Press Reopen
   *  on it again." */
  reopenFailed: (names: readonly string[]) =>
    `${joinWithAnd(names)} didn’t reopen. Press Reopen on ${names.length === 1 && !/^\d+ diamonds at /.test(names[0]) ? 'it' : 'them'} again.`,

  // The Venue library's "Closed places" box (S4; the summary drawing's tabs 3–4).
  closedBox: 'Closed places',
  closedToday: 'Closed today',
  /** The venue table's tag: "Closed today" for the whole park or every place, else "1 diamond closed today". */
  diamondsClosedToday: (n: number) => `${n} ${n === 1 ? 'diamond' : 'diamonds'} closed today`,
  /** "Also closed on their own. These stay closed if you reopen all our fields." */
  alsoBand: (parent: string, one: boolean) => (one
    ? `Also closed on its own. It stays closed if you reopen ${parent}.`
    : `Also closed on their own. These stay closed if you reopen ${parent}.`),
  reopenAria: (name: string) => `Reopen ${name}`,
  /** The Overview's line (build words; the drawing names it, it does not word it). Counted by park (Session 2D: two
   *  diamonds at one park are one place closed), each named as `groupWord`: "2 diamonds at Lions Park". */
  overviewLabel: 'Places closed',
  overviewSub: (names: readonly string[]) => `${joinWithAnd(names)} · reopen from the Venue library`,
};

/** The typed group's kind: typed by hand (no place id), on the place with no diamond recorded, or both. */
export type TypedKind = 'typed' | 'noDiamond' | 'mixed';
export function typedKind(games: readonly { linkedToPlace: boolean }[]): TypedKind {
  const noDiamond = games.filter(g => g.linkedToPlace).length;
  return noDiamond === 0 ? 'typed' : noDiamond === games.length ? 'noDiamond' : 'mixed';
}

/** The Overview's "Places closed": the closures showing, one per park (a whole park or any of its diamonds), named. */
export function closedParks(closures: readonly Pick<StaffClosure, 'scope' | 'venueId' | 'placeName' | 'facilityName'>[]): string[] {
  const groups = placeGroups(closures.map(c => ({ scope: c.scope, venueId: c.venueId, facilityId: null, name: c.placeName, facilityName: c.facilityName })));
  return [...new Set(groups.map(g => (g.scope === 'all' ? EVERY_PLACE : groupWord(g))))];
}

// ── The Venue library's rows (S4) ──────────────────────────────────────────────────────────────────────────────────

const daysWords = (first: string, last: string) =>
  (first === last ? formatShortWeekdayDate(first) : `${formatShortWeekdayDate(first)} to ${formatShortWeekdayDate(last)}`);

/** Who pressed when (item 8 of the gate): "closed at 3:25 p.m. by Dana Reyes" · "closed at 3:25 p.m. and 3:40 p.m. by
 *  Dana Reyes" · "closed at 3:25 p.m. by Dana Reyes and 3:40 p.m. by Sam Lee" · three presses or more: "closed by Dana
 *  Reyes" · "closed by Dana Reyes and Sam Lee" · "closed by 3 people" · "closed 3 times". */
export function pressedWords(presses: readonly { closedAt: string; closedBy: string | null }[]): string {
  // Two presses that would read the same (one person, one minute) are said once, as the site's own small line does.
  const ps = [...new Map(presses.map(p => [[closeClock(p.closedAt), p.closedBy ?? ''].join('|'), p])).values()]
    .sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt));
  const by = (p: { closedBy: string | null }) => (p.closedBy ? ` by ${p.closedBy}` : '');
  const people = [...new Set(ps.flatMap(p => (p.closedBy ? [p.closedBy] : [])))];
  if (ps.length === 1) return `closed at ${closeClock(ps[0].closedAt)}${by(ps[0])}`;
  if (ps.length === 2) {
    const [a, b] = ps;
    return (a.closedBy ?? null) === (b.closedBy ?? null)
      ? `closed at ${closeClock(a.closedAt)} and ${closeClock(b.closedAt)}${by(a)}`
      : `closed at ${closeClock(a.closedAt)}${by(a)} and ${closeClock(b.closedAt)}${by(b)}`;
  }
  if (!people.length) return `closed ${ps.length} times`;
  return people.length <= 2 ? `closed by ${joinWithAnd(people)}` : `closed by ${people.length} people`;
}

/** A row's two plain lines: "For Thu, Nov 26, closed at 3:25 p.m. by Dana Reyes" and "2 postponed, 1 rep game marked",
 *  each game counted once however many of the row's closures called it off or marked it. */
function factLines(items: readonly ClosureFacts[]): string[] {
  const c = items[0].closure;
  const games = new Map(items.flatMap(x => x.calledOff.map(id => [id, x.closure.verb] as const)));
  const postponed = [...games.values()].filter(v => v === 'postponed').length;
  const cancelled = games.size - postponed;
  const marks = new Set(items.flatMap(x => x.markEvents)).size;
  const did = [postponed ? `${postponed} postponed` : null, cancelled ? `${cancelled} cancelled` : null,
    marks ? `${marks === 1 ? '1 rep game' : `${marks} rep games`} marked` : null].filter(Boolean).join(', ');
  return [`For ${daysWords(c.firstDay, c.lastDay)}, ${pressedWords(items.map(x => x.closure))}`, ...(did ? [did] : [])];
}

/**
 * S4: the "Closed places" box. One row per park and dates (every place; a whole park; that park's diamonds); two presses
 * on one place are one row. "All our fields" leads and every other row sits under it ("Also closed on their own"); with
 * none, a park's diamonds sit under that park's whole closure. The rest by first day, then park, the whole park first.
 * `diamondParks`: the places whose facilities are all diamonds ("All diamonds at Lions Park"; else the name alone).
 */
export function closureRows(items: readonly ClosureFacts[], diamondParks: ReadonlySet<string>): ClosureRow[] {
  const groups = new Map<string, ClosureFacts[]>();
  for (const x of items) {
    const c = x.closure;
    const park = c.scope === 'all' ? 'all' : c.venueId ?? `name:${c.placeName ?? ''}`;
    const key = `${c.scope === 'diamond' ? 'd' : 'w'}|${park}|${c.firstDay}|${c.lastDay}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(x);
  }
  const rows: ClosureRow[] = [...groups].map(([key, list]) => {
    const c = list[0].closure;
    const scope = c.scope === 'all' ? 'all' : c.scope === 'place' ? 'place' : 'diamonds';
    const byDiamond = new Map<string, ClosureFacts[]>();
    if (scope === 'diamonds') for (const x of list) { const n = x.closure.facilityName ?? ''; (byDiamond.get(n) ?? byDiamond.set(n, []).get(n)!).push(x); }
    const diamonds = [...byDiamond].sort(([a], [b]) => byNatural(a, b))
      .map(([name, mine]) => ({ name, closureIds: mine.map(x => x.closure.id), lines: factLines(mine) }));
    const park = c.placeName ?? '';
    const title = scope === 'all' ? EVERY_PLACE
      : scope === 'place' ? (c.venueId && diamondParks.has(c.venueId) ? `All diamonds at ${park}` : park)
      : diamondsNamed(diamonds.map(d => d.name), park);
    return {
      key, scope, venueId: scope === 'all' ? null : c.venueId, placeName: scope === 'all' ? null : c.placeName,
      firstDay: c.firstDay, lastDay: c.lastDay, closureIds: list.map(x => x.closure.id), diamonds, title, lines: factLines(list), under: null,
    };
  });
  const byDays = (a: ClosureRow, b: ClosureRow) => a.firstDay.localeCompare(b.firstDay) || a.lastDay.localeCompare(b.lastDay);
  // A row sits under a wider one only on days they share ("These stay closed if you reopen …" is about those days).
  const overlap = (a: ClosureRow, b: ClosureRow) => a.firstDay <= b.lastDay && b.firstDay <= a.lastDay;
  const every = rows.filter(r => r.scope === 'all').sort(byDays);
  const rest = rows.filter(r => r.scope !== 'all').sort((a, b) => a.firstDay.localeCompare(b.firstDay)
    || byNatural(a.placeName ?? '', b.placeName ?? '') || (a.scope === 'place' ? 0 : 1) - (b.scope === 'place' ? 0 : 1)
    || a.lastDay.localeCompare(b.lastDay));
  const parentOf = (r: ClosureRow): ClosureRow | null => {
    if (r.scope === 'all') return null;
    if (every.length) return every.find(w => overlap(w, r)) ?? null;
    return r.scope === 'diamonds' && r.venueId ? rest.find(w => w.scope === 'place' && w.venueId === r.venueId && overlap(w, r)) ?? null : null;
  };
  const out: ClosureRow[] = [];
  for (const r of [...every, ...rest]) {
    if (parentOf(r)) continue;
    out.push(r);
    for (const d of rest) if (parentOf(d) === r) out.push({ ...d, under: r.key });
  }
  return out;
}

/** The venue table's tag (S4, note 10): "Closed today" when the whole park or every place is closed today, else how many
 *  of its diamonds are; null when none. */
export function venueTag(closures: readonly Pick<StaffClosure, 'scope' | 'venueId' | 'facilityName' | 'firstDay'>[], venueId: string, today: string): string | null {
  const now = closures.filter(c => c.firstDay <= today && (c.scope === 'all' || c.venueId === venueId));
  if (!now.length) return null;
  if (now.some(c => c.scope !== 'diamond')) return CLOSE_WORDS.closedToday;
  return CLOSE_WORDS.diamondsClosedToday(new Set(now.map(c => c.facilityName)).size);
}

/** The rows under a row ("Also closed on their own"). */
export const rowsUnder = (rows: readonly ClosureRow[], key: string) => rows.filter(r => r.under === key);

/** S6's warning names (item 6 of the gate): one or two parks by name ("Diamond 1 and Diamond 2 at Lions Park and Alder
 *  Fields"), three or more by count ("5 places"); `one` when it is a single place (the verb and "its own"). The tick
 *  counts the closed places and says "diamonds" when they are one park's diamonds. */
export function alsoWords(rows: readonly ClosureRow[]): { names: string; one: boolean; count: number; diamonds: boolean } {
  const parks = new Map<string, { name: string; whole: boolean; diamonds: Set<string> }>();
  for (const r of rows) {
    const k = r.venueId ?? `name:${r.placeName ?? ''}`;
    const p = parks.get(k) ?? parks.set(k, { name: r.placeName ?? '', whole: false, diamonds: new Set() }).get(k)!;
    if (r.scope === 'place') p.whole = true;
    r.diamonds.forEach(d => p.diamonds.add(d.name));
  }
  const said = [...parks.values()].map(p => (p.whole || !p.diamonds.size ? p.name : diamondsNamed(p.diamonds, p.name)));
  const places = [...parks.values()].reduce((n, p) => n + (p.whole ? 1 : p.diamonds.size), 0);
  const diamonds = parks.size === 1 && ![...parks.values()][0].whole;
  return {
    names: said.length <= 2 ? joinWithAnd(said) : `${places} places`,
    one: places === 1, count: places, diamonds,
  };
}

/** What a Reopen does to the site (the summary drawing's tab 5; every window asks this, never builds the words). */
export type ReopenSite =
  /** Every chosen closure is still said by one left showing (a wider one, or the same place pressed again): the site
   *  won't change. `by` is that one's sentence ("All our fields are closed today."), `byName` its place ("all our fields"). */
  | { kind: 'covered'; by: string; byName: string; samePlace: boolean }
  /** The chosen places come off. `still`: what the site goes on saying of those places (every place, the same parks),
   *  as the strip will read it; null when nothing. `own`: the chosen closure's sentence, for "stops saying …" when
   *  something of the place still shows. */
  | { kind: 'stops'; still: ClosureStrip | null; own: string | null };

type SiteClosure = Pick<StaffClosure, 'id' | 'scope' | 'venueId' | 'placeName' | 'facilityName' | 'firstDay' | 'lastDay' | 'showsFrom' | 'endsAt'>;

/** S1 read backwards: the strip over the showing closures minus the ones being reopened (`closureStrip`, the site's own). */
export function reopenSite(showing: readonly SiteClosure[], ids: ReadonlySet<string>, diamondParks: ReadonlySet<string>, nowIso: string): ReopenSite {
  const today = utcToZonedInputs(nowIso).date;
  const live = showing.filter(c => Date.parse(c.endsAt) > Date.parse(nowIso));
  const chosen = live.filter(c => ids.has(c.id));
  const left = live.filter(c => !ids.has(c.id));
  const strip = (c: SiteClosure) => toStripClosure(c, diamondParks);
  const sayers = chosen.map(n => coveringClosures(strip(n), left.map(strip), today)[0]
    ?? left.map(strip).find(w => closureSaysAlready(w, strip(n), today)) ?? null);
  if (chosen.length && sayers.every(Boolean)) {
    const w = sayers[0]!;
    const n = strip(chosen[0]);
    return {
      kind: 'covered', by: stripSentence(w, today, formatShortWeekdayDate), byName: closedPlaceName(w) ?? 'all our fields',
      // The same place pressed again for longer: "… will then open when you reopen Lions Park" would name itself.
      samePlace: closedPlaceName(w) === closedPlaceName(n),
    };
  }
  const everyChosen = chosen.some(c => c.scope === 'all');
  const parks = new Set(chosen.flatMap(c => (c.venueId ? [c.venueId] : [])));
  const related = left.filter(c => everyChosen || c.scope === 'all' || (!!c.venueId && parks.has(c.venueId)));
  const still = closureStrip(related.map(strip), nowIso);
  // "stops saying Diamond 2 at Lions Park is closed through Sun, Nov 29" only where something of the place still shows.
  const own = still && chosen.length === 1 ? lowerEvery(stripSentence(strip(chosen[0]), today, formatShortWeekdayDate)).replace(/\.$/, '') : null;
  return { kind: 'stops', still, own };
}

/** A strip that is one sentence ("Diamond 2 at Lions Park is closed today."), said inline in bold; null when it is more. */
export const oneSentence = (s: ClosureStrip | null): string | null =>
  (s && s.groups.length === 1 && 'sentence' in s.groups[0] ? s.groups[0].sentence : null);

function repDoneLine(t: { name: string; reach: RepReach; sent: boolean }): string {
  if (t.reach === 'none') return `The ${t.name} have no coach to email, so let the team know yourself.`;
  if (!t.sent) return `The ${possessive(t.name)} coaches weren’t emailed, so let the team know yourself.`;
  return t.reach === 'head' ? `The ${possessive(t.name)} head coach was emailed.` : `The ${possessive(t.name)} coaches were emailed (it has no head coach on file).`;
}

function repLines(s: CloseSummary): string[] {
  if (!s.repTeams.length) return [];
  const reached = s.repTeams.filter(t => t.reach !== 'none');
  const none = s.repTeams.filter(t => t.reach === 'none');
  const out: string[] = [];
  const who = (t: { reach: RepReach }) => (t.reach === 'head' ? 'head coach is' : 'coaches are');
  if (reached.length === 1) out.push(`The ${possessive(reached[0].name || 'rep team')} ${who(reached[0])} emailed about the rep game${s.rep > 1 ? 's' : ''}.`);
  else if (reached.length > 1) out.push(`${reached.length} rep teams’ coaches are emailed about their games.`);
  for (const t of none) out.push(`The ${t.name || 'rep team'} have no coach to email.`);
  return out;
}

export type { ClosedPlace };
