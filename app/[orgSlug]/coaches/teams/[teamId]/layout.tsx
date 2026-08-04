import { resolveSeasonView, buildCoachSeasons } from '@/lib/coach-season-view';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import {
  getCoachPortalAuth,
  getCoachPortalAssignments,
  getCoachPortalClosedAssignments,
  getCoachPortalPublicHref,
} from '@/lib/coach-portal-request';
import { getCoachMastheadFeed, EMPTY_MASTHEAD_FEED } from '@/lib/coach-masthead';
import { getScoutingNudgeForNextGame } from '@/lib/coach-opponent-nudge';
import { resolveMastheadStatus, type MastheadScoutingNudge } from '@/lib/coach-masthead-status';
import CoachTeamHeader from '@/components/coaches/CoachTeamHeader';

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

  // Same list, same shape and the SAME selection rule the client uses (`resolveSeasonView`), so the
  // season this feed is built for can never be a different one from the season on screen.
  const seasons = buildCoachSeasons(assignments, closedAll);
  const teamSeasons = seasons.filter(s => s.teamId === teamId);
  const defaultSeason = resolveSeasonView(seasons, teamId, null).current;

  // Record + status ride the season's `schedule` capability — the same gate the Overview's own
  // record and next-up tiles ride (their events fetch is schedule-gated), so an assistant without
  // it sees identity only here, exactly as they do one screen down. For a past season the grant
  // comes from THAT season's assignment row (Chunk F governing rule 1), never today's.
  const yearIds = teamSeasons.filter(s => s.capabilities?.schedule).map(s => s.programYearId);
  const liveSeason = defaultSeason?.status === 'live' && defaultSeason.capabilities?.schedule
    ? defaultSeason
    : null;

  const feed = yearIds.length
    ? await getCoachMastheadFeed({ yearIds, activeYearId: liveSeason?.programYearId ?? null })
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

  // Game-week scouting nudge (Scouting Book P2): only when the masthead is already talking
  // about a live season's game — the nudge can never outlive the status that justifies it.
  let scoutingNudge: MastheadScoutingNudge | null = null;
  if (status) {
    const nudge = await getScoutingNudgeForNextGame(teamId, feed.next);
    if (nudge) {
      scoutingNudge = {
        ...nudge,
        href: `/${orgSlug}/coaches/teams/${teamId}/schedule?event=${nudge.eventId}&tab=scouting`,
      };
    }
  }

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
        // ⚠ WHICH season the status describes. A layout cannot read `?year=`, so this feed is
        // always built for the DEFAULT season — while the client resolves the season on screen
        // from the URL. A team mid-rollover can hold two live seasons at once, and a hand-typed
        // `?year=` at the other one would otherwise show THAT season's year and record beside
        // THIS season's game day. The client renders the status only when the two agree.
        statusYearId={liveAssignment?.programYearId ?? null}
      />
      {children}
    </>
  );
}
