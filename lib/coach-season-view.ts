/**
 * Which season is on screen — the pure half of the coach portal's page chrome.
 *
 * Deliberately NOT in `coaches-context.tsx`: this is what every page's season reasoning reduces to,
 * so it lives where it can be unit-tested without React. The context re-exports it for consumers.
 *
 * ⚠⚠ **A SEASON IS FULLY LIVE UNTIL IT IS CLOSED, AND A CLOSED SEASON IS ONE PAGE** (owner ruling
 * 2026-08-18, COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN). This file used to answer a THIRD question —
 * "is the season on screen read-only?" — because a team between seasons rendered its whole portal
 * as a past-tense copy of itself: seventeen screens carrying a finished-season branch and twelve
 * explaining they would be back next year. All twenty-nine are deleted, and `isReadOnly` with them.
 *
 * The model now has exactly two states, and this module is where the difference is decided:
 *   · **Live** — the team has a draft/active season. The full portal, unchanged, for as long as
 *     the coach needs it. The last game does not end the season.
 *   · **Closed** — the team has no live season. Its portal is ONE PAGE (`/season-end`), reachable
 *     for ever, and the live tools are not rendered at all rather than rendered read-only.
 *
 * ⚠ **THE SEASON, NEVER THE TEAM.** A team rolled forward into a new year is never itself "closed",
 * and a team whose season has ended is not a team the coach has lost. The plan of record had this
 * backwards once; keying off the team's state would make a rolled-forward team's finished season
 * behave like a closed one.
 *
 * ⚠ **AND THERE IS STILL NO SEASON DIAL** (Design A, owner ruling 2026-08-16). The season SWITCHER
 * this file once held — a per-team option list, a `?year=` encoder, and the rule for where switching
 * lands — is gone and stays gone. What a page renders is the team's live season; looking back is
 * the closed-season page, reached from the nav when there is no live season and from the compare
 * list at any time.
 */
import type { CoachCapabilities } from './coach-capabilities';
import type { CoachingAssignment, ClosedCoachingAssignment } from './db';

/**
 * The team's LIVE season, resolved from the assignments the shell already holds. Null when the team
 * has none — which is an ordinary state (the season has been closed, or the club has not staffed
 * next season yet), not a lock-out and not "you are not on this team".
 */
export interface CoachLiveSeason {
  teamId: string;
  programYearId: string;
  programYearName: string;
  programYearYear: number | null;
  teamName: string;
  teamSport: string;
  coachRole: 'head_coach' | 'assistant_coach';
  capabilities: CoachCapabilities;
}

export function resolveLiveSeason(
  assignments: CoachingAssignment[],
  teamId: string | null | undefined,
): CoachLiveSeason | null {
  if (!teamId) return null;
  /**
   * ⚠ NEWEST live season, not the first one the lookup happened to return —
   * `getCoachingAssignmentsForUser` has no ORDER BY, so arrival order is arbitrary and must not
   * decide this. A team can hold a draft AND an active year at once, mid-rollover.
   *
   * ⚠⚠ **THIS TIE-BREAK IS NOT THE SERVER'S** (`/review` 2026-08-16, recorded rather than papered
   * over). Here it is the highest `year`; the API routes resolve through `resolveWorkingProgramYear`
   * → `getActiveRepProgramYear`, which takes the most recently CREATED row. In every rollover the
   * product itself performs, the new year is both later-created and higher-numbered, so the two
   * agree — they would diverge only if someone minted a lower-numbered year AFTER a higher one (an
   * admin correcting a mis-entered season, say), and then the masthead would name one season while
   * the data came from another. A NARROW pre-existing divergence, logged as a follow-up in
   * COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md rather than left as a comment claiming they match.
   */
  const live = assignments
    .filter(a => a.teamId === teamId)
    .sort((a, b) => (b.programYearYear ?? 0) - (a.programYearYear ?? 0))[0];
  if (!live) return null;
  return {
    teamId,
    programYearId: live.programYearId,
    programYearName: live.programYearName,
    programYearYear: live.programYearYear,
    teamName: live.teamName,
    teamSport: live.teamSport,
    coachRole: live.coachRole,
    capabilities: live.capabilities,
  };
}

/**
 * The team's newest CLOSED season — the one page a coach reads when the team has no live season.
 *
 * ⚠ Answers null the moment the team has a live season, deliberately. This is "where does this team
 * live right now?", not "has this team ever finished a season" — a rolled-forward team's closed
 * years are reached by NAME from the compare list, never by falling back to the newest one.
 * (`closedAssignments` arrives deduped to one row per team, newest first.)
 */
export function resolveClosedSeason(
  assignments: CoachingAssignment[],
  closedAssignments: ClosedCoachingAssignment[],
  teamId: string | null | undefined,
): ClosedCoachingAssignment | null {
  if (!teamId) return null;
  if (assignments.some(a => a.teamId === teamId)) return null;
  return closedAssignments.find(a => a.teamId === teamId) ?? null;
}

/**
 * Everything a section PAGE needs about the season it is rendering.
 *
 * ⚠ `isReadOnly` and `canWrite` are GONE (2026-08-18). Every live page renders a LIVE season or is
 * not reached at all — `CoachTeamSeasonGate` sends a coach whose team has no live season to the one
 * page before any of them mount. A capability check is now just a capability check.
 *
 * ⚠ `query` and `everHeadCoach` went earlier (P2, 2026-08-16). The first carried `?year=` onto every
 * link and fetch and had nothing left to carry; the second gated the team's own season-by-season
 * scrapbook to the head coach, a floor set while an ex-coach could still read everything.
 */
export interface CoachSeasonPage {
  /** The live season, or null while assignments load / the team is between seasons. */
  season: CoachLiveSeason | null;
  capabilities: CoachCapabilities | undefined;
  teamName: string;
  teamSport: string | undefined;
  programYearName: string;
  /** `/{org}/coaches/teams/{teamId}` — the base every in-team link is built from. */
  teamBase: string;
  /**
   * This coach has a LIVE season on this team. False ⇒ the page does not render its instrument.
   *
   * ⚠ It no longer means "is on this team's staff": a coach between seasons is still staff, and
   * `closedSeason` below is how that state is told apart from a genuine stranger.
   */
  hasAccess: boolean;
  /** The team's newest closed season when there is no live one — see `resolveClosedSeason`. */
  closedSeason: ClosedCoachingAssignment | null;
}

export function resolveCoachSeasonPage(
  ctx: {
    assignments: CoachingAssignment[];
    closedAssignments: ClosedCoachingAssignment[];
  },
  orgSlug: string,
  teamId: string,
): CoachSeasonPage {
  const season = resolveLiveSeason(ctx.assignments, teamId);
  const closedSeason = resolveClosedSeason(ctx.assignments, ctx.closedAssignments, teamId);
  return {
    season,
    capabilities: season?.capabilities ?? closedSeason?.capabilities,
    teamName: season?.teamName ?? closedSeason?.teamName ?? '',
    teamSport: season?.teamSport ?? closedSeason?.teamSport,
    programYearName: season?.programYearName ?? closedSeason?.programYearName ?? '',
    teamBase: `/${orgSlug}/coaches/teams/${teamId}`,
    hasAccess: !!season,
    closedSeason,
  };
}
