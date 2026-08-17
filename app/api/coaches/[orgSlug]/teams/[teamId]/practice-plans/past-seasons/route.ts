import { NextResponse } from 'next/server';
import { resolveCoachTeamAssignment } from '@/lib/coach-route-context';
import { getPastSeasonPracticePlans, getRepProgramYears } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteDevelopment } from '@/lib/coach-capabilities';

/**
 * "A past season" — the THIRD source in `Start this plan from…` (P3 C2, owner-approved
 * 2026-08-16, `COACH_PRACTICE_PLANS_SHELF_PLAN.md` §2 C2).
 *
 * ── What was actually missing, stated precisely ──
 * The picker's "A previous practice" list comes from `getRepTeamEventsWithPracticePlans`, which is
 * SEASON-SCOPED. So a plan stays one tap away right up to the moment the next season starts, and
 * then becomes a five-step errand: Development → Plan templates → "Add from a past season" →
 * import → back to the practice → start from the template. That route also grows a library the
 * coach may never have wanted to grow, permanently, as the price of reusing one night's work.
 *
 * ⚠ **A CROSS-SEASON READER, NOT A HISTORY ENDPOINT**, and the distinction is the whole reason this
 * route may exist without an owner decision. It derives its seasons from the TEAM'S OWN DATA, is
 * never handed one, takes no `?year=` and cannot be pointed at a year. It reads records and writes
 * only into tonight's plan. That is precisely the power the drill and plan-template imports have
 * held since 2026-08-01 — and from 2026-08-16 that power is ENUMERATED: this file is on
 * `CROSS_SEASON_PLAN_READERS` in `tests/unit/coach-history-endpoint-guard.test.ts`, so C2 is a net
 * increase in what the build enforces rather than a new unguarded door.
 *
 * ⚠ **Head-coach-only**, matching both existing imports and the picker's own `canWrite` gate:
 * everything this list can do is write tonight's plan.
 *
 * ⚠ **NOT under `development/`**, deliberately. The two "decided absence" tests scan every route
 * whose path contains `/development/drills` or `/development/plan-templates` and fail if one learns
 * to serve a named season — filing this beside them would put a third meaning inside a folder those
 * guards read as "the libraries". This copies the WORDS of a past practice forward; it makes no
 * library season-aware, and those tests stay green untouched.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;

  // The SHARED coach-team prefix — the same one both imports use, rather than a fourth hand-rolled
  // copy of the auth chain (the drift its own note in plan-templates/past-seasons records).
  const resolved = await resolveCoachTeamAssignment(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment } = resolved;

  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can write a practice plan.');
  if (denied) return denied;

  const [pastPlans, years] = await Promise.all([
    // ⚠ ONE shared read, which owns the "exclude the live season" rule — the same read the drill
    // and plan-template imports use. Three hand-rolled copies of it collapsed here (`/simplify`).
    getPastSeasonPracticePlans(teamId).catch(() => []),
    // Season NAMES, which the plans read cannot supply: it hands back `programYearId` only, and a
    // row a coach cannot date to a season is exactly the row this list must never produce.
    getRepProgramYears(teamId).catch(() => []),
  ]);

  const seasonName = new Map(years.map(y => [y.id, y.name]));

  /**
   * ⚠ The shared read caps at 400 past-season practices, and that cap is left alone HERE on
   * purpose. This is a PICKER with a search box, not a record: a coach hunting one night types its
   * name. The cap would be dishonest on a list that claims to BE the season's practices, which is
   * why C3's Season's End list states its truncation instead of inheriting this posture.
   */

  /**
   * ⚠ **NOT deduplicated by name**, and that is the difference from the template import beside it.
   * That one is building a LIBRARY, so thirty "Tuesday practice" rows must collapse to one. This is
   * a coach reaching for a particular night — "the one where we finally fixed cut-offs" — so each
   * practice stays its own row, carrying the season it belongs to and its date.
   *
   * ⚠ A plan with no BLOCKS is not a plan (the hub's own rule): the builder saves once a goal or an
   * equipment note exists, so a coach who typed "work on cut-offs" and got called away leaves a
   * real, blockless row behind. Copying one forward would hand them a blank practice.
   */
  const practices = pastPlans
    .filter(p => p.plan && p.plan.blocks.length > 0)
    .map(p => ({
      eventId: p.eventId,
      name: p.name?.trim() || 'Practice',
      startsAt: p.startsAt,
      programYearId: p.programYearId,
      // Null rather than a guess when the season row has gone: the client states the gap instead of
      // printing a row that looks like it belongs to this year.
      seasonName: p.programYearId ? seasonName.get(p.programYearId) ?? null : null,
      plan: p.plan,
    }));

  return NextResponse.json({ practices });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/practice-plans/past-seasons' });
