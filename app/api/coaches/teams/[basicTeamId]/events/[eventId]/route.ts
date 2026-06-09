import { NextRequest, NextResponse } from 'next/server';
import { requireBasicCoachTeamOwner } from '@/lib/coach-team-guard';
import {
  updateBasicCoachTeamEvent,
  deleteBasicCoachTeamEvent,
  normalizeBasicCoachTeamEventBody,
} from '@/lib/basic-coach-schedule';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function authError(status: 401 | 403) {
  return status === 401
    ? json({ error: 'Sign in required.' }, 401)
    : json({ error: 'You do not have access to this team.' }, 403);
}

type RouteCtx = { params: Promise<{ basicTeamId: string; eventId: string }> };

/** Edit an event (partial — only provided fields are written; owner only). */
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  try {
    const { basicTeamId, eventId } = await params;
    const guard = await requireBasicCoachTeamOwner(basicTeamId);
    if (!guard.ok) return authError(guard.status);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { input, error } = normalizeBasicCoachTeamEventBody(body);
    if (error) return json({ error }, 400);

    const event = await updateBasicCoachTeamEvent({ eventId, basicCoachTeamId: basicTeamId, input });
    if (!event) return json({ error: 'Event not found.' }, 404);
    return json({ ok: true, event });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'An event title is required.') return json({ error: message }, 400);
    console.error('[coaches events PATCH] error:', error);
    return json({ error: 'Could not update the event.' }, 500);
  }
}

/** Remove an event from the schedule (owner only). */
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  try {
    const { basicTeamId, eventId } = await params;
    const guard = await requireBasicCoachTeamOwner(basicTeamId);
    if (!guard.ok) return authError(guard.status);

    const removed = await deleteBasicCoachTeamEvent({ eventId, basicCoachTeamId: basicTeamId });
    if (!removed) return json({ error: 'Event not found.' }, 404);
    return json({ ok: true });
  } catch (error) {
    console.error('[coaches events DELETE] error:', error);
    return json({ error: 'Could not remove the event.' }, 500);
  }
}
