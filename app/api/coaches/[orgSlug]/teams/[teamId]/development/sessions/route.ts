import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getRepTeamEvaluationSessions,
  createRepTeamEvaluationSession,
  getRepTeamMeasurableTypes,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMeasurables, canWriteDevelopment } from '@/lib/coach-capabilities';
import { isValidRecordDate } from '@/lib/measurable-format';

async function resolveContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  return { ctx, assignment };
}

/** The Development hub's single fetch: sessions + the type library + canWrite in one
 *  auth-gated round trip (board-route precedent — two GETs doubled auth resolution).
 *  Two waves: (auth ∥ programYear) → deny → (sessions ∥ types). Team-scoped reads never
 *  run before the deny resolves — an unassigned org member must not force them. */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const [resolved, programYear] = await Promise.all([
    resolveContext(orgSlug, teamId),
    getActiveRepProgramYear(teamId),
  ]);
  if ('error' in resolved) return resolved.error!;
  const denied = denyUnless(canViewMeasurables(resolved.assignment.capabilities), 'You do not have access to measurables.');
  if (denied) return denied;

  if (!programYear) {
    return NextResponse.json({ error: 'No active program year for this team' }, { status: 404 });
  }
  const [sessions, types] = await Promise.all([
    getRepTeamEvaluationSessions(programYear.id),
    getRepTeamMeasurableTypes(teamId, { includeRetired: true }),
  ]);
  return NextResponse.json({ sessions, types, canWrite: canWriteDevelopment(resolved.assignment.capabilities) });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/sessions' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const [resolved, programYear] = await Promise.all([
    resolveContext(orgSlug, teamId),
    getActiveRepProgramYear(teamId),
  ]);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can run evaluation sessions.');
  if (denied) return denied;

  let body: { sessionDate?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const sessionDate = typeof body.sessionDate === 'string' ? body.sessionDate : '';
  if (!isValidRecordDate(sessionDate)) {
    return NextResponse.json({ error: 'sessionDate must be a valid YYYY-MM-DD date — check the year.' }, { status: 400 });
  }
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (note.length > 200) {
    return NextResponse.json({ error: 'Note is too long (max 200 characters).' }, { status: 400 });
  }

  if (!programYear) {
    return NextResponse.json({ error: 'No active program year for this team' }, { status: 404 });
  }

  const session = await createRepTeamEvaluationSession({
    orgId: ctx.org.id,
    teamId,
    programYearId: programYear.id,
    sessionDate,
    note: note || null,
    createdBy: ctx.user.id,
  });
  return NextResponse.json({ session }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/sessions' });
