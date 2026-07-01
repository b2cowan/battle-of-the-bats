import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getOrCreateRepTryout,
  getRepTryoutRubric,
  upsertRepTryoutRubric,
  getRepTryoutScores,
} from '@/lib/db';
import { getRubricStarter } from '@/lib/tryout-rubric-templates';
import { withObservability } from '@/lib/observability';
import type { RepProgramYear, RepTryoutRubricCategory } from '@/lib/types';

type Resolved =
  | { ok: false; res: Response }
  | { ok: true; orgId: string; teamId: string; programYear: RepProgramYear };

async function resolveCoach(orgSlug: string, teamId: string): Promise<Resolved> {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { ok: false, res: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { ok: false, res: forbidden() };
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.some(a => a.teamId === teamId)) return { ok: false, res: forbidden() };
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) return { ok: false, res: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  return { ok: true, orgId: ctx.org.id, teamId, programYear };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;

  const tryout = await getOrCreateRepTryout({ programYearId: r.programYear.id, teamId: r.teamId, orgId: r.orgId });
  const rubric = await getRepTryoutRubric(tryout.id);
  return NextResponse.json({ rubric, starter: getRubricStarter(), scaleOptions: [5, 10] });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-rubric' });

/** Create/replace the tryout's scorecard. */
export const PUT = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;

  const body = await req.json();
  const scaleMax = body.scaleMax === 10 ? 10 : 5;

  // Normalize categories: require a non-empty label; derive a stable key; clamp weight to >= 0.
  const raw = Array.isArray(body.categories) ? body.categories : [];
  const seen = new Set<string>();
  const categories: RepTryoutRubricCategory[] = [];
  for (const c of raw) {
    const label = typeof c?.label === 'string' ? c.label.trim().slice(0, 60) : '';
    if (!label) continue;
    let key = typeof c?.key === 'string' && c.key.trim() ? c.key.trim().slice(0, 40) : label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!key) key = `cat-${categories.length + 1}`;
    // Collision-resolve with an incrementing counter (base-2, base-3, …), not the array length.
    if (seen.has(key)) {
      const base = key;
      let n = 2;
      while (seen.has(`${base}-${n}`)) n++;
      key = `${base}-${n}`;
    }
    seen.add(key);
    const weight = typeof c?.weight === 'number' && c.weight >= 0 ? c.weight : 1;
    const instructions = typeof c?.instructions === 'string' ? c.instructions.trim().slice(0, 500) : undefined;
    categories.push({ key, label, weight, ...(instructions ? { instructions } : {}) });
  }
  if (categories.length === 0) {
    return NextResponse.json({ errors: { categories: 'Add at least one scoring category' } }, { status: 400 });
  }

  const tryout = await getOrCreateRepTryout({ programYearId: r.programYear.id, teamId: r.teamId, orgId: r.orgId });

  // Guard: don't let an edit REMOVE a category that already has scores — that would orphan those
  // score rows (no FK from scores → rubric categories). Renames/weight/label edits keep the key, so
  // they're unaffected; adding categories or removing an unscored one is still fine.
  const existingRubric = await getRepTryoutRubric(tryout.id);
  if (existingRubric && existingRubric.categories.length > 0) {
    const scores = await getRepTryoutScores(tryout.id);
    if (scores.length > 0) {
      const incoming = new Set(categories.map(c => c.key));
      const scoredKeys = new Set(scores.map(s => s.categoryKey));
      const removedScored = existingRubric.categories
        .map(c => c.key)
        .filter(k => scoredKeys.has(k) && !incoming.has(k));
      if (removedScored.length > 0) {
        return NextResponse.json(
          { errors: { categories: 'Players have already been scored on a category you’re removing. Keep that category (you can still rename it) to protect those scores.' } },
          { status: 409 },
        );
      }
    }
  }

  const rubric = await upsertRepTryoutRubric({
    tryoutId: tryout.id,
    programYearId: r.programYear.id,
    teamId: r.teamId,
    orgId: r.orgId,
    name: typeof body.name === 'string' ? body.name.trim().slice(0, 120) || null : null,
    scaleMax,
    categories,
  });
  return NextResponse.json({ rubric });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-rubric' });
