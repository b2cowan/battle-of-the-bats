import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getRepTeamEvaluationSessions,
  createRepTeamEvaluationSession,
  getRepTeamMeasurableTypes,
  getRepRosterPlayers,
  getRepTeamEvents,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import { denyUnless, canViewMeasurables, canWriteDevelopment, redactRoster, DEVELOPMENT_GRANT_MESSAGE } from '@/lib/coach-capabilities';
import { isMeasuredTest } from '@/lib/measurable-definition';
import { readSessionCreateInput } from '@/lib/development-input';
import { verifySessionScope } from '@/lib/development-session-scope';

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
  // Season-scoped (Chunk F). This route used to resolve the ACTIVE year unconditionally while
  // the Development page happily rendered a "2025 · Complete" chip above it — the archive said
  // one season and the data was another. `?year=` now decides, and the capability gate reads
  // that season's own grants.
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { programYear, capabilities, isReadOnly } = resolved;

  // The sessions list is Skills & Goals' own room: it opens with the Development grant only
  // (stage 0, D5, 2026-09-14) — the read-only listing record access used to get is gone with the door.
  const denied = denyUnless(canWriteDevelopment(capabilities), DEVELOPMENT_GRANT_MESSAGE);
  if (denied) return denied;

  const canWrite = !isReadOnly && canWriteDevelopment(capabilities);
  const [sessions, types, players, events] = await Promise.all([
    getRepTeamEvaluationSessions(programYear.id),
    getRepTeamMeasurableTypes(teamId, { includeRetired: true }),
    // The scope step (Phase 2): who is here — the active roster, identity only — and the season's
    // events for "Taken at". Only for a writer; a reader has no Start session to open.
    canWrite ? getRepRosterPlayers(programYear.id) : Promise.resolve([]),
    canWrite ? getRepTeamEvents(programYear.id) : Promise.resolve([]),
  ]);
  const roster = redactRoster(
    players.filter(p => p.status === 'active').map(p => ({
      id: p.id, playerFirstName: p.playerFirstName, playerLastName: p.playerLastName, playerNumber: p.playerNumber,
    })),
    capabilities,
  );
  // A finished season can never be written to, whatever the grant says — the client uses this
  // flag to decide whether to draw "Start session".
  return NextResponse.json({
    sessions, types,
    roster,
    events: events.map(e => ({ id: e.id, name: e.name, eventType: e.eventType, startsAt: e.startsAt })),
    canWrite,
    isReadOnly,
  });
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
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), DEVELOPMENT_GRANT_MESSAGE);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const read = readSessionCreateInput(body);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });
  const { sessionDate, note, eventId, scope } = read.fields;

  if (!programYear) {
    return NextResponse.json({ error: 'No active program year for this team' }, { status: 404 });
  }

  // The dead-end guard (hub restructure D1, 2026-07-31): a session with nothing to record
  // records nothing, so it must not be creatable. The hub already holds its button back in
  // this state, but the honest prerequisite belongs on the write path too — the old UI let
  // the click through and landed the coach on an empty session screen.
  // ACTIVE metrics only: an all-retired list leaves the session picker empty just the same. A
  // measured test is required (a skill alone has nothing a session's grid can take a number for;
  // an observation can still be recorded beside the tests).
  const activeTypes = await getRepTeamMeasurableTypes(teamId, { includeRetired: false });
  if (activeTypes.filter(isMeasuredTest).length === 0) {
    return NextResponse.json(
      { error: 'Add at least one test to your list before running a session — a session with nothing to measure records nothing.' },
      { status: 400 },
    );
  }

  // The plan's ids are NAMED by the client and PROVED here (/dba Finding #41 item 3): every metric
  // is one of this team's active definitions, every player a row of this season's active roster,
  // every count 1..5 on a test in the plan. The event, likewise, must sit on this team's season
  // schedule (the PATCH's rule, reused).
  const verified = await verifySessionScope({ teamId, programYearId: programYear.id, scope, eventId, activeTypes });
  if ('error' in verified) return NextResponse.json({ error: verified.error }, { status: 400 });

  const session = await createRepTeamEvaluationSession({
    orgId: ctx.org.id,
    teamId,
    programYearId: programYear.id,
    // "When?" is one question (re-evaluation stage 2, C10): at a practice, the session's date IS the
    // practice's day — derived here, whatever the client sent beside the link; on a date, the typed one.
    sessionDate: verified.eventDay ?? sessionDate,
    note,
    eventId: verified.eventId,
    scope: verified.scope,
    createdBy: ctx.user.id,
  });
  return NextResponse.json({ session }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/sessions' });
