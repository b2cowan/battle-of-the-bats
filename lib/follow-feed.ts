import 'server-only';
import { getPublicTournamentPageData } from './public-tournament-data';
import { selectTeamGames, publicGameStatus, DEFAULT_GAME_DURATION_MINUTES, opponentNameFor, teamScoreFor } from './game-status';
import { tournamentToday } from './timezone';
import { formatTime, relativeDayLabel } from './utils';

/**
 * lib/follow-feed.ts — server-side read layer that turns a flat list of
 * followed teams (account-linked or device-local, doesn't matter which) into
 * the Following tab's game-day feed (unified-app Phase 2 Slice 2). One
 * fetch per unique tournament, shared across every followed team in it, using
 * the same public data resolver the Schedule page already uses — so a
 * followed team's tournament being unpublished/canceled/removed drops it out
 * cleanly (no dead rows) exactly like the rest of the public surfaces.
 */

export type FollowFeedGroup = 'live' | 'upcoming' | 'recent' | 'none';

/** Canonical display order for feed groups (live floats first). NB: FollowFeed.tsx's
 *  GROUPS array encodes the same order with per-group labels — keep them in step. */
export const FOLLOW_FEED_GROUP_ORDER: Record<FollowFeedGroup, number> = {
  live: 0,
  upcoming: 1,
  recent: 2,
  none: 3,
};

// followStatusText now lives in the PURE lib/home-following.ts so client surfaces can
// use it too; re-exported here for existing server callers of this module.
export { followStatusText } from './home-following';

export interface FollowFeedEntry {
  teamId: string;
  teamName: string;
  orgSlug: string;
  tournamentSlug: string;
  tournamentName: string;
  href: string;
  group: FollowFeedGroup;
  opponentName: string | null;
  myScore: number | null;
  oppScore: number | null;
  /** 'recent' only — false means the score is submitted but not yet organizer-finalized. */
  isFinal: boolean;
  dateLabel: string | null;
  timeLabel: string | null;
  location: string | null;
}

export interface FollowFeedInput {
  teamId: string;
  /** Fallback label if the team can't be resolved from the tournament's public team list. */
  teamName: string;
  orgSlug: string;
  tournamentSlug: string;
}

const tournamentKey = (orgSlug: string, tournamentSlug: string) => `${orgSlug}/${tournamentSlug}`;

/** Resolve the enriched Following feed for a set of followed teams, deduped
 *  by (org, tournament, team) and batched to one data fetch per tournament. */
export async function getFollowFeed(entries: FollowFeedInput[]): Promise<FollowFeedEntry[]> {
  const seen = new Set<string>();
  const deduped = entries.filter(e => {
    const key = `${tournamentKey(e.orgSlug, e.tournamentSlug)}/${e.teamId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (deduped.length === 0) return [];

  const uniqueTournaments = Array.from(new Set(deduped.map(e => tournamentKey(e.orgSlug, e.tournamentSlug))));
  const tournamentResults = await Promise.allSettled(
    uniqueTournaments.map(async key => {
      const [orgSlug, tournamentSlug] = key.split('/');
      const data = await getPublicTournamentPageData(orgSlug, tournamentSlug, 'schedule');
      return [key, data] as const;
    }),
  );
  // One tournament's fetch failing (DB hiccup, etc.) shouldn't blank a fan's
  // whole feed — drop just that tournament's followed teams, same as the
  // "org canceled / tournament removed" clean-drop path below.
  const dataByTournament = new Map(
    tournamentResults
      .filter((r): r is PromiseFulfilledResult<readonly [string, Awaited<ReturnType<typeof getPublicTournamentPageData>>]> => r.status === 'fulfilled')
      .map(r => r.value),
  );

  const today = tournamentToday();
  const out: FollowFeedEntry[] = [];

  for (const entry of deduped) {
    const data = dataByTournament.get(tournamentKey(entry.orgSlug, entry.tournamentSlug));
    // Org canceled or tournament no longer public/found — drop the row entirely.
    if (!data || !data.tournament) continue;

    const teamName = data.teams.find(t => t.id === entry.teamId)?.name ?? entry.teamName;
    const base = {
      teamId: entry.teamId,
      teamName,
      orgSlug: entry.orgSlug,
      tournamentSlug: entry.tournamentSlug,
      tournamentName: data.tournament.name,
    };
    const tournamentHref = `/${entry.orgSlug}/${entry.tournamentSlug}`;
    const gameHref = (gameId: string) => `${tournamentHref}/schedule/${gameId}`;

    const { live, next, lastResult } = selectTeamGames(data.games, entry.teamId, today);

    if (live) {
      const s = teamScoreFor(live, entry.teamId);
      out.push({
        ...base,
        group: 'live',
        href: gameHref(live.id),
        opponentName: opponentNameFor(live, entry.teamId, data.teams),
        myScore: s.my,
        oppScore: s.opp,
        isFinal: false,
        dateLabel: null,
        timeLabel: null,
        location: live.location || null,
      });
    } else if (next) {
      out.push({
        ...base,
        group: 'upcoming',
        href: gameHref(next.id),
        opponentName: opponentNameFor(next, entry.teamId, data.teams),
        myScore: null,
        oppScore: null,
        isFinal: false,
        dateLabel: relativeDayLabel(next.date, today),
        timeLabel: next.time ? formatTime(next.time) : null,
        location: next.location || null,
      });
    } else if (lastResult) {
      const s = teamScoreFor(lastResult, entry.teamId);
      const state = publicGameStatus(
        lastResult,
        lastResult.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES,
        // Fail toward "Unofficial" on an unknown value, matching every other
        // consumer of this field (StandingsContent, ScheduleContent, the
        // game-detail page) — this branch is unreachable today since the org
        // is always resolved in this codepath, but keep the polarity aligned.
        data.organization.requireScoreFinalization ?? true,
      );
      out.push({
        ...base,
        group: 'recent',
        href: gameHref(lastResult.id),
        opponentName: opponentNameFor(lastResult, entry.teamId, data.teams),
        myScore: s.my,
        oppScore: s.opp,
        isFinal: state !== 'unofficial',
        dateLabel: null,
        timeLabel: null,
        location: null,
      });
    } else {
      out.push({
        ...base,
        group: 'none',
        href: tournamentHref,
        opponentName: null,
        myScore: null,
        oppScore: null,
        isFinal: false,
        dateLabel: null,
        timeLabel: null,
        location: null,
      });
    }
  }

  return out;
}
