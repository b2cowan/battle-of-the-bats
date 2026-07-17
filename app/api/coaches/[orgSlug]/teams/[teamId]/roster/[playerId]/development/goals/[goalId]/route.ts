import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepRosterPlayer,
  updateRepPlayerDevelopmentGoal,
  deleteRepPlayerDevelopmentGoal,
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

  // A goal id from another player (even same team) must 404, not silently edit — enforced
  // by the player_id scope on the mutation query itself (awards precedent), no pre-fetch.
  return { ctx, player, assignment };
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; goalId: string }> },) => {
  const { orgSlug, teamId, playerId, goalId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, playerId);
  if ('error' in resolved) return resolved.error!;
  const denied = denyUnless(canWriteDevelopment(resolved.assignment.capabilities), 'Only the head coach can edit development.');
  if (denied) return denied;

  let body: { focusArea?: unknown; note?: unknown; status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const fields: { focusArea?: string; note?: string | null; status?: RepDevelopmentGoalStatus } = {};
  if (body.focusArea !== undefined) {
    const focusArea = typeof body.focusArea === 'string' ? body.focusArea.trim() : '';
    if (!focusArea || focusArea.length > 80) {
      return NextResponse.json({ error: 'Focus area is required (max 80 characters).' }, { status: 400 });
    }
    fields.focusArea = focusArea;
  }
  if (body.note !== undefined) {
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (note.length > 280) {
      return NextResponse.json({ error: 'Note is too long (max 280 characters).' }, { status: 400 });
    }
    fields.note = note || null;
  }
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !VALID_STATUSES.includes(body.status as RepDevelopmentGoalStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    fields.status = body.status as RepDevelopmentGoalStatus;
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const goal = await updateRepPlayerDevelopmentGoal(goalId, teamId, playerId, fields);
  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
  return NextResponse.json({ goal });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/goals/[goalId]' });

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; goalId: string }> },) => {
  const { orgSlug, teamId, playerId, goalId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, playerId);
  if ('error' in resolved) return resolved.error!;
  const denied = denyUnless(canWriteDevelopment(resolved.assignment.capabilities), 'Only the head coach can edit development.');
  if (denied) return denied;

  const deleted = await deleteRepPlayerDevelopmentGoal(goalId, teamId, playerId);
  if (!deleted) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/goals/[goalId]' });
