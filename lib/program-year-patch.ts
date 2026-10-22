/**
 * lib/program-year-patch.ts — what the admin season PATCH accepts for the two Stage 4c-2 fields, pure so a test can pin it
 * (Club Tier Stage 4c-2 Part A; words CLUB_TIER_STAGE4C2_COPY.md A15–A17, E10, E11, K8).
 *
 *   - BIRTH YEARS (`bornFromYear` / `bornToYear`): a four-digit year or empty, none after this calendar year, the earlier
 *     one first on the YEARS (the database's own CHECK) — the same `checkBornBody` the house-league division routes use. The strict DATE rule off January 1 depends on the club's cut-off
 *     and is the browser's held reason (`checkBornYears`); this refuses only what the database would, so a stored pair is
 *     always one the rule can read.
 *   - THE TRYOUT BLURB (`tryoutDescription`): at most 500 characters once trimmed, and only on the team's LIVE season —
 *     the same live-season rule the sign-up switch uses.
 */
import { checkBornBody, type BornYears } from './born-years';

export const TRYOUT_BLURB_MAX = 500;

export const BLURB_TOO_LONG = `The text under From the club can be up to ${TRYOUT_BLURB_MAX} characters.`;
export const BLURB_NOT_LIVE = 'Only the team’s current season can be changed.';

export type Refusal = { error: string };

/** The pair a body asks to store, with a side left out of the body keeping what the season has. `null` = the body doesn't touch the years. */
export function bornYearsFromBody(
  body: Record<string, unknown>,
  stored: BornYears,
  thisYear: number,
): { years: BornYears } | Refusal | null {
  if (!('bornFromYear' in body) && !('bornToYear' in body)) return null;
  const rawFrom = 'bornFromYear' in body ? body.bornFromYear : stored.from;
  const rawTo = 'bornToYear' in body ? body.bornToYear : stored.to;
  // ONE check with the division API: `checkBornBody` (A15 four-digit, A16 after this year, A17 earlier first).
  const check = checkBornBody(rawFrom, rawTo, thisYear);
  if (!check.ok) return { error: check.held };
  return { years: check.years };
}

/** The blurb to store: trimmed, empty → null. Over the cap is refused (E10); a non-text value is refused as a bad request. */
export function blurbFromBody(value: unknown): { text: string | null } | Refusal {
  if (value === null || value === undefined) return { text: null };
  if (typeof value !== 'string') return { error: 'Couldn’t save your changes. Try again.' };
  const text = value.trim();
  if (Array.from(text).length > TRYOUT_BLURB_MAX) return { error: BLURB_TOO_LONG };
  return { text: text || null };
}

/** The blurb "Start from last season's words" fills the box with: the season rolled from — the newest OTHER season — when it
 *  had words; null (no door) otherwise. Only the previous season counts, never an older one that happened to have some. */
export function previousBlurbOf(
  seasons: readonly { id: string; year: number; createdAt: string; tryoutDescription: string | null }[],
  current: { id: string; year: number; createdAt: string },
): string | null {
  // Seasons BEFORE this one: an earlier year, or the same year made earlier. A later season is never "last season".
  const others = seasons.filter(s => s.id !== current.id
    && (s.year < current.year || (s.year === current.year && s.createdAt < current.createdAt)));
  if (others.length === 0) return null;
  const previous = [...others].sort((a, b) => b.year - a.year || (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))[0];
  const text = previous.tryoutDescription?.trim();
  return text ? text : null;
}
