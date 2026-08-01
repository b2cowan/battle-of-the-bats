import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getRepTeamEvaluationSession,
  updateRepTeamEvaluationSession,
  deleteRepTeamEvaluationSession,
  getRepSessionMeasurables,
  getRepTeamMeasurableTypes,
  getRepRosterPlayers,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMeasurables, canWriteDevelopment, redactRoster } from '@/lib/coach-capabilities';
import { isValidRecordDate } from '@/lib/measurable-format';

async function resolveContext(orgSlug: string, teamId: string, sessionId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const [assignments, session] = await Promise.all([
    getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id),
    getRepTeamEvaluationSession(sessionId, teamId),
  ]);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };
  if (!session || session.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Session not found' }, { status: 404 }) };
  }

  return { ctx, assignment, session };
}

/** The run screen's whole world in one fetch: the session, the roster (in roster order —
 *  the grid NEVER re-sorts by result), the active test types, and every reading already
 *  collected in this session (resume state). */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; sessionId: string }> },) => {
  const { orgSlug, teamId, sessionId } = await params;
  // programYear only needs teamId — overlap it with auth/session resolution.
  const [resolved, programYear] = await Promise.all([
    resolveContext(orgSlug, teamId, sessionId),
    getActiveRepProgramYear(teamId),
  ]);
  if ('error' in resolved) return resolved.error!;
  const { assignment, session } = resolved;
  const caps = assignment.capabilities;
  const denied = denyUnless(canViewMeasurables(caps), 'You do not have access to measurables.');
  if (denied) return denied;
  const [players, types, entries] = await Promise.all([
    programYear ? getRepRosterPlayers(programYear.id) : Promise.resolve([]),
    getRepTeamMeasurableTypes(teamId, { includeRetired: true }),
    getRepSessionMeasurables(sessionId, teamId),
  ]);

  // Roster order as-is; names only — the grid needs identity, not guardian PII (redaction
  // still applied for defense in depth against future field additions).
  const roster = redactRoster(
    players.filter(p => p.status === 'active').map(p => ({
      id: p.id,
      playerFirstName: p.playerFirstName,
      playerLastName: p.playerLastName,
      playerNumber: p.playerNumber,
    })),
    caps,
  );

  return NextResponse.json({
    session,
    roster,
    types,
    entries,
    canWrite: canWriteDevelopment(caps),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/sessions/[sessionId]' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; sessionId: string }> },) => {
  const { orgSlug, teamId, sessionId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, sessionId);
  if ('error' in resolved) return resolved.error!;
  const denied = denyUnless(canWriteDevelopment(resolved.assignment.capabilities), 'Only the head coach can edit sessions.');
  if (denied) return denied;

  let body: { sessionDate?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const fields: { sessionDate?: string; note?: string | null } = {};
  if (body.sessionDate !== undefined) {
    const date = typeof body.sessionDate === 'string' ? body.sessionDate : '';
    if (!isValidRecordDate(date)) {
      return NextResponse.json({ error: 'sessionDate must be a valid YYYY-MM-DD date — check the year.' }, { status: 400 });
    }
    fields.sessionDate = date;
  }
  if (body.note !== undefined) {
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (note.length > 200) {
      return NextResponse.json({ error: 'Note is too long (max 200 characters).' }, { status: 400 });
    }
    fields.note = note || null;
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const session = await updateRepTeamEvaluationSession(sessionId, teamId, fields);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  return NextResponse.json({ session });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/sessions/[sessionId]' });

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; sessionId: string }> },) => {
  const { orgSlug, teamId, sessionId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, sessionId);
  if ('error' in resolved) return resolved.error!;
  const denied = denyUnless(canWriteDevelopment(resolved.assignment.capabilities), 'Only the head coach can delete sessions.');
  if (denied) return denied;

  // Entries survive (SET NULL → they become singles); only the grouping artifact goes.
  const deleted = await deleteRepTeamEvaluationSession(sessionId, teamId);
  if (!deleted) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/sessions/[sessionId]' });
