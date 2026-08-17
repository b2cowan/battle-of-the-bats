import { NextResponse } from 'next/server';
import { resolveCoachTeamAssignment } from '@/lib/coach-route-context';
import { getPastSeasonPracticePlans, getRepTeamPlanTemplates } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteDevelopment } from '@/lib/coach-capabilities';
import { planToTemplateShape, templateShapeLabel } from '@/lib/rep-plan-templates';

/**
 * "Add a template from a past season" — the archive ruling made concrete for plan templates.
 *
 * ⚠ **A cross-season READ that writes nothing into a finished season**, exactly like its drill
 * sibling, and deliberately NOT on `resolveCoachTeamRead` for the same reason: that resolver
 * answers with ONE season — the team's working one — and this route deliberately reads across all
 * of them, into the LIVE library.
 *
 * ⚠ **THE CLAIM THAT THE GUARD LISTS THIS ROUTE WAS FALSE UNTIL 2026-08-16 (P3 C1).** It said so
 * for months while `coach-history-endpoint-guard.test.ts` was keyed on `resolveCoachTeamCapabilities`
 * — which this route does not call — so nothing enforced it and a later session would have read this
 * sentence and believed a build-enforced record existed. It is true now: the guard has a second,
 * narrow detector (`CROSS_SEASON_PLAN_READERS`) keyed on the named reads that reach outside the
 * working season — `getPastSeasonPracticePlans`, which this route calls, among them.
 *
 * ⚠ Head-coach-only — everything this list can do is feed a library write.
 *
 * ⚠ It offers PLANS, deduplicated by name. A team is PERMANENT, so its template library already
 * survives a rollover untouched; what was genuinely season-locked is the plans, which is exactly
 * and only what this reads.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;

  // ⚠ The SHARED prefix. An earlier draft hand-rolled a shortened copy of this that skipped the
  // team-belongs-to-org check its two siblings had — harmless in the end (an assignment lookup is
  // org-scoped, so a foreign team matches nothing and 403s anyway) but exactly the drift that
  // makes four copies of an auth chain a bad idea. One implementation, no divergence to audit.
  const resolved = await resolveCoachTeamAssignment(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment } = resolved;

  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can manage plan templates.');
  if (denied) return denied;

  const [pastPlans, templates] = await Promise.all([
    /**
     * ⚠ The LIVE season is excluded, and the rule now lives in the READ rather than here
     * (`/simplify` 2026-08-16). This season's plan is already reachable through "Save as template…"
     * on the practice itself, and offering it in two places would let a coach save it twice under
     * slightly different words. One shared read, three callers — and the row cap is no longer
     * spent on this year's practices before the old ones are reached.
     */
    getPastSeasonPracticePlans(teamId).catch(() => []),
    getRepTeamPlanTemplates(teamId, { includeRetired: true }).catch(() => []),
  ]);

  const have = new Set(templates.map(t => t.name.trim().toLowerCase()));

  /**
   * ⚠ Deduplicated by the PRACTICE'S NAME, keeping the most recent version's shape.
   *
   * A coach who ran "Tuesday practice" thirty times wants one row, not thirty — and the newest is
   * the one they had refined by the end of the season, so it is the one worth keeping. Older
   * versions are counted, never merged: blending two practices into an average shape would be a
   * fabrication of a practice that never happened.
   */
  const byName = new Map<string, {
    key: string; name: string; plan: ReturnType<typeof planToTemplateShape>;
    shapeLabel: string; planCount: number; lastPlannedAt: string | null; alreadyInLibrary: boolean;
  }>();

  // Newest first, so the FIRST time a name is seen carries the shape worth keeping.
  const ordered = [...pastPlans].sort((a, b) => (b.startsAt ?? '').localeCompare(a.startsAt ?? ''));
  for (const row of ordered) {
    if (!row.plan || row.plan.blocks.length === 0) continue;
    const name = row.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();

    const seen = byName.get(key);
    if (seen) { seen.planCount += 1; continue; }

    // Emptied of people on the way out, so the client never holds a roster it has no business
    // with and cannot post one back — the strip is not a courtesy of the save path.
    const shape = planToTemplateShape(row.plan);
    byName.set(key, {
      key,
      name,
      plan: shape,
      shapeLabel: templateShapeLabel(shape),
      planCount: 1,
      // ⚠ "last planned", never "last run" — the practice the plan was written FOR.
      lastPlannedAt: row.startsAt,
      alreadyInLibrary: have.has(key),
    });
  }

  // Most-planned first, then alphabetical — the coach's own staples, which is what makes this
  // list worth opening. Orders PRACTICES, never people, so the no-ranking rule is untouched.
  const importable = [...byName.values()]
    .sort((a, b) => b.planCount - a.planCount || a.name.localeCompare(b.name));

  return NextResponse.json({ templates: importable });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/plan-templates/past-seasons' });
