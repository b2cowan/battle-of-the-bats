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
import { readMeasurableInput } from '@/lib/development-input';
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
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can log measurables.');
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const read = readMeasurableInput(body);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });
  const { measurableTypeId, value, recordedOn, note } = read.fields;

  // Must be this TEAM's type and ACTIVE — a retired type can't take new entries (it keeps
  // resolving for past ones), and another team's type id must not slip through.
  const types = await getRepTeamMeasurableTypes(teamId);
  const type = types.find(t => t.id === measurableTypeId);
  if (!type) {
    return NextResponse.json({ error: 'Pick an active measurable type for this team.' }, { status: 400 });
  }

  // Optional evaluation-session tag (3B) — must be THIS team's session AND the same season
  // as the player row (a prior-season session id must not attach to a current reading; the
  // player row is season-scoped, so its program_year_id is the parity anchor).
  let sessionId: string | null = null;
  if (read.fields.sessionId) {
    // The season is now part of the LOOKUP rather than a check after it (2026-08-15) — the same
    // rule, moved to where it cannot be forgotten. The comparison below is kept as the belt: the
    // parity anchor is the PLAYER's season, and stating it twice costs nothing.
    const session = await getRepTeamEvaluationSession(read.fields.sessionId, teamId, resolved.player.programYearId);
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
      note,
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
