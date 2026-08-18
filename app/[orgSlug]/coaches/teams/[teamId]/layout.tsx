import { resolveLiveSeason, resolveClosedSeason } from '@/lib/coach-season-view';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import {
  getCoachPortalAuth,
  getCoachPortalAssignments,
  getCoachPortalClosedAssignments,
  getCoachPortalPublicHref,
} from '@/lib/coach-portal-request';
import { getCoachMastheadFeed, EMPTY_MASTHEAD_FEED } from '@/lib/coach-masthead';
import { getScoutingNudgeForNextGame } from '@/lib/coach-opponent-nudge';
import { getGameDayConsoleForNextGame } from '@/lib/coach-game-day-nudge';
import { gameDayConsolePath } from '@/lib/coach-game-day';
import {
  resolveMastheadStatus, type MastheadGameDayConsole, type MastheadScoutingNudge,
} from '@/lib/coach-masthead-status';
import CoachTeamHeader from '@/components/coaches/CoachTeamHeader';
import CoachTeamSeasonGate from '@/components/coaches/CoachTeamSeasonGate';

/**
 * The team segment's layout — it exists for ONE reason: the pinned masthead (desktop shell D2/A2).
 *
 * WHY HERE AND NOT IN THE PORTAL LAYOUT. This is the first place `teamId` exists server-side, so
 * it is the only place the masthead's numbers can ride down WITH the page instead of being fetched
 * after paint. A segment layout is not re-rendered when the coach moves between pages inside the
 * team, so the feed is read once per team entry and every page after the first costs nothing.
 *
 * ⚠ It renders a FRAGMENT. The masthead must stay a direct child of `.coachesMain` — its sticky
 * pin and its negative margins (which cancel the container's padding) are measured against that
 * container, and a wrapper element here would silently break both.
 *
 * ⚠ It NEVER gates access. The portal layout above already handled auth, and each page owns its own
 * "not assigned" wall; a redirect from here would fight them. Anything unresolvable simply renders
 * the children with no masthead.
 */
export default async function CoachTeamLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug, teamId } = await params;
  const authCtx = await getCoachPortalAuth(orgSlug);
  if (!authCtx) return <>{children}</>;

  const isTeamWorkspace = isTeamWorkspaceOrg(authCtx.org);
  const [assignments, closedAll, publicHref] = await Promise.all([
    getCoachPortalAssignments(authCtx.org.id, authCtx.user.id, isTeamWorkspace),
    getCoachPortalClosedAssignments(authCtx.org.id, authCtx.user.id, isTeamWorkspace),
    isTeamWorkspace ? Promise.resolve(null) : getCoachPortalPublicHref(authCtx.org),
  ]);

  // The SAME resolution rule the client runs (`resolveWorkingSeason`) over the SAME two arrays, so
  // the season this feed is built for can never be a different one from the season on screen.
  //
  // ⚠ ONE season's ids, not every season's (P2, 2026-08-16). This used to build the record map for
  // EVERY season the coach held on the team, because the season switcher could put any of them on
  // screen. Nothing can any more, so the extra years were a per-team-entry read whose answers no
  // surface could ever ask for.
  const closedForTeam = closedAll.filter(a => a.teamId === teamId);
  const live = resolveLiveSeason(assignments, teamId);
  const closed = resolveClosedSeason(assignments, closedForTeam, teamId);
  const workingSeason = live ?? closed;

  // Record + status ride the season's `schedule` capability — the same gate the Overview's own
  // record and next-up tiles ride (their events fetch is schedule-gated), so an assistant without
  // it sees identity only here, exactly as they do one screen down.
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

  // Two independent quiet additions to the masthead, fetched IN PARALLEL — this is the
  // busiest day for this code path (an actual game), so their reads must not queue.
  //  · Game-week scouting nudge (Scouting Book P2): only when the masthead is already talking
  //    about a live season's game — the nudge can never outlive the status that justifies it.
  //  · Game-Day Mode (P1): on game day, the status line itself links to the bench console —
  //    but only inside the game's live window (the feature module owns that clock).
  const [nudge, console_] = await Promise.all([
    status ? getScoutingNudgeForNextGame(teamId, feed.next) : Promise.resolve(null),
    status?.kind === 'game_day' ? getGameDayConsoleForNextGame(feed.next) : Promise.resolve(null),
  ]);
  const scoutingNudge: MastheadScoutingNudge | null = nudge && {
    ...nudge,
    href: `/${orgSlug}/coaches/teams/${teamId}/schedule?event=${nudge.eventId}&tab=scouting`,
  };
  const gameDayConsole: MastheadGameDayConsole | null = console_ && {
    ...console_,
    href: gameDayConsolePath(orgSlug, teamId, console_.eventId),
  };

  return (
    <>
      <CoachTeamHeader
        teamId={teamId}
        orgName={authCtx.org.name}
        isTeamWorkspace={isTeamWorkspace}
        publicHref={publicHref}
        records={feed.records}
        status={status}
        scoutingNudge={scoutingNudge}
        gameDayConsole={gameDayConsole}
        // ⚠ WHICH season the status describes. Server and client now resolve the working season
        // from the same two arrays by the same rule, so they agree by construction — and this
        // prop is what makes "by construction" checkable rather than assumed. A team mid-rollover
        // holds two live seasons at once; if the two ever picked differently, the header would
        // rather say nothing than put one season's game day beside another's year and record.
        statusYearId={liveAssignment?.programYearId ?? null}
      />
      {/* ⚠⚠ **THE ONE PLACE A FINISHED SEASON IS ANSWERED** (2026-08-18). A team with no live season
          has one page, so the live tools are not rendered at all rather than rendered read-only —
          which is what deleted the seventeen read-only branches and twelve "comes back next season"
          notices that used to say it screen by screen. The decision is made HERE, on the server,
          from the two lookups the masthead already needed, so no live page paints against a closed
          season for even a frame.

          ⚠ This layout's docblock says it never gates access, and that is STILL TRUE: "you are not
          on this team" is a different sentence with a different cause, and every page still owns
          it. This says only which season the team is on. */}
      <CoachTeamSeasonGate
        seasonFinished={!live && !!closed}
        closedHref={`/${orgSlug}/coaches/teams/${teamId}/season-end`}
        teamBase={`/${orgSlug}/coaches/teams/${teamId}`}
      >
        {children}
      </CoachTeamSeasonGate>
    </>
  );
}
