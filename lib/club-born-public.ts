/**
 * lib/club-born-public.ts — THE BORN LINE AND THE BORN IN PICK, AS THE CLUB'S PUBLIC PAGES USE THEM (Club Tier Stage 4c-2
 * Part A; drawings ruled 2026-10-22, words CLUB_TIER_STAGE4C2_COPY.md D1–D23). Pure, so it is unit-tested
 * (tests/unit/club-stage4c2-public.test.ts); the pages only render what it decides.
 *
 * The RULE is lib/born-years.ts (the date rule, the family line, the overlap match). This file only joins it to the
 * places a family reads it: it reads a place's years under its own sport's cut-off, keeps the places a picked year
 * fits, offers the years a menu lists, and says how many places that left. Nothing here — and nothing on a page —
 * formats a born line by hand: every line comes from `bornLine` / `bornMeta`.
 */
import {
  bornLine,
  bornMatchesYear,
  bornMeta,
  bornYearChoices,
  cutoffFor,
  parseBornParam,
  type BornYears,
  type Cutoff,
} from './born-years';
import { pluralize } from './utils';

/** One place's birth years, ready for a page: the stored pair, the cut-off its sport reads, and the line it earns. */
export interface BornFacts {
  years: BornYears;
  cutoff: Cutoff;
  /** "Born 2012–2013" — null when there is nothing to say (no years, or a pair the club's cut-off made unshowable). */
  line: string | null;
  /** "born 2012–2013", lower-case for after a dot. */
  meta: string | null;
}

/** A place's years read under its sport's cut-off (`organizations.birthday_cutoffs`; absent = January 1). */
export function bornFactsOf(years: BornYears, cutoffs: unknown, sport: string | null | undefined): BornFacts {
  const cutoff = cutoffFor(cutoffs, sport);
  return { years, cutoff, line: bornLine(years, cutoff), meta: bornMeta(years, cutoff) };
}

/** True when this place has typed any year at all (a house-league division is listed under a pick only when it has). */
export function hasBornYears(f: Pick<BornFacts, 'years'>): boolean {
  return f.years.from != null || f.years.to != null;
}

/** Does the picked year keep this place? No pick keeps everything; a place with no years always stays (born-years.ts). */
export function keepsBornYear(f: BornFacts, year: number | null): boolean {
  return year == null || bornMatchesYear(f.years, f.cutoff, year);
}

/**
 * The years the Born in menu offers, newest first: every year any listed place names, each read under its own cut-off
 * (a club can count softball from September and baseball from January). Empty → no pill: with no years there is
 * nothing to pick.
 */
export function bornMenuYears(places: readonly Pick<BornFacts, 'years' | 'cutoff'>[], thisYear: number): number[] {
  const byCutoff = new Map<string, { cutoff: Cutoff; years: BornYears[] }>();
  for (const p of places) {
    const key = `${p.cutoff.m}-${p.cutoff.d}`;
    const group = byCutoff.get(key) ?? { cutoff: p.cutoff, years: [] };
    group.years.push(p.years);
    byCutoff.set(key, group);
  }
  const all = new Set<number>();
  for (const g of byCutoff.values()) for (const y of bornYearChoices(g.years, g.cutoff, thisYear)) all.add(y);
  return [...all].sort((a, b) => b - a);
}

/** `?born=2015`, honoured only while the menu offers that year — a stale shared link shows the whole list, never a dead one. */
export function resolveBornPick(raw: string | string[] | undefined | null, menu: readonly number[]): number | null {
  const year = parseBornParam(raw);
  return year != null && menu.includes(year) ? year : null;
}

/** What the Teams and Tryouts pages both do with the address: the menu of years the listed places name, and the pick honoured
 *  against it. One call, so the two pages cannot read `?born=` differently. */
export function bornPickOf(
  places: readonly Pick<BornFacts, 'years' | 'cutoff'>[],
  raw: string | string[] | undefined | null,
  thisYear: number,
): { menu: number[]; pick: number | null } {
  const menu = bornMenuYears(places, thisYear);
  return { menu, pick: resolveBornPick(raw, menu) };
}

/** The meta under the title while a year is picked (D18–D21): "3 places for a player born in 2015". A place is a team or a
 *  house-league division. */
export function bornPlacesSentence(count: number, year: number): string {
  if (count === 0) return `No places for a player born in ${year}. Pick another year.`;
  return `${pluralize(count, 'place')} for a player born in ${year}`;
}

/** The address a pick lives in, so a filtered list can be shared: `?born=2015`, nothing for "Any year". */
export function bornPickHref(path: string, year: number | null): string {
  return year == null ? path : `${path}?born=${year}`;
}

/** A line made of whatever parts exist, joined the product's way. */
export function joinSub(parts: readonly (string | null | undefined | false)[]): string | null {
  const kept = parts.filter((p): p is string => !!p);
  return kept.length > 0 ? kept.join(' · ') : null;
}
