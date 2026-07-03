import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getRepTryoutSessionById,
  updateRepTryoutSession,
  deleteRepTryoutSession,
} from '@/lib/db';
import { denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';
import type { RepTryoutSession } from '@/lib/types';

type Owned = { ok: false; res: Response } | { ok: true; session: RepTryoutSession; assignment: Awaited<ReturnType<typeof getCoachingAssignmentsForUser>>[number] };

/** Authorize the assigned coach and confirm the session belongs to this org + the path team. */
async function resolveOwned(orgSlug: string, teamId: string, sessionId: string): Promise<Owned> {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { ok: false, res: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { ok: false, res: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { ok: false, res: forbidden() };

  const session = await getRepTryoutSessionById(sessionId);
  if (!session || session.orgId !== ctx.org.id || session.teamId !== teamId) {
    return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return { ok: true, session, assignment };
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; sessionId: string }> },) => {
  const { orgSlug, teamId, sessionId } = await params;
  const owned = await resolveOwned(orgSlug, teamId, sessionId);
  if (!owned.ok) return owned.res;
  const denied = denyUnless(owned.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (body.startsAt !== undefined) {
    if (isNaN(new Date(body.startsAt).getTime())) {
      return NextResponse.json({ errors: { startsAt: 'A valid date and time is required' } }, { status: 400 });
    }
    // Store the naive wall-clock string as-is (matches rep_team_events) — no UTC conversion.
    patch.startsAt = body.startsAt;
  }
  if (body.endsAt !== undefined) patch.endsAt = body.endsAt || null;
  if (body.location !== undefined) patch.location = body.location?.trim() || null;
  if (body.locationAddress !== undefined) patch.locationAddress = body.locationAddress?.trim() || null;
  if (body.fieldNumber !== undefined) patch.fieldNumber = body.fieldNumber?.trim() || null;
  if (body.label !== undefined) patch.label = body.label?.trim() || null;
  if (body.status === 'scheduled' || body.status === 'cancelled') patch.status = body.status;

  const session = await updateRepTryoutSession(sessionId, patch);
  return NextResponse.json({ session });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-sessions/[sessionId]' });

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; sessionId: string }> },) => {
  const { orgSlug, teamId, sessionId } = await params;
  const owned = await resolveOwned(orgSlug, teamId, sessionId);
  if (!owned.ok) return owned.res;
  const denied = denyUnless(owned.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  await deleteRepTryoutSession(sessionId);
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-sessions/[sessionId]' });
