/**
 * Which season is on screen, and is it a record? — the pure half of the coach portal's page chrome.
 *
 * Deliberately NOT in `coaches-context.tsx`: this is what every page's write flags reduce to, so it
 * lives where it can be unit-tested without React. The context re-exports it for consumers.
 *
 * ⚠ **THERE IS ONE SEASON, AND THE COACH DOES NOT CHOOSE IT** (Design A, owner ruling 2026-08-16;
 * P2 of COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md). This file used to hold a season SWITCHER: a
 * per-team option list, a `?year=` encoder, and the rule for where switching lands. All of it is
 * deleted with the archive-as-a-place. What a page renders is the team's WORKING season — the live
 * one, or the newest finished one when the team is between seasons — and nothing else.
 *
 * ⚠ THE RULE THIS FILE STILL EXISTS TO HOLD: read-only is a fact about the SEASON, never about the
 * TEAM. A team rolled forward into a new year is never itself "closed", and a team whose season has
 * ended is not a team the coach has lost — it is a team between seasons, whose every record surface
 * still renders. The plan of record had this backwards once, and keying off the team's state would
 * make a rolled-forward team's finished season quietly writable.
 */
import type { CoachCapabilities } from './coach-capabilities';
import type { CoachingAssignment, ClosedCoachingAssignment } from './db';

/**
 * The team's WORKING season, resolved from the two assignment lookups the shell already holds.
 *
 * The live assignment wins; otherwise the newest finished one (`closedAssignments` arrives deduped
 * to one row per team, newest first). Returns null when the coach holds neither, which is the
 * "not on this team" state every page walls on.
 */
export interface CoachWorkingSeason {
  teamId: string;
  programYearId: string;
  programYearName: string;
  programYearYear: number | null;
  teamName: string;
  teamSport: string;
  coachRole: 'head_coach' | 'assistant_coach';
  capabilities: CoachCapabilities;
  /** The season has finished ⇒ every surface renders it as a record, with no write control. */
  isReadOnly: boolean;
}

export function resolveWorkingSeason(
  assignments: CoachingAssignment[],
  closedAssignments: ClosedCoachingAssignment[],
  teamId: string | null | undefined,
): CoachWorkingSeason | null {
  if (!teamId) return null;
  /**
   * ⚠ NEWEST live season, not the first one the lookup happened to return — `getCoachingAssignmentsForUser`
   * has no ORDER BY, so arrival order is arbitrary and must not decide this. A team can hold a draft
   * AND an active year at once, mid-rollover.
   *
   * ⚠⚠ **THIS TIE-BREAK IS NOT THE SERVER'S** (`/review` 2026-08-16, recorded rather than papered
   * over). Here it is the highest `year`; the API routes resolve through `resolveWorkingProgramYear`
   * → `getActiveRepProgramYear`, which takes the most recently CREATED row. In every rollover the
   * product itself performs, the new year is both later-created and higher-numbered, so the two
   * agree — they would diverge only if someone minted a lower-numbered year AFTER a higher one (an
   * admin correcting a mis-entered season, say), and then the masthead would name one season while
   * the data came from another. It is a NARROW pre-existing divergence, not something P2 introduced,
   * but P2 removed the `?year=` that used to paper over it, so it is logged as a follow-up in
   * COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md rather than left as a comment claiming they match.
   * Closing it properly means carrying `created_at` onto the assignment row, which is a shared-db
   * change and belongs in its own unit of work.
   */
  const live = assignments
    .filter(a => a.teamId === teamId)
    .sort((a, b) => (b.programYearYear ?? 0) - (a.programYearYear ?? 0))[0];
  if (live) {
    return {
      teamId,
      programYearId: live.programYearId,
      programYearName: live.programYearName,
      programYearYear: live.programYearYear,
      teamName: live.teamName,
      teamSport: live.teamSport,
      coachRole: live.coachRole,
      capabilities: live.capabilities,
      isReadOnly: false,
    };
  }
  const closed = closedAssignments.find(a => a.teamId === teamId);
  if (!closed) return null;
  return {
    teamId,
    programYearId: closed.programYearId,
    programYearName: closed.programYearName,
    programYearYear: closed.programYearYear,
    teamName: closed.teamName,
    teamSport: closed.teamSport,
    coachRole: closed.coachRole,
    capabilities: closed.capabilities,
    isReadOnly: true,
  };
}

/**
 * Everything a section PAGE needs about the season it is rendering.
 *
 * ⚠ `query` and `everHeadCoach` are GONE (P2, 2026-08-16). The first carried `?year=` onto every
 * link and fetch and has nothing left to carry; the second gated the team's own season-by-season
 * scrapbook to the head coach, a floor set while an ex-coach could still read everything — M1
 * removed that premise, so every current member sees it (owner ruling).
 */
export interface CoachSeasonPage {
  /** The working season, or null while assignments load / the coach is not on this team. */
  season: CoachWorkingSeason | null;
  capabilities: CoachCapabilities | undefined;
  teamName: string;
  teamSport: string | undefined;
  programYearName: string;
  isReadOnly: boolean;
  /** `/{org}/coaches/teams/{teamId}` — the base every in-team link is built from. */
  teamBase: string;
  /** The coach is on this team's staff. False ⇒ render the "not assigned" wall. */
  hasAccess: boolean;
  /** Fold a capability into the read-only rule: `canWrite(caps.rosterWrite)`. */
  canWrite: (capability: boolean | undefined) => boolean;
}

export function resolveCoachSeasonPage(
  ctx: {
    assignments: CoachingAssignment[];
    closedAssignments: ClosedCoachingAssignment[];
  },
  orgSlug: string,
  teamId: string,
): CoachSeasonPage {
  const season = resolveWorkingSeason(ctx.assignments, ctx.closedAssignments, teamId);
  const isReadOnly = season?.isReadOnly ?? false;
  return {
    season,
    capabilities: season?.capabilities,
    teamName: season?.teamName ?? '',
    teamSport: season?.teamSport,
    programYearName: season?.programYearName ?? '',
    isReadOnly,
    teamBase: `/${orgSlug}/coaches/teams/${teamId}`,
    hasAccess: !!season,
    // ⚠ Courtesy only. Hiding a control is not read-only — the server refuses the write, and a
    // source-level test proves no write handler can even address a season that has ended.
    canWrite: (capability: boolean | undefined) => !isReadOnly && !!capability,
  };
}
