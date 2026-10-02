import { refuseWithoutLiveSeat } from '@/lib/coach-season-refusal';
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, updateRepTeamDrill } from '@/lib/db';
import { captureError, withObservability } from '@/lib/observability';
import { denyUnless, canManageSchedule, canWritePracticePlans } from '@/lib/coach-capabilities';
import { validateDrillInput } from '@/lib/rep-drills';
import { getDrillReach, readTeamDrillName, refreshDrillAcrossTeam } from '@/lib/rep-drill-refresh';

/**
 * Edit, retire or restore ONE of this team's drills.
 *
 * ⚠ **There is no DELETE, deliberately.** Retire (`isActive: false`) is the only removal, which is
 * what keeps every practice plan the drill already sits in working untouched — and, because a plan
 * stores its own COPY of the drill's words, a retired drill keeps reading correctly for ever.
 *
 * ⚠ **A coach can never reach the club's SHARED set from here.** The update is scoped to
 * `teamId` in the query itself, and a shared drill has no team, so it simply cannot match — no
 * pre-fetch, no ownership check to forget. Shared drills are managed by an org admin on the
 * shared-library screen, and mig 218's RLS encodes the same rule a second time.
 *
 * ⚖ **AN EDIT REACHES WHAT HASN'T HAPPENED YET** (owner ruling D3, 2026-10-02). A saved edit is
 * re-copied into every station still linked to this drill in the team's upcoming practices, and in
 * its templates and circuits (`refreshDrillAcrossTeam`); a practice that has started keeps the
 * version it ran. A retire or restore reaches nothing. GET answers what an edit WOULD reach, for the
 * save window's question and the drill sheet's line.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; drillId: string }> },) => {
  const { orgSlug, teamId, drillId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return refuseWithoutLiveSeat(ctx.org, ctx.user.id, teamId);

  const denied = denyUnless(canManageSchedule(assignment.capabilities), 'You do not have access to the schedule.');
  if (denied) return denied;

  // Only this team's own drill has a reach — a club drill is never updated from a team (D12).
  if (!(await readTeamDrillName(drillId, teamId))) return NextResponse.json({ error: 'Drill not found' }, { status: 404 });
  return NextResponse.json({ reach: await getDrillReach(teamId, drillId) });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/drills/[drillId]' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; drillId: string }> },) => {
  const { orgSlug, teamId, drillId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return refuseWithoutLiveSeat(ctx.org, ctx.user.id, teamId);

  const denied = denyUnless(canWritePracticePlans(assignment.capabilities), 'Managing drills needs Schedule: View + edit. Ask your head coach.');
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Retire/restore travels ALONE — it is a one-tap state change, not an edit, so it deliberately
  // skips the field validation a rename has to pass.
  if (typeof body.isActive === 'boolean' && Object.keys(body).length === 1) {
    const drill = await updateRepTeamDrill(drillId, { orgId: ctx.org.id, teamId }, { isActive: body.isActive });
    if (!drill) return NextResponse.json({ error: 'Drill not found' }, { status: 404 });
    return NextResponse.json({ drill });
  }

  const parsed = validateDrillInput(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    // Read BEFORE the write, so the walk can follow a rename into blocks still titled the old way.
    const previousName = await readTeamDrillName(drillId, teamId);
    const drill = await updateRepTeamDrill(drillId, { orgId: ctx.org.id, teamId }, parsed.drill);
    if (!drill) return NextResponse.json({ error: 'Drill not found' }, { status: 404 });
    try {
      await refreshDrillAcrossTeam(teamId, drill, previousName);
    } catch (walkError) {
      // The drill IS saved; some upcoming plans may not carry it yet. Saving again re-runs the walk
      // (idempotent), so the coach is told exactly that rather than "it failed".
      void captureError(walkError, { ctx, route: '/api/coaches/[orgSlug]/teams/[teamId]/development/drills/[drillId]', method: 'PATCH', statusCode: 500 });
      return NextResponse.json(
        { drill, error: 'The drill saved, but some upcoming practices didn’t pick it up. Save it again to finish.' },
        { status: 500 },
      );
    }
    return NextResponse.json({ drill });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: `You already have a drill called “${parsed.drill.name}”.` }, { status: 409 });
    }
    throw error;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/drills/[drillId]' });
