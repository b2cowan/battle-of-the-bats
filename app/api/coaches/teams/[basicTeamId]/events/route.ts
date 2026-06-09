import { NextRequest, NextResponse } from 'next/server';
import { requireBasicCoachTeamOwner } from '@/lib/coach-team-guard';
import {
  getBasicCoachTeamEvents,
  createBasicCoachTeamEvent,
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

type RouteCtx = { params: Promise<{ basicTeamId: string }> };

/** List the schedule for an org-less Basic coach team (owner only). */
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  try {
    const { basicTeamId } = await params;
    const guard = await requireBasicCoachTeamOwner(basicTeamId);
    if (!guard.ok) return authError(guard.status);

    const events = await getBasicCoachTeamEvents(basicTeamId);
    return json({ ok: true, events });
  } catch (error) {
    console.error('[coaches events GET] error:', error);
    return json({ error: 'Could not load your schedule.' }, 500);
  }
}

/** Add a practice/game to the schedule (owner only). */
export async function POST(req: NextRequest, { params }: RouteCtx) {
  try {
    const { basicTeamId } = await params;
    const guard = await requireBasicCoachTeamOwner(basicTeamId);
    if (!guard.ok) return authError(guard.status);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { input, error } = normalizeBasicCoachTeamEventBody(body);
    if (error) return json({ error }, 400);
    if (!input.title) return json({ error: 'An event title is required.' }, 400);
    if (!input.startsAt) return json({ error: 'A valid start date/time is required.' }, 400);

    const event = await createBasicCoachTeamEvent({
      basicCoachTeamId: basicTeamId,
      createdByUserId: guard.user.id,
      input,
    });
    return json({ ok: true, event });
  } catch (error) {
    console.error('[coaches events POST] error:', error);
    return json({ error: 'Could not add the event.' }, 500);
  }
}
