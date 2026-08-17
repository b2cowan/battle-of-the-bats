import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getDrillsForTeam,
  getRepTeamPracticePlansAcrossSeasons,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteDevelopment } from '@/lib/coach-capabilities';
import { collectImportableDrills } from '@/lib/rep-drill-usage';

/**
 * "Add drills from a past season" — the owner's 2026-08-01 archive ruling, made concrete.
 *
 * ⚠ **THIS IS THE ONE PLACE IN THE WHOLE FEATURE THAT READS A PAST SEASON, and it is deliberate.**
 * The ruling: the drill library is not browsable in a finished season (it is a reusable INSTRUMENT,
 * so its door is hidden there), but a coach may pull what they already wrote forward into the live
 * library — the same idiom as importing from the club's shared set.
 *
 * Why this is defensible where a season-aware library would not be:
 *   · It READS the team's own historical records and WRITES nothing into the finished season. There
 *     is no edit path here at all — saving happens through the ordinary live-season POST.
 *   · It feeds a live-season instrument. The archive test asks "record or instrument?"; the records
 *     stay records, and only their words are copied forward.
 *   · It is HEAD-COACH-ONLY, because everything it exists to do is a write to the library.
 *
 * It therefore deliberately does NOT use `resolveCoachTeamRead`: that resolver answers with ONE
 * season — the team's working one — and this route deliberately reads across all of them, into the
 * LIVE library.
 *
 * ⚠ **THE CLAIM THAT THE GUARD LISTS THIS ROUTE WAS FALSE UNTIL 2026-08-16 (P3 C1)** — the same
 * stale sentence its plan-template sibling carried, for the same reason: the guard's cross-season
 * list is keyed on `resolveCoachTeamCapabilities`, which this route never calls. It is true now,
 * through a second detector keyed on `getRepTeamPracticePlansAcrossSeasons`.
 *
 * ⚠ Known tail, deliberately NOT fixed here: this route still gates through
 * `getCoachingAssignmentsForUser` (the legacy assignment lookup) rather than team membership — the
 * second instance of COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md §8.3's `tryout-report` tail. The
 * projection invariant makes the two agree today.
 *
 * ⚠ A team is PERMANENT — only its program year turns over — so a team's drill library already
 * survives a season rollover untouched. What genuinely needed rescuing was the PLANS, which live on
 * season-keyed events. That is exactly and only what this reads.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return forbidden();

  // Head-coach-only: the only thing this list can do is feed a library write.
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can manage drills.');
  if (denied) return denied;

  const [activeYear, plans, drills] = await Promise.all([
    getActiveRepProgramYear(teamId),
    getRepTeamPracticePlansAcrossSeasons(teamId).catch(() => []),
    getDrillsForTeam(ctx.org.id, teamId).catch(() => []),
  ]);

  /**
   * ⚠ The LIVE season is excluded deliberately.
   *
   * A station in this season's plan is already reachable through "Save to my drills…" on the plan
   * itself, and offering the same activity in two places would let a coach save it twice under
   * slightly different words. A team with NO active year sees everything it has ever run, which is
   * the right answer for exactly the coach most likely to be looking back.
   */
  const pastPlans = activeYear
    ? plans.filter(p => p.programYearId !== activeYear.id)
    : plans;

  const importable = collectImportableDrills(
    pastPlans.map(p => ({ plan: p.plan, startsAt: p.startsAt })),
    drills.map(d => d.name),
  );

  return NextResponse.json({ drills: importable });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/drills/past-seasons' });
