import type { FollowFeedEntry, FollowFeedGroup } from './follow-feed';
import type { UserAccessContext, LapsedWorkspace } from './user-contexts';

/**
 * lib/home-following.ts — PURE (client-safe) presentation layer over the Following
 * feed, for the Unified Home redesign. It has NO server-only dependency, so both the
 * server (/api/consumer/home) and the client (Home + All-following, signed-out device
 * follows) can import it — the type-only import from follow-feed.ts is erased at
 * runtime, so the server-only guard on that module never runs in the client bundle.
 *
 * Two jobs:
 *  1. followStatusText — the one compact status vocabulary for a feed entry (moved
 *     here from follow-feed.ts so it's reachable from client code; follow-feed.ts
 *     re-exports it for existing server callers).
 *  2. rollupFollowFeedByTournament — the two-tier follow model's tournament-first
 *     rollup: many followed teams in one tournament collapse to ONE card, and
 *     finished events fall into a "Past" group (Round 1 spec).
 */

/** One-line status text for a feed entry — the single status vocabulary shared by Home's
 *  Following cards and the All-following list rows. */
export function followStatusText(entry: FollowFeedEntry): { text: string; live: boolean } {
  const score =
    entry.myScore !== null && entry.oppScore !== null
      ? `${entry.myScore}–${entry.oppScore}`
      : null;
  switch (entry.group) {
    case 'live':
      return { text: score ? `${score} · Live` : 'Live now', live: true };
    case 'upcoming': {
      const when = [entry.dateLabel, entry.timeLabel].filter(Boolean).join(' · ');
      return { text: when || 'Upcoming', live: false };
    }
    case 'recent': {
      const label = entry.isFinal ? 'Final' : 'Unofficial';
      return { text: score ? `${score} · ${label}` : label, live: false };
    }
    default:
      return { text: 'No games yet', live: false };
  }
}

/** Priority for choosing a tournament card's representative status and ordering:
 *  live floats first, then upcoming, then not-yet-scheduled, then finished (→ Past).
 *  The one client-safe rank map — the All-following list imports it too rather than
 *  re-declaring (the server-only follow-feed module can't be reached from client code).
 *  NB: deliberately distinct from follow-feed's FOLLOW_FEED_GROUP_ORDER, which sinks
 *  'none' below 'recent' for a different (server feed) purpose. */
export const GROUP_RANK: Record<FollowFeedGroup, number> = {
  live: 0,
  upcoming: 1,
  none: 2,
  recent: 3,
};

export interface TournamentFollowCard {
  /** `${orgSlug}/${tournamentSlug}` — stable React key + dedupe key. */
  key: string;
  orgSlug: string;
  tournamentSlug: string;
  tournamentName: string;
  /** Tournament HOME page (R1-2: tapping a followed-tournament card lands here, not a game). */
  href: string;
  /** Distinct followed-team names in this tournament, in feed order. Empty for a whole-event follow. */
  teamNames: string[];
  /** Best status across the tournament's followed teams (live wins). */
  status: { text: string; live: boolean };
  /** Representative group — drives current-vs-Past bucketing + ordering. */
  group: FollowFeedGroup;
  /** F2/F6: this card is a WHOLE-event follow (no team line) — a fan following the event, not a
   *  roster. A team follow in the same tournament wins the card (team context beats whole-event). */
  wholeEvent?: boolean;
}

/** F2: one organization the fan follows — the year-round relationship. Persists on Home even
 *  off-season (org cards never drop). ONE context line, priority live → today → next-event →
 *  quiet off-season. Pure shape; the server (entity-follow-status.ts) computes the context. */
export interface OrgFollowCard {
  /** `${orgSlug}` — stable key + dedupe key. */
  key: string;
  orgSlug: string;
  orgName: string;
  /** The org landing page (self-routes to its one live event when exactly one is on). */
  href: string;
  logoUrl: string | null;
  context: { text: string; live: boolean; offSeason: boolean };
}

/**
 * Collapse a per-team follow feed into tournament-first cards (two-tier follow model):
 *  - one card per (org, tournament), listing every followed team in it;
 *  - representative status = the most-relevant team game (live > upcoming > unscheduled > finished);
 *  - `current` = tournaments with anything live/upcoming/unscheduled; `past` = every followed
 *    team's event has finished (all `recent`) — these collapse into Home's "Past" group.
 */
export function rollupFollowFeedByTournament(entries: FollowFeedEntry[]): {
  current: TournamentFollowCard[];
  past: TournamentFollowCard[];
} {
  const byTournament = new Map<string, FollowFeedEntry[]>();
  for (const entry of entries) {
    const key = `${entry.orgSlug}/${entry.tournamentSlug}`;
    const list = byTournament.get(key);
    if (list) list.push(entry);
    else byTournament.set(key, [entry]);
  }

  const cards: TournamentFollowCard[] = [];
  for (const [key, list] of byTournament) {
    const rep = list.reduce(
      (best, e) => (GROUP_RANK[e.group] < GROUP_RANK[best.group] ? e : best),
      list[0],
    );
    cards.push({
      key,
      orgSlug: rep.orgSlug,
      tournamentSlug: rep.tournamentSlug,
      tournamentName: rep.tournamentName,
      href: `/${rep.orgSlug}/${rep.tournamentSlug}`,
      teamNames: Array.from(new Set(list.map(e => e.teamName))),
      status: followStatusText(rep),
      group: rep.group,
    });
  }

  const current = cards
    .filter(c => c.group !== 'recent')
    .sort((a, b) => GROUP_RANK[a.group] - GROUP_RANK[b.group]);
  const past = cards.filter(c => c.group === 'recent');
  return { current, past };
}

/**
 * F6 merge rule (the single source of the Phase-6 "team follow wins the card" business rule):
 * fold whole-event follow cards into a tournament-first team rollup, dropping any whose tournament
 * is already covered by a team follow (team context beats a bare whole-event follow), then
 * re-sort `current` live-first by GROUP_RANK. Pure — shared by the server (/api/consumer/home) and
 * the client (signed-out Home) so the rule can never drift between them.
 */
export function mergeWholeEventIntoRollup(
  teamRollup: { current: TournamentFollowCard[]; past: TournamentFollowCard[] },
  wholeEventCards: TournamentFollowCard[],
): { current: TournamentFollowCard[]; past: TournamentFollowCard[] } {
  const teamKeys = new Set([...teamRollup.current, ...teamRollup.past].map(c => c.key));
  const wholeEvent = wholeEventCards.filter(c => !teamKeys.has(c.key));
  return {
    current: [...teamRollup.current, ...wholeEvent.filter(c => c.group !== 'recent')]
      .sort((a, b) => GROUP_RANK[a.group] - GROUP_RANK[b.group]),
    past: [...teamRollup.past, ...wholeEvent.filter(c => c.group === 'recent')],
  };
}

/* ── /api/consumer/home payload (shared server↔client contract) ───────────────── */

export interface ConsumerHomePendingInvite {
  memberId: string;
  orgSlug: string | null;
  orgName: string | null;
  role: string;
}

export interface ConsumerHomePayload {
  signedIn: boolean;
  pendingInvites: ConsumerHomePendingInvite[];
  /** Non-fan access contexts (org admin / official / coach) — the Workspaces section. */
  workspaces: UserAccessContext[];
  /** Lapsed-subscription workspaces surfaced as explicit "reactivate" cards (never silent omission). */
  lapsed: LapsedWorkspace[];
  /** Raw count of teams followed (post coach-dedupe), independent of feed-enrichment success — lets
   *  the client tell "follows nothing" from "follows teams whose game info is momentarily unavailable". */
  followCount: number;
  /** Tournament-first follow cards, split into current + past. Includes whole-event follows
   *  (F2, `wholeEvent` flag) merged in and deduped against team follows (team wins, F6). */
  following: { current: TournamentFollowCard[]; past: TournamentFollowCard[] };
  /** F2: followed organizations (below Following·Tournaments). Persists off-season. */
  organizations: OrgFollowCard[];
}
