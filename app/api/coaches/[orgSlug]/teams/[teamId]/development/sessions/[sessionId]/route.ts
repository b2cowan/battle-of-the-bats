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
  getRepTeamEvents,
  getRepTeamEventById,
  restampRepSessionMeasurables,
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
  const [players, types, entries, events] = await Promise.all([
    programYear ? getRepRosterPlayers(programYear.id) : Promise.resolve([]),
    getRepTeamMeasurableTypes(teamId, { includeRetired: true }),
    getRepSessionMeasurables(sessionId, teamId),
    // D10 — the event picker's options. ANY event in the season qualifies (§10.2 ruling 2):
    // restricting to practices creates a dead end for the coach who tested at a Saturday
    // scrimmage warm-up, and the link is descriptive, not structural. The client orders them
    // practices-first and by proximity to the session's current date.
    programYear && canWriteDevelopment(caps) ? getRepTeamEvents(programYear.id) : Promise.resolve([]),
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
    // Identity + date only — the picker needs to name an event, not carry its whole record.
    events: events.map(e => ({ id: e.id, name: e.name, eventType: e.eventType, startsAt: e.startsAt })),
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

  let body: { sessionDate?: unknown; note?: unknown; eventId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const fields: { sessionDate?: string; note?: string | null; eventId?: string | null } = {};
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
  // D10 — link this session to the event its readings were taken at. Any event in THIS season
  // qualifies (§10.2 ruling 2); `null` unlinks. The link never derives the date — see below.
  if (body.eventId !== undefined) {
    if (body.eventId === null) {
      fields.eventId = null;
    } else if (typeof body.eventId === 'string' && body.eventId) {
      const event = await getRepTeamEventById(body.eventId);
      if (!event || event.teamId !== teamId || event.programYearId !== resolved.session.programYearId) {
        return NextResponse.json({ error: 'That event isn’t on this team’s schedule for this season.' }, { status: 400 });
      }
      fields.eventId = event.id;
    } else {
      return NextResponse.json({ error: 'eventId must be an event id or null' }, { status: 400 });
    }
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  /**
   * ⚠ THE RE-STAMP (plan §10.1). A reading is stamped with the session's date at the moment it is
   * typed. So moving the session's date MUST move the readings collected in it — otherwise the
   * session silently disagrees with its own contents and every trend line plots on the wrong day.
   *
   * Done BEFORE the session row is updated so a failure here leaves both sides on the old date
   * (consistent), rather than a moved header over stale readings (the exact corruption above).
   * The client has already confirmed the count with the coach; this is the write that honours it.
   *
   * Readings logged individually from a player profile carry no session id and are untouched.
   */
  const previousDate = resolved.session.sessionDate;
  const movingDate = !!fields.sessionDate && fields.sessionDate !== previousDate;
  let restampedCount = 0;
  if (movingDate) {
    restampedCount = await restampRepSessionMeasurables(sessionId, teamId, fields.sessionDate!);
  }

  const session = await updateRepTeamEvaluationSession(sessionId, teamId, fields);

  // ⚠ There is no transaction spanning the two writes above, so the failure direction has to be
  // handled by hand: if the readings moved but the session row did NOT (a concurrent delete, or
  // any transient error), the session would silently disagree with its own contents — the exact
  // corruption the re-stamp exists to prevent, arriving from the other side. Put the readings
  // back where they were, and say plainly if even that fails.
  if (!session) {
    if (movingDate && restampedCount > 0) {
      try {
        await restampRepSessionMeasurables(sessionId, teamId, previousDate);
      } catch {
        return NextResponse.json({
          error: `The session could not be moved, and ${restampedCount} reading${restampedCount === 1 ? '' : 's'} may now carry the wrong date. Reload and check the date on this session before entering anything else.`,
        }, { status: 500 });
      }
    }
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  return NextResponse.json({ session, restampedCount });
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
