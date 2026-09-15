import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepRosterPlayer,
  getRepTeamMeasurableTypes,
  getRepTeamEvaluationSession,
  getRepPlayerMeasurablesForPlayer,
  createRepPlayerMeasurable,
  unmarkRepSessionNotAssessed,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteDevelopment, DEVELOPMENT_GRANT_MESSAGE } from '@/lib/coach-capabilities';
import { readMeasurableInput, MAX_ATTEMPTS } from '@/lib/development-input';
import { isMeasuredTest } from '@/lib/measurable-definition';
import { pastSeasonRefusal } from '@/lib/development-season-guard';

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

  // Year-scope guard (Batch 3 rider): a measurable attaches to a roster ROW, which is
  // season-scoped — only the ACTIVE season's rows may take new readings. ONE shared rule since
  // F04 (2026-09-11), so the delete refuses the same row the same way. Cross-season carry has
  // its own route.
  const past = pastSeasonRefusal(player, assignment);
  if (past) return { error: NextResponse.json({ error: past.error }, { status: past.status }) };

  return { ctx, player, assignment };
}

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, playerId);
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

  const read = readMeasurableInput(body);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });
  const { measurableTypeId, value, recordedOn, note, sessionId: requestedSessionId, attemptNo } = read.fields;

  // Must be this TEAM's type and ACTIVE — a retired type can't take new entries (it keeps
  // resolving for past ones), and another team's type id must not slip through.
  const types = await getRepTeamMeasurableTypes(teamId);
  const type = types.find(t => t.id === measurableTypeId);
  if (!type) {
    return NextResponse.json({ error: 'Pick an active test for this team.' }, { status: 400 });
  }
  // A number is a TEST's record. An observed skill is a definition in Phase 1; recording an
  // observation against it is Phase 2, and a value filed under a skill would be a fabricated score.
  if (!isMeasuredTest(type)) {
    return NextResponse.json({ error: 'A skill takes an observation, not a number — record one from the skill’s chip on a session, or from a goal on the player’s record.' }, { status: 400 });
  }
  // How many attempts a row takes is the SESSION's plan, and the plan is a floor, never a ceiling
  // (re-evaluation stage 2, C1/C2, 2026-09-15): a row may run one more with the "+", up to five.
  // The reader holds the five; the definition's stored count no longer bounds anything. A single
  // result outside a session is always attempt 1 (the reader).

  // Optional evaluation-session tag (3B) — must be THIS team's session AND the same season
  // as the player row (a prior-season session id must not attach to a current reading; the
  // player row is season-scoped, so its program_year_id is the parity anchor).
  let sessionId: string | null = null;
  if (requestedSessionId) {
    // The season is now part of the LOOKUP rather than a check after it (2026-08-15) — the same
    // rule, moved to where it cannot be forgotten. The comparison below is kept as the belt: the
    // parity anchor is the PLAYER's season, and stating it twice costs nothing.
    const session = await getRepTeamEvaluationSession(requestedSessionId, teamId, resolved.player.programYearId);
    if (!session || session.programYearId !== resolved.player.programYearId) {
      return NextResponse.json({ error: 'Session not found for this team and season.' }, { status: 400 });
    }
    sessionId = session.id;
  }

  // Outside a session the attempts are the DAY's (re-evaluation stage 3, E7): a result recorded
  // later the same day for the same test JOINS that day's result — the attempt takes the next free
  // number rather than a twin of one already there (the database's per-attempt uniqueness covers
  // sessions only; mig 295's index is partial), and a day already holding five refuses. The reader
  // sorts a day's attempts by this number, so it must stay unique; the sheet reads them by their
  // order, so a legacy day with two "attempt 1" singles still shows both. Two coaches inside the
  // same second can still pass this read (/review 2026-09-15 — a partial unique index would close
  // it for good; the row lists, and Remove result takes it with the rest).
  let dayAttemptNo = attemptNo;
  if (!sessionId) {
    const taken = (await getRepPlayerMeasurablesForPlayer(playerId))
      .filter(m => m.sessionId === null && m.measurableTypeId === measurableTypeId && m.recordedOn === recordedOn)
      .map(m => m.attemptNo);
    if (taken.includes(attemptNo)) {
      const next = Math.max(...taken) + 1;
      if (next > MAX_ATTEMPTS) {
        return NextResponse.json({ error: `That day already holds ${MAX_ATTEMPTS} attempts for this test — open the result and edit it there.` }, { status: 400 });
      }
      dayAttemptNo = next;
    }
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
      note,
      sessionId,
      attemptNo: dayAttemptNo,
      createdBy: ctx.user.id,
    });
    // A value on the cell IS the assessment — a "not assessed" mark left beside it (marked on
    // another device before this value landed) would contradict the record.
    if (sessionId) await unmarkRepSessionNotAssessed(sessionId, teamId, playerId, measurableTypeId);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error: unknown) {
    // Partial unique (session, player, test, ATTEMPT) — one reading per attempt (mig 295). A
    // duplicate is a retry that already landed, or two devices on one row: the screen reloads the
    // row rather than writing a second copy.
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'That attempt is already saved for this player in this session — reload the row to see it.' }, { status: 409 });
    }
    throw error;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/measurables' });
