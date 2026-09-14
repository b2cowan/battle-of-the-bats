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
  getRepSessionNotAssessed,
  getRepSessionObservations,
  getOrgMemberDisplayNames,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import {
  denyUnless, canViewMeasurables, canViewDevelopmentGoals, canWriteDevelopment, canWriteDevelopmentGoals, redactRoster,
  DEVELOPMENT_GRANT_MESSAGE,
} from '@/lib/coach-capabilities';
import { readSessionPatchInput } from '@/lib/development-input';
import { verifySessionScope } from '@/lib/development-session-scope';

/**
 * ⚠ THE SEASON IS PART OF THE LOOKUP (2026-08-15). This resolver used to find the session by
 * `id + team_id` and then check only its ORG — which meant a finished season's session was
 * addressable from a live-season write route, so its date could be changed (re-stamping every
 * reading in it) or the whole session deleted. Nothing in the product hands out a past session id,
 * so the exposure was narrow; the reasoning was the same one that already failed once on an
 * archived fundraiser, which is why it is closed rather than left resting on navigation.
 *
 * Resolving the ACTIVE program year here also means every verb in this file inherits the write
 * rule for free: writes address the live season, always.
 */
async function resolveContext(orgSlug: string, teamId: string, sessionId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const [assignments, programYear] = await Promise.all([
    getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id),
    getActiveRepProgramYear(teamId),
  ]);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  const session = await getRepTeamEvaluationSession(sessionId, teamId, programYear.id);
  if (!session || session.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Session not found' }, { status: 404 }) };
  }

  return { ctx, assignment, session, programYear };
}

/** The run screen's whole world in one fetch: the session, the roster (in roster order —
 *  the grid NEVER re-sorts by result), the active test types, and every reading already
 *  collected in this session (resume state). */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; sessionId: string }> },) => {
  const { orgSlug, teamId, sessionId } = await params;
  // The season comes from the resolver now — it needs it to FIND the session, so fetching it
  // twice in parallel would be two reads of the same row and two chances to disagree.
  const resolved = await resolveContext(orgSlug, teamId, sessionId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, session, programYear } = resolved;
  const caps = assignment.capabilities;
  // A session's page is a room inside Skills & Goals: the Development grant only (stage 0, D5).
  const denied = denyUnless(canWriteDevelopment(caps), DEVELOPMENT_GRANT_MESSAGE);
  if (denied) return denied;
  // Observations are a coach's written judgement about a child — READ on Internal notes, like goals.
  // Without notes the skill chips render held back and the rows they would fill are simply absent.
  const showObservations = canViewDevelopmentGoals(caps);
  const [players, types, entries, events, notAssessed, observations] = await Promise.all([
    getRepRosterPlayers(programYear.id),
    getRepTeamMeasurableTypes(teamId, { includeRetired: true }),
    getRepSessionMeasurables(sessionId, teamId),
    // D10 — the event picker's options. ANY event in the season qualifies (§10.2 ruling 2):
    // restricting to practices creates a dead end for the coach who tested at a Saturday
    // scrimmage warm-up, and the link is descriptive, not structural. The client orders them
    // practices-first and by proximity to the session's current date.
    canWriteDevelopment(caps) ? getRepTeamEvents(programYear.id) : Promise.resolve([]),
    getRepSessionNotAssessed(sessionId, teamId),
    showObservations ? getRepSessionObservations(sessionId, teamId) : Promise.resolve([]),
  ]);
  // "Entered by" on every saved row (owner ruling 2026-09-11: every record names who wrote it).
  const authors = await getOrgMemberDisplayNames(resolved.ctx.org.id, [
    ...entries.map(e => e.createdBy ?? ''), ...observations.map(o => o.createdBy ?? ''), ...notAssessed.map(n => n.createdBy ?? ''),
  ]);

  // Roster order as-is; names only — the grid needs identity, not guardian PII (redaction
  // still applied for defense in depth against future field additions).
  const identity = (p: (typeof players)[number]) => ({
    id: p.id,
    playerFirstName: p.playerFirstName,
    playerLastName: p.playerLastName,
    playerNumber: p.playerNumber,
  });
  const roster = redactRoster(players.filter(p => p.status === 'active').map(identity), caps);
  /**
   * F02 (2026-09-11): a player who is no longer active but has a reading SAVED in this session
   * keeps their row — labelled, read-only. Until now the screen drew the current active roster and
   * nothing else, so a player who left the team took their saved results with them. Same season
   * (the session is resolved inside it, so its readings can only name this year's rows); new entry
   * still starts from `roster`.
   */
  const withReadings = new Set([
    ...entries.map(e => e.playerId), ...observations.map(o => o.playerId), ...notAssessed.map(n => n.playerId),
  ]);
  const pastParticipants = redactRoster(
    players.filter(p => p.status !== 'active' && withReadings.has(p.id)).map(identity),
    caps,
  );

  return NextResponse.json({
    session,
    roster,
    pastParticipants,
    // Every type, retired included — the screen decides which may take NEW entry (active) and
    // which are on this session only because they hold saved rows (F02).
    types,
    entries,
    // Identity + date only — the picker needs to name an event, not carry its whole record.
    events: events.map(e => ({ id: e.id, name: e.name, eventType: e.eventType, startsAt: e.startsAt })),
    notAssessed,
    observations,
    showObservations,
    authors,
    canWrite: canWriteDevelopment(caps),
    // The grant AND notes — an observation reached through a session is gated the way it is read.
    canWriteObservations: canWriteDevelopmentGoals(caps),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/sessions/[sessionId]' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; sessionId: string }> },) => {
  const { orgSlug, teamId, sessionId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, sessionId);
  if ('error' in resolved) return resolved.error!;
  const denied = denyUnless(canWriteDevelopment(resolved.assignment.capabilities), DEVELOPMENT_GRANT_MESSAGE);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const read = readSessionPatchInput(body);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });
  const { fields } = read;
  // "Change scope" — the ids are proved against this team's active definitions and this season's
  // active roster, like the create. A retired definition or a departed player cannot be re-admitted
  // to a scope (their saved rows stay, read-only, whatever the scope says).
  if (fields.scope) {
    const verified = await verifySessionScope({
      teamId, programYearId: resolved.programYear.id, scope: fields.scope, eventId: null,
      activeTypes: await getRepTeamMeasurableTypes(teamId, { includeRetired: false }),
    });
    if ('error' in verified) return NextResponse.json({ error: verified.error }, { status: 400 });
    fields.scope = verified.scope!;
  }
  // D10 — link this session to the event its readings were taken at. Any event in THIS season
  // qualifies (§10.2 ruling 2); `null` unlinks. The reader shaped the id; proving it sits on this
  // team's season schedule is the route's job. The link never derives the date — see below.
  if (fields.eventId) {
    const event = await getRepTeamEventById(fields.eventId);
    if (!event || event.teamId !== teamId || event.programYearId !== resolved.session.programYearId) {
      return NextResponse.json({ error: 'That event isn’t on this team’s schedule for this season.' }, { status: 400 });
    }
    fields.eventId = event.id;
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

  const session = await updateRepTeamEvaluationSession(sessionId, teamId, resolved.programYear.id, fields);

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
  const denied = denyUnless(canWriteDevelopment(resolved.assignment.capabilities), DEVELOPMENT_GRANT_MESSAGE);
  if (denied) return denied;

  // Entries survive (SET NULL → they become singles); only the grouping artifact goes.
  const deleted = await deleteRepTeamEvaluationSession(sessionId, teamId, resolved.programYear.id);
  if (!deleted) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/sessions/[sessionId]' });
