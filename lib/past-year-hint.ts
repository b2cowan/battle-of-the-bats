/**
 * lib/past-year-hint.ts — "Mentions 2025 — still true?" (Club Tier Stage 4c, R-06; words CLUB_TIER_STAGE4C1_COPY.md §C).
 *
 * Stale seasonal words were the failure on every one of the ten club sites the drawings studied. A HINT under the
 * tagline, the about text, a question's answer and (4c-2) a tryout blurb, never a block. A "past year" is a four-digit
 * year before this calendar year, standing on its own (not inside a phone number or a longer figure). A founding year
 * ("since 1979", "founded in 1998", "est. 2004") is history that stays true, so it is not flagged. Nor is a BIRTH year
 * (Stage 4c-2, Ask 11): a tryout blurb naming who may come always names a past year and is always right, and a hint that
 * fires on every honest blurb teaches the club to ignore it. A year is a birth year when the birth word is attached to it,
 * through nothing but other years and the words joining them: "born 2012 and 2013", "born in 2012–2013", "2012 and 2013
 * birth years" — not merely when "born" shares its sentence (/review 2026-10-22).
 */

import { joinWithAnd } from './utils';

const YEAR = /(?<![\d])((?:19|20)\d{2})(?![\d])/g;
const FOUNDING = /\b(?:since|founded(?:\s+in)?|established(?:\s+in)?|est\.?)\s*$/i;
/* A birth year is one the birth word is attached to, through nothing but other years and the words that join them —
   "born 2012", "born in 2012–2013", "born 2012 or 2013", "birth year 2011"; "2012 and 2013 birth years". Merely sharing a
   sentence with "born" is not enough: in "Tryouts for 2025 are for players born in 2012", 2025 is still a stale season. */
const YEAR_LINK = String.raw`\s*(?:[–—\-/,&]|\band\b|\bor\b|\bto\b|\bthrough\b)\s*`;
const A_YEAR = String.raw`(?:19|20)\d{2}`;
const BIRTH_BEFORE = new RegExp(
  String.raw`\b(?:born|birth\s*years?|birthdates?)(?:\s+(?:in|on|between|from|after|before))?\s*(?:${A_YEAR}${YEAR_LINK})*$`, 'i');
const BIRTH_AFTER = new RegExp(String.raw`^(?:${YEAR_LINK}${A_YEAR})*\s*(?:birth\s*years?|births?)\b`, 'i');
/** Far enough back for "born between 2010, 2011, 2012 and " before the year. */
const BIRTH_REACH = 60;

function isBirthYear(text: string, at: number, length: number): boolean {
  return BIRTH_BEFORE.test(text.slice(Math.max(0, at - BIRTH_REACH), at))
    || BIRTH_AFTER.test(text.slice(at + length, at + length + BIRTH_REACH));
}

/** The past years the text mentions, oldest first, each once. */
export function pastYearsMentioned(text: string | null | undefined, thisYear: number): number[] {
  if (!text) return [];
  const found = new Set<number>();
  for (const m of text.matchAll(YEAR)) {
    const year = Number(m[1]);
    if (year >= thisYear) continue;
    if (FOUNDING.test(text.slice(Math.max(0, m.index! - 20), m.index))) continue;
    if (isBirthYear(text, m.index!, m[1].length)) continue;
    found.add(year);
  }
  return [...found].sort((a, b) => a - b);
}

/** "Mentions 2025 — still true?" · "Mentions 2024 and 2025 — still true?" · "Mentions 2023, 2024 and 2025 — …"; null when none. */
export function pastYearHint(text: string | null | undefined, thisYear: number): string | null {
  const years = pastYearsMentioned(text, thisYear);
  if (years.length === 0) return null;
  return `Mentions ${joinWithAnd(years.map(String))} — still true?`;
}
