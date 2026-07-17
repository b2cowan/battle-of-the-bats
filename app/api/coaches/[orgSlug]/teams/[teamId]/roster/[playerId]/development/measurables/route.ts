import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepRosterPlayer,
  getRepTeamMeasurableTypes,
  getRepTeamEvaluationSession,
  createRepPlayerMeasurable,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteDevelopment } from '@/lib/coach-capabilities';
import { isValidRecordDate } from '@/lib/measurable-format';

async function resolveContext(orgSlug: string, teamId: string, playerId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const [assignments, player] = await Promise.all([
    getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id),
    getRepRosterPlayer(playerId),
  ]);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };
  if (!player || player.teamId !== teamId || player.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Player not found' }, { status: 404 }) };
  }

  return { ctx, player, assignment };
}

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, playerId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can log measurables.');
  if (denied) return denied;

  let body: { measurableTypeId?: unknown; value?: unknown; recordedOn?: unknown; note?: unknown; sessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const measurableTypeId = typeof body.measurableTypeId === 'string' ? body.measurableTypeId : '';
  if (!measurableTypeId) {
    return NextResponse.json({ error: 'measurableTypeId is required' }, { status: 400 });
  }
  // Must be this TEAM's type and ACTIVE — a retired type can't take new entries (it keeps
  // resolving for past ones), and another team's type id must not slip through.
  const types = await getRepTeamMeasurableTypes(teamId);
  const type = types.find(t => t.id === measurableTypeId);
  if (!type) {
    return NextResponse.json({ error: 'Pick an active measurable type for this team.' }, { status: 400 });
  }

  const value = typeof body.value === 'number' ? body.value : NaN;
  if (!Number.isFinite(value) || value < 0 || value > 99999) {
    return NextResponse.json({ error: 'Value must be a number between 0 and 99,999.' }, { status: 400 });
  }

  const recordedOn = typeof body.recordedOn === 'string' ? body.recordedOn : '';
  if (!isValidRecordDate(recordedOn)) {
    return NextResponse.json({ error: 'recordedOn must be a valid YYYY-MM-DD date — check the year.' }, { status: 400 });
  }

  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (note.length > 200) {
    return NextResponse.json({ error: 'Note is too long (max 200 characters).' }, { status: 400 });
  }

  // Optional evaluation-session tag (3B) — must be THIS team's session AND the same season
  // as the player row (a prior-season session id must not attach to a current reading; the
  // player row is season-scoped, so its program_year_id is the parity anchor).
  let sessionId: string | null = null;
  if (body.sessionId != null) {
    if (typeof body.sessionId !== 'string') {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
    }
    const session = await getRepTeamEvaluationSession(body.sessionId, teamId);
    if (!session || session.programYearId !== resolved.player.programYearId) {
      return NextResponse.json({ error: 'Session not found for this team and season.' }, { status: 400 });
    }
    sessionId = session.id;
  }

  try {
    const entry = await createRepPlayerMeasurable({
      orgId: ctx.org.id,
      teamId,
      playerId,
      measurableTypeId,
      value,
      // Unit snapshot comes from the TYPE server-side — never from the client — so a later
      // unit edit can't rewrite what was logged today.
      unit: type.unit,
      recordedOn,
      note: note || null,
      sessionId,
      createdBy: ctx.user.id,
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error: unknown) {
    // Partial unique (session, player, test) — one reading per player per test per session.
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Already logged for this player in this session — remove the existing reading first.' }, { status: 409 });
    }
    throw error;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/measurables' });
