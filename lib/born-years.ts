/**
 * lib/born-years.ts — BIRTH YEARS, ONE RULE (Club Tier Stage 4c-2 Part A; drawings ruled 2026-10-22, Asks 4–7 and round 2's
 * club cut-off per sport; words CLUB_TIER_STAGE4C2_COPY.md A, B, C, D). Every surface calls this; nothing formats a born line
 * by hand.
 *
 * A team's SEASON (rep_program_years) and a house-league division carry two years, `from` and `to`; an empty one is no limit
 * on that side. The club says, per sport, when birthdays count from (organizations.birthday_cutoffs, keyed by normalized sport
 * id; absent = January 1). The years are stored; the cut-off is read when they are shown, so changing it re-reads every team
 * of that sport at once.
 *
 * THE DATE RULE. With cut-off M/D, `from` is the year of the FROM-date (M/D of that year) and `to` is the year of the
 * TO-date, the day before M/D dated in that year: January 1 gives Dec 31 (so "2012–2013" is Jan 1, 2012 – Dec 31, 2013, and
 * one year is the same year twice); September 1 gives Aug 31 (so one band is 2013 → 2014). The same year twice is
 * therefore backwards off January 1 — held when typed, and unshowable at rest after a club moves its cut-off (owner ruling
 * 2026-10-22, C12: no line, and the place stays in every Born in list).
 */

import { normalizeSportId } from './sports';

export type Cutoff = { m: number; d: number };
export type BornYears = { from: number | null; to: number | null };

export const JAN_1: Cutoff = { m: 1, d: 1 };

/** February stops at 28 — a Feb 29 cut-off would skip three years in four (and the DB refuses it too, mig 349). */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const CUTOFF_MONTHS: readonly string[] = MONTHS;
export function daysInCutoffMonth(m: number): number {
  return DAYS_IN_MONTH[m - 1] ?? 31;
}

function asCutoff(v: unknown): Cutoff | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const { m, d } = v as Record<string, unknown>;
  if (typeof m !== 'number' || typeof d !== 'number' || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > DAYS_IN_MONTH[m - 1]) return null;
  return { m, d };
}

export function isJan1(c: Cutoff): boolean {
  return c.m === 1 && c.d === 1;
}

/** The cut-off a record of this sport reads. Anything missing or malformed is January 1. */
export function cutoffFor(cutoffs: unknown, sport: string | null | undefined): Cutoff {
  if (!cutoffs || typeof cutoffs !== 'object' || Array.isArray(cutoffs)) return JAN_1;
  return asCutoff((cutoffs as Record<string, unknown>)[normalizeSportId(sport)]) ?? JAN_1;
}

/** A map ready to store: January 1 is written as absent; null when any entry is not a real date (the API refuses it). */
export function cleanCutoffs(v: unknown): Record<string, Cutoff> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out: Record<string, Cutoff> = {};
  for (const [key, raw] of Object.entries(v as Record<string, unknown>)) {
    const c = asCutoff(raw);
    if (!c || !/^[a-z][a-z0-9_-]{0,31}$/.test(key)) return null;
    if (!isJan1(c)) out[key] = c;
  }
  return out;
}

/** The map as the `organizations.birthday_cutoffs` column holds it: an object is itself, anything else (null, a column not yet
 *  there, a stray array) is `{}`. The one parser every organization mapper calls; entries are read through `cutoffFor`. */
export function storedCutoffs(raw: unknown): Record<string, Cutoff> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, Cutoff>) : {};
}

/** "September 1" in a sentence about the cut-off; "Sep 1" inside a date. */
export function cutoffWords(c: Cutoff, form: 'long' | 'short' = 'long'): string {
  return `${(form === 'long' ? MONTHS : MONTHS_SHORT)[c.m - 1]} ${c.d}`;
}

/** The day before the cut-off, as a month and day of `year` (Jan 1 → Dec 31; Mar 1 → Feb 29 in a leap year). */
function dayBefore(c: Cutoff, year: number): { m: number; d: number } {
  const t = new Date(Date.UTC(year, c.m - 1, c.d - 1));
  // Jan 1 minus a day lands in the year before; the TO-date is dated in the typed year, so Dec 31 of `year`.
  return isJan1(c) ? { m: 12, d: 31 } : { m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function shortDate(md: { m: number; d: number }, year: number): string {
  return `${MONTHS_SHORT[md.m - 1]} ${md.d}, ${year}`;
}

/** "Sep 1, 2013" — the from-date a first box stands for. */
function fromDateWords(c: Cutoff, year: number): string {
  return shortDate(c, year);
}

/** "Aug 31, 2015" — the to-date a second box stands for. */
function toDateWords(c: Cutoff, year: number): string {
  return shortDate(dayBefore(c, year), year);
}

/** The year-box affixes off January 1 ("Sep 1," before the first, "Aug 31," before the second); none on January 1. */
export function boxAffixes(c: Cutoff): { from: string; to: string } | null {
  if (isJan1(c)) return null;
  const before = dayBefore(c, 2001); // a common year: the affix never names Feb 29
  return { from: `${MONTHS_SHORT[c.m - 1]} ${c.d},`, to: `${MONTHS_SHORT[before.m - 1]} ${before.d},` };
}

/** False only for a pair that runs backwards under this cut-off (the same year twice, off January 1 — C12). */
export function bornShowable(years: BornYears, c: Cutoff): boolean {
  const { from, to } = years;
  if (from == null || to == null) return true;
  return isJan1(c) ? from <= to : from < to;
}

function line(years: BornYears, c: Cutoff): string | null {
  const { from, to } = years;
  if (from == null && to == null) return null;
  if (!bornShowable(years, c)) return null;
  if (isJan1(c)) {
    if (from != null && to != null) return from === to ? `${from}` : `${from}–${to}`;
    return from != null ? `${from} or later` : `${to} or earlier`;
  }
  if (from != null && to != null) return `${fromDateWords(c, from)} – ${toDateWords(c, to)}`;
  if (from != null) return `on or after ${fromDateWords(c, from)}`;
  return `before ${fromDateWords(c, to!)}`; // the day after Aug 31, 2014 is Sep 1, 2014
}

/** What families read: "Born 2012–2013" · "Born Sep 1, 2013 – Aug 31, 2015" · … — null when there is nothing to say. */
export function bornLine(years: BornYears, c: Cutoff): string | null {
  const l = line(years, c);
  return l ? `Born ${l}` : null;
}

/** The same line lower-case after a dot, for the tryout page meta ("For the 2027 season · born 2012–2013"). */
export function bornMeta(years: BornYears, c: Cutoff): string | null {
  const l = line(years, c);
  return l ? `born ${l}` : null;
}

const LEAVE_EMPTY = 'Leave a box empty for no limit on that side.';

/** Under Team details' boxes (A4–A11). */
export function bornHint(years: BornYears, c: Cutoff): string {
  const l = bornLine(years, c);
  return l ? `Families see “${l}”.` : `Families see no birth years yet. ${LEAVE_EMPTY}`;
}

/** Under the division window's boxes (B3). */
export function divisionBornHint(years: BornYears, c: Cutoff): string {
  const l = bornLine(years, c);
  return l ? `Families see “${l}” beside this division.` : `Families see no birth years for this division. ${LEAVE_EMPTY}`;
}

/** "{Sport} birthdays count from {September 1}." (A13, A14, B3). */
export function cutoffSentence(sportLabel: string, c: Cutoff): string {
  return `${sportLabel} birthdays count from ${cutoffWords(c)}.`;
}

/** The held reason at REST for a stored pair a cut-off change made unshowable (C12b). */
export function unshowableHeld(c: Cutoff, kind: 'team' | 'division'): string {
  return `Families see no birth years for this ${kind} yet. From ${cutoffWords(c)}, the second year has to be later than the first. Change it to show them.`;
}

export type BornCheck = { ok: true; years: BornYears } | { ok: false; held: string };

/** The checks (A15–A18): a value is held with its reason, never saved, never silently swapped. */
export function checkBornYears(rawFrom: string, rawTo: string, c: Cutoff, thisYear: number): BornCheck {
  const parse = (raw: string): number | null | 'bad' => {
    const t = raw.trim();
    if (!t) return null;
    return /^(?:19|20)\d{2}$/.test(t) ? Number(t) : 'bad';
  };
  const from = parse(rawFrom);
  const to = parse(rawTo);
  if (from === 'bad' || to === 'bad') return { ok: false, held: 'Use a four-digit year, like 2013, to save it.' };
  if ((from ?? 0) > thisYear || (to ?? 0) > thisYear) return { ok: false, held: `A birth year can’t be after ${thisYear}.` };
  const years = { from, to };
  if (!bornShowable(years, c)) {
    return isJan1(c)
      ? { ok: false, held: 'Put the earlier year first to save it.' }
      : { ok: false, held: `${toDateWords(c, to!)} comes before ${fromDateWords(c, from!)}. Make the second year later to save it.` };
  }
  return { ok: true, years };
}

/**
 * THE one SERVER check of a stored pair — the house-league division routes and the season PATCH (`bornYearsFromBody` in
 * `lib/program-year-patch.ts`) both call it, so the refusal words are the same everywhere (A15, A16, A17). The years rule only
 * — January 1, never the club's cut-off, whose stricter date rule is the browser's held reason (`checkBornYears`): a pair is
 * refused when a year is not four digits, is after this year, or the earlier one is second.
 */
export function checkBornBody(from: unknown, to: unknown, thisYear: number): BornCheck {
  const s = (v: unknown) => (v == null ? '' : String(v));
  return checkBornYears(s(from), s(to), JAN_1, thisYear);
}

/** A checked pair as stored columns — null for an empty box. */
export function bornColumns(years: BornYears): { born_from_year: number | null; born_to_year: number | null } {
  return { born_from_year: years.from, born_to_year: years.to };
}

/** Born in: keeps a place whose range overlaps the picked calendar year. An open side matches every year beyond it; a place
 *  with no years, or one a cut-off made unshowable, is in every list. The from-date always falls in `from` and the
 *  to-date in `to`, so the overlap is on the years for every cut-off. */
export function bornMatchesYear(years: BornYears, c: Cutoff, year: number): boolean {
  if (years.from == null && years.to == null) return true;
  if (!bornShowable(years, c)) return true;
  return (years.from == null || years.from <= year) && (years.to == null || years.to >= year);
}

/** The years the Born in menu offers: every year a listed place names (a closed range fills in; an open side adds only its
 *  own year), newest first. Empty → no pill (there is nothing to pick). */
export function bornYearChoices(places: readonly BornYears[], c: Cutoff, thisYear: number): number[] {
  const out = new Set<number>();
  for (const p of places) {
    if (!bornShowable(p, c)) continue;
    if (p.from != null && p.to != null) for (let yr = p.from; yr <= Math.min(p.to, thisYear); yr++) out.add(yr);
    else if (p.from != null) out.add(p.from);
    else if (p.to != null) out.add(p.to);
  }
  return [...out].sort((a, b) => b - a);
}

/** `?born=2015` → 2015; anything else is no pick. */
export function parseBornParam(v: string | string[] | undefined | null): number | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && /^(?:19|20)\d{2}$/.test(s.trim()) ? Number(s.trim()) : null;
}

/** Start next season: one year later; an empty box stays empty. */
export function rollBornYears(years: BornYears): BornYears {
  return { from: years.from == null ? null : years.from + 1, to: years.to == null ? null : years.to + 1 };
}

/** How many places a move to this cut-off would leave unshowable (C12): the same year twice, off January 1. */
export function oneYearPlaces(places: readonly BornYears[], next: Cutoff): number {
  if (isJan1(next)) return 0;
  return places.filter(p => p.from != null && p.from === p.to).length;
}

/** Read a row's pair (snake_case columns) — the one place the column names meet the rule. */
export function bornYearsOf(row: { born_from_year?: number | null; born_to_year?: number | null } | null | undefined): BornYears {
  return { from: row?.born_from_year ?? null, to: row?.born_to_year ?? null };
}
