import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepRosterPlayer,
  deleteRepPlayerMeasurable,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteDevelopment } from '@/lib/coach-capabilities';

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; entryId: string }> },) => {
  const { orgSlug, teamId, playerId, entryId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const [assignments, player] = await Promise.all([
    getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id),
    getRepRosterPlayer(playerId),
  ]);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return forbidden();
  if (!player || player.teamId !== teamId || player.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can edit measurables.');
  if (denied) return denied;

  // The URL names the player — an entry id from another player 404s via the player_id
  // scope on the delete query itself (awards precedent), no ownership pre-fetch.
  const deleted = await deleteRepPlayerMeasurable(entryId, teamId, playerId);
  if (!deleted) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/measurables/[entryId]' });
