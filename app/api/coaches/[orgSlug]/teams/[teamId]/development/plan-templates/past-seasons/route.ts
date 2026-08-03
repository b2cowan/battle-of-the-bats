import { NextResponse } from 'next/server';
import { resolveCoachTeamAssignment } from '@/lib/coach-route-context';
import {
  getActiveRepProgramYear,
  getRepTeamPlanTemplates,
  getRepTeamPracticePlansAcrossSeasons,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteDevelopment } from '@/lib/coach-capabilities';
import { planToTemplateShape, templateShapeLabel } from '@/lib/rep-plan-templates';

/**
 * "Add a template from a past season" — the archive ruling made concrete for plan templates.
 *
 * ⚠ **A cross-season READ that writes nothing into a finished season**, exactly like its drill
 * sibling, and deliberately NOT on the season-read rail for the same reason: that rail exists to
 * let a page *serve* a past season read-only, carrying the season through every link. This serves
 * the LIVE season and merely reads across years.
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

  const [activeYear, plans, templates] = await Promise.all([
    getActiveRepProgramYear(teamId),
    getRepTeamPracticePlansAcrossSeasons(teamId).catch(() => []),
    getRepTeamPlanTemplates(teamId, { includeRetired: true }).catch(() => []),
  ]);

  /**
   * ⚠ The LIVE season is excluded deliberately, mirroring the drill import: this season's plan is
   * already reachable through "Save as template…" on the practice itself, and offering it in two
   * places would let a coach save it twice under slightly different words. A team with NO active
   * year sees everything it has ever run — the right answer for exactly the coach most likely to
   * be looking back.
   */
  const pastPlans = activeYear ? plans.filter(p => p.programYearId !== activeYear.id) : plans;
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
