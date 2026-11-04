/**
 * START NEXT SEASON (House League 9f-2; rulings 9f·8–9f·13, words `HOUSE_LEAGUE_STAGE9F_COPY.md` Part B and §14.1).
 *
 * The whole decision of "start a season from another one", as pure functions: what the name becomes, how the five dates and
 * the birth years move, what the picker and the window say, what the new season's banner lists, and the per-line
 * fingerprints that let a "From {season}" mark disappear once its line is edited. No I/O, so the window, the create route and
 * the Overview all read the same rule and `tests/unit/house-league-start-from.test.ts` can pin it (the split
 * `lib/season-carry.ts` made for the rep rollover: a local helper is an untestable one).
 *
 * ⚠ THE SOURCE IS NEVER WRITTEN (9f·11). Nothing here returns a change to the source season.
 * ⚠ DATES MOVE ON THE DATE PART ONLY. Registration open/close are stored as the club's wall clock with a literal `Z`; the
 *   time suffix is kept as stored and nothing is re-zoned (`registrationDay` in `lib/house-league-season.ts`).
 * ⚠ BIRTH YEARS MOVE BY THE DIFFERENCE OF THE TWO FIRST DAYS' YEAR NUMBERS, not by elapsed time: May 1 2027 → Apr 29 2028
 *   is 363 days, zero whole years, and the drawing (s15) says "(here, one)".
 */

import { isFinishedLeagueSeason } from './house-league-access';
import type { BornYears } from './born-years';
import type { ChecklistKey } from './house-league-season';
import { addCalendarDays, daysBetweenDateStrings } from './timezone';
import { joinWithAnd, pluralize, possessive } from './utils';

/** 52 weeks: every date lands on the same weekday (9f·13). */
export const NEXT_SEASON_DAYS = 364;

// ── The source ────────────────────────────────────────────────────────────────────────────────────

/** What the window and the route read off the season a new one starts from. */
export type StartSource = {
  id: string;
  name: string;
  status: string;
  seasonStartDate: string | null;
  seasonEndDate: string | null;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  earlyBirdUntil: string | null;
};

/** A source that is not finished (getting ready, open or running): its dates do not come across (9f·10). */
export function isLiveSource(source: Pick<StartSource, 'status'>): boolean {
  return !isFinishedLeagueSeason(source);
}

const dayOf = (v: string | null | undefined): string | null => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const yearOf = (v: string | null | undefined): number | null => { const d = dayOf(v); return d ? Number(d.slice(0, 4)) : null; };

// ── Dates ─────────────────────────────────────────────────────────────────────────────────────────

/** A stored date or timestamp moved by `days`: the date part moves, everything after it (a time, a `Z`) is kept as stored. */
export function shiftStamp(v: string | null | undefined, days: number): string | null {
  const d = dayOf(v);
  if (!d) return null;
  return `${addCalendarDays(d, days)}${v!.slice(10)}`;
}

/**
 * How many days every date moves. From a finished source: 52 weeks, or — once the person edits the new first day — the gap
 * between the two first days, so the other four keep their distance to it. No source first day: 52 weeks for whatever dates
 * it has. A live source: null (no dates come across).
 */
export function dateShiftDays(source: Pick<StartSource, 'status' | 'seasonStartDate'>, newFirstDay?: string | null): number | null {
  if (isLiveSource(source)) return null;
  const from = dayOf(source.seasonStartDate), to = dayOf(newFirstDay);
  if (from && to) return daysBetweenDateStrings(from, to);
  return NEXT_SEASON_DAYS;
}

export type FiveDates = {
  seasonStartDate: string | null;
  seasonEndDate: string | null;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  earlyBirdUntil: string | null;
};

/** The five dates a new season arrives with (all empty from a live source; an empty one stays empty). */
export function movedDates(source: StartSource, shift: number | null): FiveDates {
  const m = (v: string | null) => (shift == null ? null : shiftStamp(v, shift));
  return {
    seasonStartDate: m(source.seasonStartDate),
    seasonEndDate: m(source.seasonEndDate),
    registrationOpenAt: m(source.registrationOpenAt),
    registrationCloseAt: m(source.registrationCloseAt),
    earlyBirdUntil: m(source.earlyBirdUntil),
  };
}

/** True when the dates actually moved: a finished source with at least one date. */
export function datesMoved(source: StartSource, shift: number | null): boolean {
  return shift != null && Object.values(movedDates(source, shift)).some(v => v != null);
}

// ── Birth years ───────────────────────────────────────────────────────────────────────────────────

/**
 * How many years the birth years move up (9f·13): the new first day's year number minus the source's, never below zero. A
 * live source: zero (birth years stay as they are, Q13). Either first day missing: the last day stands in; nothing to read
 * on either side: one, the usual case.
 */
export function bornShiftYears(
  source: Pick<StartSource, 'status' | 'seasonStartDate' | 'seasonEndDate'>,
  next: { seasonStartDate?: string | null; seasonEndDate?: string | null },
): number {
  if (isLiveSource(source)) return 0;
  const a = yearOf(source.seasonStartDate) ?? yearOf(source.seasonEndDate);
  const b = yearOf(next.seasonStartDate) ?? yearOf(next.seasonEndDate);
  if (a == null || b == null) return 1;
  return Math.max(0, b - a);
}

/** A stored pair moved up `years`; an empty side stays empty. */
export function moveBornYears(years: BornYears, by: number): BornYears {
  return { from: years.from == null ? null : years.from + by, to: years.to == null ? null : years.to + by };
}

// ── The name ──────────────────────────────────────────────────────────────────────────────────────

const YEAR = /\b(19|20)\d{2}\b/g;

/**
 * The new season's name (9f·13): exactly one standalone four-digit year goes up by `years`; none, or more than one, gives
 * null (the field arrives empty, the source's name as its placeholder). A year always goes up by at least one, so a season
 * starting January 1 (52 weeks later is December 31 of the same year) still gets a new name rather than a taken one.
 */
export function bumpedName(name: string, years: number): string | null {
  const found = name.match(YEAR);
  if (!found || found.length !== 1) return null;
  const by = Math.max(1, years);
  return name.replace(YEAR, y => String(Number(y) + by));
}

/** The name the window prefills when a season is picked (once; later date edits never rewrite it). Live source: empty. */
export function startName(source: StartSource): string {
  if (isLiveSource(source)) return '';
  const shift = dateShiftDays(source);
  const next = movedDates(source, shift);
  return bumpedName(source.name, bornShiftYears(source, next)) ?? '';
}

// ── What comes across ─────────────────────────────────────────────────────────────────────────────

export type Bring = { settings: boolean; ageGroups: boolean; teams: boolean; practice: boolean; coaches: boolean };

/** The defaults (9f·12): everything ticked but coaches. */
export const DEFAULT_BRING: Bring = { settings: true, ageGroups: true, teams: true, practice: true, coaches: false };

/**
 * The ticks as they can actually be honoured: teams and practice settings live under age groups, and a coach lives on a
 * team, so each needs what it hangs on. The window disables the dependants; the route applies the same rule to whatever it
 * is sent.
 */
export function honouredBring(b: Partial<Bring> | null | undefined): Bring {
  const settings = b?.settings === true;
  const ageGroups = b?.ageGroups === true;
  const teams = ageGroups && b?.teams === true;
  return { settings, ageGroups, teams, practice: ageGroups && b?.practice === true, coaches: teams && b?.coaches === true };
}

// ── The stored record (league_seasons.started_from) ──────────────────────────────────────────────

/**
 * What a season started from another one remembers (mig 432): where it came from, what was brought, and a fingerprint of
 * each checklist line as it arrived. A mark shows while its line's fingerprint still matches, so editing a line clears its
 * mark with no hook in any save route. The source's id is not a foreign key: deleting the source never touches this.
 */
export type StartedFrom = {
  sourceId: string;
  sourceName: string;
  live: boolean;
  /** Days every date moved; null when no date came across. */
  shiftDays: number | null;
  /** Years the birth years moved up. */
  bornShift: number;
  brought: { settings: boolean; ageGroups: number; teams: number; practice: boolean; coaches: number };
  prints: Partial<Record<ChecklistKey, string>>;
};

/** A stored record read back defensively (a malformed one reads as none: no banner, no marks). */
export function readStartedFrom(raw: unknown): StartedFrom | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const b = (r.brought ?? {}) as Record<string, unknown>;
  if (typeof r.sourceId !== 'string' || typeof r.sourceName !== 'string') return null;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const prints: Partial<Record<ChecklistKey, string>> = {};
  const p = (r.prints ?? {}) as Record<string, unknown>;
  for (const k of ['ageGroups', 'prices', 'dates', 'pay', 'waiver'] as const) if (typeof p[k] === 'string') prints[k] = p[k] as string;
  return {
    sourceId: r.sourceId, sourceName: r.sourceName, live: r.live === true,
    shiftDays: typeof r.shiftDays === 'number' ? r.shiftDays : null, bornShift: n(r.bornShift),
    brought: { settings: b.settings === true, ageGroups: n(b.ageGroups), teams: n(b.teams), practice: b.practice === true, coaches: n(b.coaches) },
    prints,
  };
}

// ── Fingerprints of the checklist lines ──────────────────────────────────────────────────────────

/** What a fingerprint reads off a season (the checklist's own inputs). */
export type PrintSeason = {
  registrationFee: number | string | null;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  earlyBirdUntil: string | null;
  howToPay: string | null;
  waiverText: string | null;
};
/** What a fingerprint reads off one age group. */
export type PrintDivision = {
  name: string;
  capacity: number | string | null;
  bornFromYear: number | string | null;
  bornToYear: number | string | null;
  price: number | string | null;
  earlyPrice: number | string | null;
};

/** FNV-1a, 32 bits, hex: short, stable, no dependency. A fingerprint only has to tell "unchanged" from "changed". */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
/** A number as text whatever shape the database handed back ("150.00", 150, null). */
const num = (v: number | string | null | undefined) => (v == null || v === '' ? '' : String(Number(v)));
/** A stored wall-clock stamp to the minute, whatever suffix the database handed back (`Z`, `+00:00`, seconds or not). */
const stamp = (v: string | null | undefined) => (v ? v.slice(0, 16) : '');
const text = (v: string | null | undefined) => (v ?? '').trim();
/** Rows in a stable order (ids are new on the copy, so content alone decides). */
const rows = (xs: string[]) => [...xs].sort().join('\n');

/** Each checklist line's fingerprint, from the same inputs the line reads. */
export function checklistPrints(season: PrintSeason, divisions: readonly PrintDivision[]): Record<ChecklistKey, string> {
  return {
    ageGroups: hash(rows(divisions.map(d => [text(d.name), num(d.capacity), num(d.bornFromYear), num(d.bornToYear)].join('|')))),
    prices: hash(`${num(season.registrationFee)}#${dayOf(season.earlyBirdUntil) ?? ''}#${rows(divisions.map(d => [text(d.name), num(d.price), num(d.earlyPrice)].join('|')))}`),
    dates: hash(`${stamp(season.registrationOpenAt)}#${stamp(season.registrationCloseAt)}`),
    pay: hash(text(season.howToPay)),
    waiver: hash(text(season.waiverText)),
  };
}

/**
 * The fingerprints a new season stores: only for the lines that came across with something on them. Age groups and prices
 * come with the age groups; how to pay and the waiver with the settings; the registration dates whenever they moved.
 */
export function startPrints(
  season: PrintSeason, divisions: readonly PrintDivision[], brought: StartedFrom['brought'], shiftDays: number | null,
): Partial<Record<ChecklistKey, string>> {
  const all = checklistPrints(season, divisions);
  const out: Partial<Record<ChecklistKey, string>> = {};
  if (brought.ageGroups > 0) { out.ageGroups = all.ageGroups; out.prices = all.prices; }
  if (shiftDays != null && (season.registrationOpenAt || season.registrationCloseAt)) out.dates = all.dates;
  if (brought.settings && text(season.howToPay)) out.pay = all.pay;
  if (brought.settings && text(season.waiverText)) out.waiver = all.waiver;
  return out;
}

/** The lines whose mark still shows: a print was stored and the line still matches it. */
export function markedLines(
  from: StartedFrom, season: PrintSeason, divisions: readonly PrintDivision[],
): Set<ChecklistKey> {
  const now = checklistPrints(season, divisions);
  const out = new Set<ChecklistKey>();
  for (const [k, v] of Object.entries(from.prints) as [ChecklistKey, string][]) if (now[k] === v) out.add(k);
  return out;
}

// ── Words (copy Part B, §14.1) ────────────────────────────────────────────────────────────────────

const weeksOrDays = (days: number) => {
  const n = Math.abs(days);
  return n % 7 === 0 ? pluralize(n / 7, 'week') : pluralize(n, 'day');
};

/** "one year", "two years", "three years", then digits: the copy says the sentence is built with the real number (§10, `bw.ageGroups`). */
const yearsWord = (n: number) => (n === 1 ? 'one year' : n === 2 ? 'two years' : n === 3 ? 'three years' : `${n} years`);

export const START_FROM_WORDS = {
  label: 'Start from',
  blank: 'A blank season',
  blankSub: 'Name, sport and dates only.',
  /** §8 `sf.left`, for every source. */
  left: (name: string) => `${name} is left exactly as it was. Its families, payments, games and scores stay with it.`,
  /** §8 `sf.owes`, only for a FINISHED source when someone owes. `amount` is already formatted as the Overview's tile shows it. */
  owes: (players: number, amount: string) =>
    `${pluralize(players, 'player')} still ${players === 1 ? 'owes' : 'owe'} ${amount} there. That stays on its Money tab.`,
  /**
   * §9.1 `sf.dates.desk` / `.phone`. Written for 52 weeks; when the person moves the first day the sentence follows the real
   * gap, so it never claims a weekday it no longer keeps.
   */
  dates: (name: string, shiftDays: number, phone: boolean) => {
    const gap = `${weeksOrDays(shiftDays)} ${shiftDays < 0 ? 'before' : 'after'} ${possessive(name)} dates`;
    const sameDay = shiftDays % 7 === 0;
    if (phone) return sameDay ? `${gap}, on the same weekdays.` : `${gap}.`;
    return `${gap}${sameDay ? ', so every day falls on the same weekday' : ''}. The registration dates and the early price move the same way; check them on the new season’s Overview.`;
  },
  /** §9.2 `sf.dates.live`. */
  datesLive: (name: string) => `${name} isn’t finished, so no dates come across. Set the new season’s own.`,
  bringTitle: 'Bring with it',
  settings: 'The season’s settings',
  settingsSub: 'Fee, how to pay, waiver, email consent, how new registrations are taken, the waitlist, Owing turns amber, and the schedule rules.',
  ageGroups: 'Age groups',
  ageGroupsSub: (example: { name: string; from: number | null; to: number | null } | null, years: number, phone: boolean) => {
    if (years <= 0) return phone ? null : 'Names, sizes, prices, early prices, notes, games per team and Show standings.';
    const moves = `Birth years move up ${yearsWord(years)}`;
    if (phone) return `${moves}.`;
    const ex = example && example.from != null && example.to != null
      ? `: ${example.name} becomes born ${example.from + years}–${example.to + years}.` : '.';
    return `Names, sizes, prices, early prices, notes, games per team and Show standings. ${moves}${ex}`;
  },
  ageGroupsLive: 'Choose which age groups come across.',
  teams: 'Team names and colours',
  teamsSub: 'No players. You run the draft again.',
  practice: 'Practice length and teams at once',
  practiceSub: 'For each age group.',
  coaches: 'Coaches',
  coachesSub: (phone: boolean) => (phone ? 'Invited only when you publish teams.'
    : 'Names and emails, on the same teams. Nobody is invited until you publish teams.'),
  empty: (phone: boolean) => (phone
    ? 'Always starts empty: registrations, payments, ratings, games, practices, emails and the club’s time.'
    : 'Always starts empty: registrations and payments, ratings, games and scores, practices, emails and notices, and the club’s time. The club gives the new season its time, as it does every season.'),
  foot: 'Families are not emailed.',
  /** §11 `mk.from`, `mk.moved`. */
  markFrom: (name: string) => `From ${name}`,
  markMoved: (shiftDays: number) => `Moved ${weeksOrDays(shiftDays)}`,
  /** §11 `mk.ageLine`'s second half, desk only. */
  ageLineMoved: (years: number) => `birth years moved up ${yearsWord(years)}`,
  /** §11 `mk.noTime`'s first sentence: the product's own (`lib/league-time.ts`), said of this season. */
  noTime: 'The club hasn’t given this season any time yet.',
  noTimeHowAdmin: 'It gives it in the club’s Schedules; games and practices can be made once it has.',
  /** A league admin cannot open Schedules: `noneGivenLeagueAdmin`'s second sentence (`lib/league-time.ts`). */
  noTimeHowLeagueAdmin: 'An owner or an admin gives it, in Schedules.',
} as const;

/** The picker's second line (§7 `sf.option`): "{Finished} · {4 age groups} · {22 teams}". */
export function optionLine(pill: string, ageGroups: number, teams: number): string {
  return `${pill} · ${pluralize(ageGroups, 'age group')} · ${pluralize(teams, 'team')}`;
}

/** What came across, as the banner lists it (§11 `mk.line`): only what was ticked; practice settings never listed. */
export function broughtList(b: StartedFrom['brought']): string {
  const parts: string[] = [];
  if (b.settings) parts.push('settings');
  if (b.ageGroups > 0) parts.push(pluralize(b.ageGroups, 'age group'));
  if (b.teams > 0) parts.push(pluralize(b.teams, 'team name'));
  if (b.coaches > 0) parts.push(pluralize(b.coaches, 'coach', 'coaches'));
  return joinWithAnd(parts);
}

/** The new season's banner (§11 `mk.line`), desk or phone. */
export function startedLine(from: StartedFrom, phone: boolean): string {
  const list = broughtList(from.brought);
  const head = phone || !list ? `Started from ${from.sourceName}.` : `Started from ${from.sourceName}: ${list}.`;
  return `${head} Check each line, then open registration.`;
}
