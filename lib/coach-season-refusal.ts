import 'server-only';
import { NextResponse } from 'next/server';
import { forbidden } from './api-auth';
import { getActiveRepProgramYear, getLatestClosedRepProgramYear } from './db';
import { getEntitledTeamMembership } from './coach-membership';
import { seasonNotLiveRefusal } from './season-doors';
import type { Organization } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A PORTAL ROUTE SAYS WHEN THE CALLER HOLDS NO LIVE ASSIGNMENT ON THIS TEAM.
 *
 * Every coach team route looks the caller up in the team's LIVE-season assignments first. "Not
 * there" used to be answered with a bare 403 in ~85 hand-copied places, and it means one of two
 * very different things:
 *   · they are not on this team's staff at all → 403, as before, and nothing learned about it;
 *   · they ARE on the staff, and the team simply has no live season (the club closed it while their
 *     screen was open) → 409 `season_not_live`, in words (Club Tier Stage 2, specimen 4 frame C).
 *
 * ⚠ The 409 is given ONLY to a current member of this team — the membership read comes first — so
 * the answer never tells an outsider or a removed coach anything about the team's seasons.
 * ⚠ It runs only on the refusal path: an ordinary request pays nothing for it.
 * ⚠ It never takes or returns a year to act on (the `HISTORY_ENDPOINTS` rule): the one door it
 * implies is the team's closed-season page, which already knows its season.
 * ⚠ Any failure answers 403, the old answer — a refusal must never turn into a 500.
 *
 * `tests/unit/club-stage2-server-guard.test.ts` fails the build if a coach team route answers a
 * missing assignment with `forbidden()` directly again.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export async function refuseWithoutLiveSeat(
  org: Organization,
  userId: string,
  teamId: string,
): Promise<Response> {
  try {
    const membership = await getEntitledTeamMembership(org, teamId, userId);
    if (!membership) return forbidden();
    const live = await getActiveRepProgramYear(teamId);
    // A member with a live season but no row on it is a projection gap, not a closed season.
    if (live) return forbidden();
    return seasonNotLiveResponse(org, teamId);
  } catch (e) {
    console.error('[coach-season-refusal] could not tell why; answering 403:', e);
    return forbidden();
  }
}

/**
 * The coded 409 itself, for a route that has ALREADY established the caller is on the team and
 * found no live season (the shared live resolvers' second check).
 */
export async function seasonNotLiveResponse(org: Organization, teamId: string): Promise<Response> {
  const closed = await getLatestClosedRepProgramYear(teamId);
  return NextResponse.json(seasonNotLiveRefusal(org, closed?.name ?? null), { status: 409 });
}
