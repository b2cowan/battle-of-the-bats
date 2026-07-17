import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepRosterPlayer,
  createRepPlayerDevelopmentGoal,
} from '@/lib/db';
import type { RepDevelopmentGoalStatus } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteDevelopment } from '@/lib/coach-capabilities';

const VALID_STATUSES: RepDevelopmentGoalStatus[] = ['working', 'achieved', 'parked'];

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
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can edit development.');
  if (denied) return denied;

  let body: { focusArea?: unknown; note?: unknown; status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const focusArea = typeof body.focusArea === 'string' ? body.focusArea.trim() : '';
  if (!focusArea || focusArea.length > 80) {
    return NextResponse.json({ error: 'Focus area is required (max 80 characters).' }, { status: 400 });
  }
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (note.length > 280) {
    return NextResponse.json({ error: 'Note is too long (max 280 characters).' }, { status: 400 });
  }
  const status = (typeof body.status === 'string' ? body.status : 'working') as RepDevelopmentGoalStatus;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const goal = await createRepPlayerDevelopmentGoal({
    orgId: ctx.org.id,
    teamId,
    playerId,
    focusArea,
    note: note || null,
    status,
    createdBy: ctx.user.id,
  });
  return NextResponse.json({ goal }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/goals' });
