import { formatStoredDate, tournamentToday } from './timezone';
import type { HouseLeagueAccess } from './house-league-access';
import type { LeagueSeasonStatus } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ONE HOUSE-LEAGUE SEASON, AS EVERY SCREEN NAMES IT (Club Tier Stage 9a, Parts 2–5; owner 9a·1–9a·3, Q14, Q16, Q18,
 * Q12; words `docs/projects/active/HOUSE_LEAGUE_STAGE9A_COPY.md` §2 and §7).
 *
 * The season's pages (the rail's block, the phone's strip), what is happening in it (the pill on the home, the header and
 * the public rows), which group it sits in on the home, and the order the switcher lists seasons. One home, so the rail,
 * the phone and the home can never call one season two things.
 *
 * Client-safe: no server imports.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type SeasonPageKey = 'overview' | 'registrations' | 'teams' | 'schedule' | 'standings' | 'money' | 'notifications';

/**
 * The season's pages, in the rail's order (9a·2). Money is the old Ledger, renamed (Q18; its old path redirects). "Email
 * families" still opens the season's own composer (the old Notifications page) until 9d switches it over (owner
 * 2026-10-24, plan §0c).
 */
export const SEASON_PAGES: readonly { key: SeasonPageKey; segment: string; label: string }[] = [
  { key: 'overview', segment: '', label: 'Overview' },
  { key: 'registrations', segment: 'registrations', label: 'Registrations' },
  { key: 'teams', segment: 'teams', label: 'Teams & draft' },
  { key: 'schedule', segment: 'schedule', label: 'Schedule' },
  { key: 'standings', segment: 'standings', label: 'Standings' },
  { key: 'money', segment: 'money', label: 'Money' },
  { key: 'notifications', segment: 'notifications', label: 'Email families' },
];

/** The pages this person can open (frame F): a treasurer's is Money alone; Email families needs the people who send it. */
export function seasonPagesFor(access: Pick<HouseLeagueAccess, 'read' | 'readMoney' | 'readEmail'>) {
  return SEASON_PAGES.filter(p => {
    if (p.key === 'money') return access.readMoney;
    if (p.key === 'notifications') return access.read && access.readEmail;
    return access.read;
  });
}

/** The page segment a path inside a season is on ('' = the season's Overview). The old Ledger path reads as Money. */
export function seasonSegment(pathname: string): string {
  const seg = pathname.match(/\/house-league\/seasons\/[^/]+\/([^/?#]+)/)?.[1] ?? '';
  return seg === 'ledger' ? 'money' : seg;
}

/** Which of the season's pages a path is on. */
export function seasonPageAt(pathname: string): SeasonPageKey {
  const seg = seasonSegment(pathname);
  return SEASON_PAGES.find(p => p.segment === seg)?.key ?? 'overview';
}

/** A season page's address. */
export function seasonPageHref(seasonPath: string, segment: string): string {
  return segment ? `${seasonPath}/${segment}` : seasonPath;
}

// ── What is happening (the pill) ───────────────────────────────────────────────────────────────

export type SeasonTone = 'neutral' | 'green' | 'amber';
export type SeasonGroup = 'running' | 'ready' | 'past';

type Dated = {
  status: LeagueSeasonStatus | string;
  seasonStartDate?: string | null;
  seasonEndDate?: string | null;
};

const dayLabel = (value: string, today: string) => formatStoredDate(value, { withYear: !value.startsWith(today.slice(0, 4)) });

/**
 * The pill (copy §2): status decides, and on a running season the club's today against its dates picks the word. Whole
 * days, the end date inclusive; no start date counts as started, no end date as not yet ended.
 */
export function seasonState(season: Dated, today: string = tournamentToday()): { label: string; tone: SeasonTone } {
  switch (season.status) {
    case 'draft': return { label: 'Getting ready', tone: 'neutral' };
    case 'registration_open': return { label: 'Registration open', tone: 'green' };
    case 'registration_closed': return { label: 'Registration closed', tone: 'neutral' };
    case 'completed':
    case 'archived': return { label: 'Finished', tone: 'neutral' };
    default: break;
  }
  const start = season.seasonStartDate?.slice(0, 10) ?? null;
  const end = season.seasonEndDate?.slice(0, 10) ?? null;
  if (start && today < start) return { label: `Starts ${dayLabel(start, today)}`, tone: 'neutral' };
  if (end && today > end) return { label: `Ended ${dayLabel(end, today)}`, tone: 'amber' };
  return { label: 'Playing now', tone: 'green' };
}

/** True when a running season is past its last day and not yet completed (the home's "complete it" line). */
export function isPastItsEnd(season: Dated, today: string = tournamentToday()): boolean {
  const end = season.seasonEndDate?.slice(0, 10) ?? null;
  return season.status === 'active' && !!end && today > end;
}

/** The home's group (9a·1): status alone, never the date. */
export function seasonGroup(season: Pick<Dated, 'status'>): SeasonGroup {
  if (season.status === 'draft') return 'ready';
  if (season.status === 'completed' || season.status === 'archived') return 'past';
  return 'running';
}

/** Newest first: by the season's first day, then by when it was made. */
function newestFirst<T extends Dated & { createdAt?: string | null }>(a: T, b: T): number {
  const ka = a.seasonStartDate ?? a.createdAt ?? '';
  const kb = b.seasonStartDate ?? b.createdAt ?? '';
  return kb.localeCompare(ka);
}

/** The switcher's order (copy §7): live seasons first, newest first; then the finished ones, newest first. */
export function orderSeasons<T extends Dated & { createdAt?: string | null }>(seasons: readonly T[]): T[] {
  const finished = (s: T) => seasonGroup(s) === 'past';
  return [...seasons.filter(s => !finished(s)).sort(newestFirst), ...seasons.filter(finished).sort(newestFirst)];
}

/** The amber count's spoken label on Registrations (copy §7). */
export function toReviewLabel(n: number): string {
  return `${n} ${n === 1 ? 'registration' : 'registrations'} to review`;
}
