/**
 * lib/coach-team-masthead.ts — SERVER-ONLY. The team's facts for the chrome, read ONCE per request (navigation Phase 4).
 *
 * Two surfaces show them: the phone's team bar (`CoachTeamHeader`, mounted by the team layout — the phone keeps it until
 * Phase 5) and, on a computer, the strip's right end (`CoachStripFacts`, rendered by the coaches layout's `@stripFacts`
 * slot so the strip is right in the server's first paint and follows the coach from team to team). Both call this; React's
 * `cache()` makes the second call free in the same request, and every argument is a primitive so the key holds.
 *
 * The body is the team layout's, moved unchanged (desktop shell D2/A2): the SAME resolution rule the client runs over the
 * SAME two arrays, ONE season's ids, the record and status riding the season's `schedule` capability, the scouting nudge
 * and the bench console fetched in parallel.
 */
import { cache } from 'react';
import { resolveLiveSeason, resolveClosedSeason } from './coach-season-view';
import { isTeamWorkspaceOrg } from './team-workspace-entitlements';
import { getCoachPortalAuth, getCoachPortalAssignments, getCoachPortalClosedAssignments } from './coach-portal-request';
import { getCoachMastheadFeed, EMPTY_MASTHEAD_FEED } from './coach-masthead';
import { getScoutingNudgeForNextGame } from './coach-opponent-nudge';
import { getGameDayConsoleForNextGame } from './coach-game-day-nudge';
import { gameDayConsolePath } from './coach-game-day';
import {
  resolveMastheadStatus, type MastheadGameDayConsole, type MastheadRecord, type MastheadScoutingNudge, type MastheadStatus,
} from './coach-masthead-status';

/** What the chrome draws: the phone bar's props, and the strip's facts. */
export type CoachTeamFacts = {
  orgName: string;
  isTeamWorkspace: boolean;
  records: Record<string, MastheadRecord>;
  status: MastheadStatus;
  scoutingNudge: MastheadScoutingNudge | null;
  gameDayConsole: MastheadGameDayConsole | null;
  /** WHICH season the status describes (a team mid-rollover holds two live seasons). */
  statusYearId: string | null;
};

export type CoachTeamMasthead = {
  /** The team's live season and its newest closed one, from the shared resolvers — the season gate's inputs, decided by
   *  the team layout on the SERVER (CLAUDE.md: a team with no live season has one door). */
  live: ReturnType<typeof resolveLiveSeason>;
  closed: ReturnType<typeof resolveClosedSeason>;
  facts: CoachTeamFacts;
};

export const loadCoachTeamMasthead = cache(async (orgSlug: string, teamId: string): Promise<CoachTeamMasthead | null> => {
  const authCtx = await getCoachPortalAuth(orgSlug);
  if (!authCtx) return null;

  const isTeamWorkspace = isTeamWorkspaceOrg(authCtx.org);
  const [assignments, closedAll] = await Promise.all([
    getCoachPortalAssignments(authCtx.org.id, authCtx.user.id, isTeamWorkspace),
    getCoachPortalClosedAssignments(authCtx.org.id, authCtx.user.id, isTeamWorkspace),
  ]);

  // ⚠ ONE season's ids, not every season's (P2, 2026-08-16): nothing can put another season on screen.
  const closedForTeam = closedAll.filter(a => a.teamId === teamId);
  const live = resolveLiveSeason(assignments, teamId);
  const closed = resolveClosedSeason(assignments, closedForTeam, teamId);
  const workingSeason = live ?? closed;

  // Record + status ride the season's `schedule` capability — the same gate the Overview's own record and next-up tiles
  // ride, so an assistant without it sees identity only.
  const mayReadSchedule = workingSeason?.capabilities?.schedule === true;
  const liveSeason = live && mayReadSchedule ? live : null;

  const feed = workingSeason && mayReadSchedule
    ? await getCoachMastheadFeed({
        yearIds: [workingSeason.programYearId],
        activeYearId: liveSeason?.programYearId ?? null,
      })
    : EMPTY_MASTHEAD_FEED;

  const liveAssignment = liveSeason
    ? assignments.find(a => a.teamId === teamId && a.programYearId === liveSeason.programYearId)
    : null;
  const status = liveAssignment
    ? resolveMastheadStatus({
        programYearStatus: liveAssignment.programYearStatus,
        nextEvent: feed.next,
        hasFinalizedGame: !!feed.records[liveAssignment.programYearId],
      })
    : null;

  // Two independent quiet additions, fetched IN PARALLEL — game day is this path's busiest day, so they must not queue.
  const [nudge, console_] = await Promise.all([
    status ? getScoutingNudgeForNextGame(teamId, feed.next) : Promise.resolve(null),
    status?.kind === 'game_day' ? getGameDayConsoleForNextGame(feed.next) : Promise.resolve(null),
  ]);
  return {
    live,
    closed,
    facts: {
      orgName: authCtx.org.name,
      isTeamWorkspace,
      records: feed.records,
      status,
      scoutingNudge: nudge && { ...nudge, href: `/${orgSlug}/coaches/teams/${teamId}/schedule?event=${nudge.eventId}&tab=scouting` },
      gameDayConsole: console_ && { ...console_, href: gameDayConsolePath(orgSlug, teamId, console_.eventId) },
      statusYearId: liveAssignment?.programYearId ?? null,
    },
  };
});
