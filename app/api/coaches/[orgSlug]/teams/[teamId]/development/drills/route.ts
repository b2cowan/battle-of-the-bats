import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getDrillsForTeam,
  createRepTeamDrill,
  getRepTeamPracticePlansAcrossSeasons,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canManageSchedule, canWriteDevelopment } from '@/lib/coach-capabilities';
import { MAX_DRILLS_PER_TEAM, validateDrillInput } from '@/lib/rep-drills';
import { countDrillUses } from '@/lib/rep-drill-usage';

/**
 * The drill library (Practice Plans Phase 2).
 *
 * ── Capabilities (plan §8, D3 — NO new capability key) ──
 *   READ  → `schedule`. A drill is practice content, and an assistant who can open Tuesday's
 *           practice can already read every word a picked drill put on it. Withholding the library
 *           from them would hide nothing and break the preview.
 *   WRITE → HEAD COACH ONLY (`canWriteDevelopment`). Managing the library IS a write.
 * ⚠ RLS mirrors both (mig 218), so a direct PostgREST call from an assistant's session can't
 * bypass this — the mig-141 chat-engine lesson.
 *
 * ⚠ **THE ARCHIVE DOOR — decided, not discovered.** This route deliberately does NOT use
 * `resolveCoachSeasonRead`, so it resolves the team's live context and cannot serve a past season.
 * A drill library is a reusable INSTRUMENT, not a record of a season (owner ruling 2026-08-01), so
 * it fails the archive test the same way tryouts and money do, and the Drills door is hidden in a
 * completed season. That costs a coach nothing, because a team is PERMANENT and only its program
 * year turns over — a team's drills carry forward on their own, with no import and no migration.
 *
 * ⚠ The ONE deliberate cross-season read in the feature is `?source=past-seasons` below, which
 * reads this team's own past practice PLANS (which genuinely are season-locked) so they can be
 * pulled forward into the live library. It writes nothing into a finished season.
 */
async function resolveContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  return { ctx, assignment };
}

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canManageSchedule(assignment.capabilities), 'You do not have access to the schedule.');
  if (denied) return denied;

  const url = new URL(req.url);
  const includeRetired = url.searchParams.get('all') === '1';

  // ⚠ ONE read of the team's plans, shared by both jobs below. `getRepTeamPracticePlansAcrossSeasons`
  // is the deliberate cross-season read; everything else on this route is live-season only.
  const [drills, plans] = await Promise.all([
    getDrillsForTeam(ctx.org.id, teamId, { includeRetired }),
    getRepTeamPracticePlansAcrossSeasons(teamId).catch(() => []),
  ]);

  const uses = countDrillUses(plans.map(p => p.plan));
  return NextResponse.json({
    drills: drills.map(d => ({ ...d, planCount: uses.get(d.id) ?? 0 })),
    canWrite: canWriteDevelopment(assignment.capabilities),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/drills' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can manage drills.');
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = validateDrillInput(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Counted against the team's OWN active drills — the club's shared set is the org's to bound, and
  // a club with a big shared library must not lock a coach out of saving their own.
  const existing = await getDrillsForTeam(ctx.org.id, teamId, { includeRetired: true });
  const ownActive = existing.filter(d => d.teamId === teamId && d.isActive).length;
  if (ownActive >= MAX_DRILLS_PER_TEAM) {
    return NextResponse.json(
      { error: `You can keep up to ${MAX_DRILLS_PER_TEAM} drills. Retire one to add another.` },
      { status: 400 },
    );
  }

  try {
    const drill = await createRepTeamDrill({
      ...parsed.drill, orgId: ctx.org.id, teamId, createdBy: ctx.user.id,
    });
    return NextResponse.json({ drill: { ...drill, planCount: 0 } }, { status: 201 });
  } catch (error: unknown) {
    // Partial unique index on ACTIVE names, case-insensitive → 409, matching the measurable-type UX.
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: `You already have a drill called “${parsed.drill.name}”.` }, { status: 409 });
    }
    throw error;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/drills' });
