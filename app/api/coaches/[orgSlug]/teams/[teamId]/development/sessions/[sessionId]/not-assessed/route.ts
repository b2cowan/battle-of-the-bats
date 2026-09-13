import { NextResponse } from 'next/server';
import {
  getRepTeamEvaluationSession,
  getRepTeamMeasurableType,
  getRepRosterPlayer,
  getRepSessionMeasurables,
  markRepSessionNotAssessed,
  unmarkRepSessionNotAssessed,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { denyUnless, canWriteDevelopment, DEVELOPMENT_GRANT_MESSAGE } from '@/lib/coach-capabilities';
import { readNotAssessedInput } from '@/lib/development-input';

/**
 * "Not assessed" — a per-(session, player, metric) STATE with a neutral reason (development
 * lifecycle Phase 2, mockup screen 3). Never a value, never a zero: marking a cell says the coach
 * chose not to assess it; unmarking returns it to "not recorded". A link on BLANK rows only —
 * the screen offers it there and nowhere else (open call, carried at its recommendation).
 *
 * The session is resolved INSIDE the working season (the [sessionId] route's rule), so a finished
 * season's session cannot be marked from here.
 */
async function resolveContext(orgSlug: string, teamId: string, sessionId: string) {
  const live = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in live) return live;
  const { ctx, assignment, programYear } = live;
  const session = await getRepTeamEvaluationSession(sessionId, teamId, programYear.id);
  if (!session || session.orgId !== ctx.org.id) return { error: NextResponse.json({ error: 'Session not found' }, { status: 404 }) };
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), DEVELOPMENT_GRANT_MESSAGE);
  if (denied) return { error: denied };
  return { ctx, assignment, session, programYear };
}

/** The mark names a player of THIS season and a metric of THIS team — proved here by two single-row
 *  reads; the composite FKs (mig 295) refuse anything else at the database as well. */
async function verifyCell(teamId: string, programYearId: string, playerId: string, measurableTypeId: string) {
  const [player, type] = await Promise.all([
    getRepRosterPlayer(playerId),
    getRepTeamMeasurableType(measurableTypeId, teamId),
  ]);
  if (!player || player.teamId !== teamId || player.programYearId !== programYearId) return 'That player isn’t on this season’s roster.';
  if (!type) return 'That metric isn’t one of this team’s.';
  return null;
}

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; sessionId: string }> },) => {
  const { orgSlug, teamId, sessionId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, sessionId);
  if ('error' in resolved) return resolved.error!;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const read = readNotAssessedInput(body);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });
  const { playerId, measurableTypeId, reason } = read.fields;
  const bad = await verifyCell(teamId, resolved.programYear.id, playerId, measurableTypeId);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  // A cell with a value is RECORDED — a mark beside it would be a second, contradicting state on
  // the record (another device may have saved the value since this screen last read the row).
  const recorded = (await getRepSessionMeasurables(resolved.session.id, teamId))
    .some(e => e.playerId === playerId && e.measurableTypeId === measurableTypeId);
  if (recorded) return NextResponse.json({ error: 'That result is already recorded — reload the row to see it.' }, { status: 409 });
  const mark = await markRepSessionNotAssessed({
    orgId: resolved.ctx.org.id, teamId, sessionId: resolved.session.id, playerId, measurableTypeId, reason,
    createdBy: resolved.ctx.user.id,
  });
  return NextResponse.json({ notAssessed: mark }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/sessions/[sessionId]/not-assessed' });

export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; sessionId: string }> },) => {
  const { orgSlug, teamId, sessionId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, sessionId);
  if ('error' in resolved) return resolved.error!;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const read = readNotAssessedInput(body);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });
  const { playerId, measurableTypeId } = read.fields;
  const removed = await unmarkRepSessionNotAssessed(resolved.session.id, teamId, playerId, measurableTypeId);
  if (!removed) return NextResponse.json({ error: 'No mark to remove' }, { status: 404 });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/sessions/[sessionId]/not-assessed' });
