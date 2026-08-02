import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, updateRepTeamDrill } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteDevelopment } from '@/lib/coach-capabilities';
import { validateDrillInput } from '@/lib/rep-drills';

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
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; drillId: string }> },) => {
  const { orgSlug, teamId, drillId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return forbidden();

  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can manage drills.');
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
    const drill = await updateRepTeamDrill(drillId, { orgId: ctx.org.id, teamId }, parsed.drill);
    if (!drill) return NextResponse.json({ error: 'Drill not found' }, { status: 404 });
    return NextResponse.json({ drill });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: `You already have a drill called “${parsed.drill.name}”.` }, { status: 409 });
    }
    throw error;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/drills/[drillId]' });
