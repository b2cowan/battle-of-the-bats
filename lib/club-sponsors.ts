/**
 * lib/club-sponsors.ts — WHEN A CLUB SPONSOR IS SHOWING (Club Tier Stage 4d; words CLUB_TIER_STAGE4D_COPY.md).
 *
 * A sponsor's last day is a whole DAY, inclusive, read in the club's zone: it shows through 11:59 p.m. on that day and is
 * gone at midnight. (The club notice ends at an INSTANT, so its clock is not reused: this is "which calendar day is it
 * for the club", built from the same zone helpers.) Every club is `ORG_TIME_ZONE` today; the zone is a parameter so a
 * per-club zone changes nothing here.
 *
 * ⚠ The filter belongs to the PUBLIC pages' loaders only. The stored list (lib/db `getOrgPublicSiteContent`) keeps an ended
 * sponsor, because the editor shows it, marked Ended, so renewing is one edit. Pure; tested in tests/unit/club-stage4d.test.ts.
 */
import { formatStoredDate, ORG_TIME_ZONE, tournamentToday } from './timezone';
import { PUBLIC_SITE_WORDS as W } from './public-site-words';

interface HasEnd { endsOn?: string }

/** The last day has passed. `today` is the club's calendar day (YYYY-MM-DD); a sponsor with no last day never lapses. */
export function sponsorEnded(s: HasEnd, today: string): boolean {
  return !!s.endsOn && today > s.endsOn;
}

/** The sponsors a family may see right now, in the club's order. */
export function sponsorsShowing<T extends HasEnd>(list: readonly T[] | null | undefined, now: Date = new Date(), timeZone: string = ORG_TIME_ZONE): T[] {
  const today = tournamentToday(now, timeZone);
  return (list ?? []).filter(s => !sponsorEnded(s, today));
}

/** What the editor's closed lists row says: how many sponsors, how many of them have ended. */
export function sponsorCounts(list: readonly HasEnd[] | null | undefined, today: string): { total: number; ended: number } {
  const all = list ?? [];
  return { total: all.length, ended: all.filter(s => sponsorEnded(s, today)).length };
}

/** A sponsor row's second line in the editor. */
export function sponsorRowSub(s: HasEnd, today: string): string {
  if (!s.endsOn) return W.sponsorNoLastDay;
  const day = formatStoredDate(s.endsOn, { withYear: true });
  return sponsorEnded(s, today) ? W.sponsorLastDayWas(day) : W.sponsorUntil(day);
}
