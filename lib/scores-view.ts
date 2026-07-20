/**
 * lib/scores-view.ts — PURE (client-safe) contract + view helpers for the Unified Home
 * Scores tab (Phase 3). No server-only dependency, so both the server resolver
 * (lib/scores-feed.ts → /api/consumer/scores) and the client (ScoresClient, signed-out
 * device follows) import it — same split as lib/home-following.ts vs lib/follow-feed.ts.
 *
 * Two jobs:
 *  1. The shared payload contract (ScoresEvent / ScoresGameRow / ScoresPayload) + the
 *     reason-chip vocabulary and its precedence (membership wins over Following).
 *  2. Pure view assembly for the My Games lane: bucket rows into Live / upcoming day
 *     groups / past day groups, in the binding order (Live pinned first, then Today →
 *     later, then Yesterday backward), so the component stays declarative.
 */
import { daysBetweenDateStrings } from './timezone';

/** Why an entity is on your Scores tab. Precedence: a membership chip always beats a
 *  fan Following chip (a coach sees their team without following it). */
export type ScoresReason = 'coach' | 'staff' | 'official' | 'following';

export const REASON_LABEL: Record<ScoresReason, string> = {
  coach: 'Coach',
  staff: 'Staff',
  official: 'Official',
  following: 'Following',
};

/** Lower = stronger. Memberships (coach/staff/official) all beat Following; among
 *  memberships "your team is here" (coach) reads as the most personal relationship. */
export const REASON_RANK: Record<ScoresReason, number> = {
  coach: 0,
  staff: 1,
  official: 2,
  following: 3,
};

/** The stronger (lower-rank) of two reasons — used to collapse a tournament reachable
 *  via several relationships to one chip. */
export function strongerReason(a: ScoresReason, b: ScoresReason): ScoresReason {
  return REASON_RANK[a] <= REASON_RANK[b] ? a : b;
}

/** A single team-game row in the My Games lane (member/followed teams only). */
export interface ScoresGameRow {
  /** `${teamId}:${gameId}` — stable React key (one game can surface under two of your teams). */
  key: string;
  gameId: string;
  teamId: string;
  teamName: string;
  opponentName: string | null;
  orgSlug: string;
  tournamentSlug: string;
  tournamentName: string;
  /** Game-detail deep-link. */
  href: string;
  state: 'live' | 'unofficial' | 'final' | 'upcoming';
  live: boolean;
  myScore: number | null;
  oppScore: number | null;
  /** Tournament-local calendar date (YYYY-MM-DD) — the day-bucket key. */
  date: string;
  /** 0 = today, 1 = tomorrow, -1 = yesterday (tournament-local calendar days). */
  dayOffset: number;
  /** "Today" / "Tomorrow" / "Jul 18" — the day-group header label. */
  dayLabel: string;
  /** Local start time ("6:00 PM"); null for live/finished rows. */
  timeLabel: string | null;
  location: string | null;
  reason: ScoresReason;
  /** Scheduled start (ms) for stable in-day ordering. */
  sortMs: number;
}

/** A compact event tile in the My Events grid (one per followed/member tournament). */
export interface ScoresEvent {
  /** `${orgSlug}/${tournamentSlug}` — stable key + dedupe key. */
  key: string;
  orgSlug: string;
  tournamentSlug: string;
  name: string;
  /** The event's own schedule page (tap target — never expands inline). */
  href: string;
  logoUrl: string | null;
  reason: ScoresReason;
  group: 'live' | 'upcoming' | 'completed';
  /** The ONE status fragment: "● 3 live" / "12 today" / "Next: Sat 10 AM" / "Completed · Jul 12". */
  fragment: string;
  liveCount: number;
  /** Ordering key: group rank first, then time within the group. */
  sortMs: number;
}

/** F4: ONE rollup tile per followed organization in the My Events grid (round monogram +
 *  Following chip + one mono fragment; tap → the org page). Present only while the org has
 *  something live/upcoming/≤1-week-completed — Home holds the durable off-season card. */
export interface ScoresOrgTile {
  /** `org:${orgSlug}` — stable key, namespaced so it can't collide with a ScoresEvent key. */
  key: string;
  orgSlug: string;
  orgName: string;
  /** The org landing page (self-routes to its one live event when exactly one is on). */
  href: string;
  logoUrl: string | null;
  /** The ONE mono rollup fragment ("Live now · {event}" / "Today · {event}" / "Next · {event} · {dates}"). */
  fragment: string;
  live: boolean;
}

export interface ScoresPayload {
  signedIn: boolean;
  /** Tournament-local "today" the rows were bucketed against (YYYY-MM-DD). */
  today: string;
  events: ScoresEvent[];
  games: ScoresGameRow[];
  /** F4: followed-org rollup tiles (additive — the shipped ScoresEvent contract is untouched). */
  orgTiles: ScoresOrgTile[];
  /** Live My-Games rows — the number on the [Live •N] filter pill. */
  liveCount: number;
}

/** Whole calendar days from `today` to `date`, both `YYYY-MM-DD` and both already in
 *  tournament-local time (game.date is stored wall-clock), so this is pure date math —
 *  no timezone needed here (the tz correctness lives in lib/timezone on the server).
 *  Delegates to the shared date-string primitive so the diff formula lives in one place. */
export function dayOffset(date: string, today: string): number {
  return daysBetweenDateStrings(today, date);
}

export interface ScoresDayGroup {
  /** The group's date (YYYY-MM-DD). */
  date: string;
  label: string;
  dayOffset: number;
  rows: ScoresGameRow[];
}

/** Initial My-Games window (design R2-1): live + today + next 3 days + last 7 days.
 *  Everything else hides behind the "Show later" / "Show earlier" ghost buttons. */
export const FUTURE_WINDOW_DAYS = 3;
export const PAST_WINDOW_DAYS = 7;

/**
 * Assemble the My Games lane from flat rows:
 *  - `live`  = every live row, earliest first — pinned above all day groups;
 *  - `upcoming` = non-live rows dated today or later, grouped by day, days ascending;
 *  - `past`  = non-live rows before today, grouped by day, most-recent day first.
 * Each day group carries its `dayOffset` so the component can split the initial window
 * from the "show more" overflow without re-deriving dates.
 */
export function buildScoresView(games: ScoresGameRow[]): {
  live: ScoresGameRow[];
  upcoming: ScoresDayGroup[];
  past: ScoresDayGroup[];
} {
  const live: ScoresGameRow[] = [];
  const byDay = new Map<string, ScoresGameRow[]>();
  for (const g of games) {
    if (g.live) { live.push(g); continue; }
    const list = byDay.get(g.date);
    if (list) list.push(g);
    else byDay.set(g.date, [g]);
  }
  live.sort((a, b) => a.sortMs - b.sortMs);

  const groups: ScoresDayGroup[] = [];
  for (const [date, rows] of byDay) {
    rows.sort((a, b) => a.sortMs - b.sortMs);
    groups.push({ date, label: rows[0].dayLabel, dayOffset: rows[0].dayOffset, rows });
  }

  const upcoming = groups
    .filter(g => g.dayOffset >= 0)
    .sort((a, b) => a.dayOffset - b.dayOffset); // today → later
  const past = groups
    .filter(g => g.dayOffset < 0)
    .sort((a, b) => b.dayOffset - a.dayOffset); // yesterday → older
  return { live, upcoming, past };
}
