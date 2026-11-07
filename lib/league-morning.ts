/**
 * THE LEAGUE ROLES' "THIS MORNING" (Club Tier Stage 13b, A3; F-NAV-6; hub tab 12 "Homes"; owner ruling 2026-11-07: it sits on
 * the SEASON page, where these two people land since 13a, not on the club Overview).
 *
 * What is waiting for this person in this season — their queue, in their words — computed from figures the season page already
 * reads (its counts, its divisions, its Money band: the same `seasonMoney` the band above it shows, so the two never disagree).
 * Pure: the page draws what this returns. A tile with no existing figure for the role is not here.
 *
 *   League admin — To review (oldest date) · Teams (players not on a team). "Club time" is 13d's hand-off, not built here.
 *   Registrar    — To review (oldest date) · Still owing (players, never families) · Waitlist (the division that is full).
 *                  "Find a child or a parent" is 13e's, not built here.
 *
 * ⚖ The registrar's count shows in full ("15", never "9+"). A tile the reader cannot open is absent, not greyed (Still owing
 * needs the season's Money). Live seasons only: a getting-ready or finished season has nothing waiting on the desk.
 */
import { formatStoredDate } from './timezone';
import { formatLeagueMoney } from './league-money';
import { pluralize } from './utils';
import { seasonGroup } from './house-league-season';

export interface LeagueMorningInput {
  role: string | null | undefined;
  /** The season's status; a getting-ready or finished season has no morning. */
  seasonStatus: string;
  seasonId: string;
  summary: { pendingReviewCount: number; oldestPendingAt?: string | null; unplacedCount: number; waitlistCount: number };
  divisions: readonly { name: string; capacity: number | null; heldCount: number; waitlistCount: number }[];
  /** The season's Money band, when the reader may read it and the season charges. */
  money: { owing: number; owingPlayers: number } | null;
  base: string;
}

export interface LeagueMorningTile {
  key: 'review' | 'teams' | 'owing' | 'waitlist';
  label: string;
  figure: string;
  sub: string;
  href: string;
  /** Nothing waiting: the figure is inked quiet, like the Overview's zero cards. */
  quiet?: boolean;
}

export const LEAGUE_MORNING_WORDS = {
  title: 'This morning',
  review: { label: 'To review', nothing: 'nothing waiting', some: (oldest: string | null) => (oldest ? `registrations · oldest ${oldest}` : 'registrations') },
  teams: { label: 'Teams', nothing: 'everyone is on a team', some: (n: number) => `${pluralize(n, 'player')} not on a team` },
  owing: { label: 'Still owing', nothing: 'nobody owes', some: (n: number) => pluralize(n, 'player') },
  waitlist: {
    label: 'Waitlist', nothing: 'nothing waiting', open: 'waiting for a spot',
    full: (division: string) => `${division} is full`, fullMany: (n: number) => `${n} divisions are full`,
  },
} as const;

const W = LEAGUE_MORNING_WORDS;

/** The divisions that are full (every spot held) and have someone waiting. */
function fullWithWaitlist(divisions: LeagueMorningInput['divisions']) {
  return divisions.filter(d => d.waitlistCount > 0 && d.capacity != null && d.capacity > 0 && d.heldCount >= d.capacity);
}

export function leagueMorning(input: LeagueMorningInput): LeagueMorningTile[] {
  const role = input.role;
  if (role !== 'league_admin' && role !== 'league_registrar') return [];
  if (seasonGroup({ status: input.seasonStatus }) !== 'running') return []; // the product's own "live season" rule
  const season = `${input.base}/house-league/seasons/${input.seasonId}`;
  const { summary } = input;

  const review: LeagueMorningTile = {
    key: 'review', label: W.review.label,
    figure: String(summary.pendingReviewCount),
    sub: summary.pendingReviewCount > 0
      ? W.review.some(summary.oldestPendingAt ? formatStoredDate(summary.oldestPendingAt, { withYear: false }) : null)
      : W.review.nothing,
    href: `${season}/registrations?tab=review`,
    quiet: summary.pendingReviewCount === 0,
  };

  if (role === 'league_admin') {
    return [review, {
      key: 'teams', label: W.teams.label,
      figure: String(summary.unplacedCount),
      sub: summary.unplacedCount > 0 ? W.teams.some(summary.unplacedCount) : W.teams.nothing,
      href: `${season}/teams`,
      quiet: summary.unplacedCount === 0,
    }];
  }

  const tiles: LeagueMorningTile[] = [review];
  if (input.money) {
    tiles.push({
      key: 'owing', label: W.owing.label,
      figure: formatLeagueMoney(input.money.owing),
      sub: input.money.owingPlayers > 0 ? W.owing.some(input.money.owingPlayers) : W.owing.nothing,
      href: `${season}/money`,
      quiet: input.money.owing <= 0,
    });
  }
  const full = fullWithWaitlist(input.divisions);
  tiles.push({
    key: 'waitlist', label: W.waitlist.label,
    figure: String(summary.waitlistCount),
    sub: summary.waitlistCount === 0 ? W.waitlist.nothing
      : full.length === 1 ? W.waitlist.full(full[0].name)
        : full.length > 1 ? W.waitlist.fullMany(full.length)
          : W.waitlist.open,
    href: `${season}/registrations?tab=waitlist`,
    quiet: summary.waitlistCount === 0,
  });
  return tiles;
}
