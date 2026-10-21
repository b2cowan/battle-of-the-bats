/**
 * lib/past-year-hint.ts — "Mentions 2025 — still true?" (Club Tier Stage 4c, R-06; words CLUB_TIER_STAGE4C1_COPY.md §C).
 *
 * Stale seasonal words were the failure on every one of the ten club sites the drawings studied. A HINT under the
 * tagline, the about text, a question's answer and (4c-2) a tryout blurb, never a block. A "past year" is a four-digit
 * year before this calendar year, standing on its own (not inside a phone number or a longer figure). A founding year
 * ("since 1979", "founded in 1998", "est. 2004") is history that stays true, so it is not flagged.
 */

import { joinWithAnd } from './utils';

const YEAR = /(?<![\d])((?:19|20)\d{2})(?![\d])/g;
const FOUNDING = /\b(?:since|founded(?:\s+in)?|established(?:\s+in)?|est\.?)\s*$/i;

/** The past years the text mentions, oldest first, each once. */
export function pastYearsMentioned(text: string | null | undefined, thisYear: number): number[] {
  if (!text) return [];
  const found = new Set<number>();
  for (const m of text.matchAll(YEAR)) {
    const year = Number(m[1]);
    if (year >= thisYear) continue;
    if (FOUNDING.test(text.slice(Math.max(0, m.index! - 20), m.index))) continue;
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
