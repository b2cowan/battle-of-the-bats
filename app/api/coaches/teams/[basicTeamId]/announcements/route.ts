import { NextRequest, NextResponse } from 'next/server';
import { requireBasicCoachTeamOwner } from '@/lib/coach-team-guard';
import {
  BASIC_COACH_ANNOUNCEMENT_NO_RECIPIENTS_ERROR,
  BASIC_COACH_ANNOUNCEMENT_RATE_LIMIT_ERROR,
  BASIC_COACH_ANNOUNCEMENT_RECIPIENT_LIMIT_ERROR,
  getBasicCoachTeamAnnouncementRecipientSummary,
  getBasicCoachTeamAnnouncements,
  normalizeBasicCoachTeamAnnouncementBody,
  sendBasicCoachTeamAnnouncement,
} from '@/lib/basic-coach-announcements';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function authError(status: 401 | 403) {
  return status === 401
    ? json({ error: 'Sign in required.' }, 401)
    : json({ error: 'You do not have access to this team.' }, 403);
}

function validationError(error: unknown): string | null {
  const message = error instanceof Error ? error.message : '';
  return [
    'A subject is required.',
    'A message is required.',
    BASIC_COACH_ANNOUNCEMENT_NO_RECIPIENTS_ERROR,
    BASIC_COACH_ANNOUNCEMENT_RECIPIENT_LIMIT_ERROR,
    BASIC_COACH_ANNOUNCEMENT_RATE_LIMIT_ERROR,
  ].includes(message)
    ? message
    : null;
}

type RouteCtx = { params: Promise<{ basicTeamId: string }> };

/** List the recent one-way announcement log for an org-less Basic coach team (owner only). */
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  try {
    const { basicTeamId } = await params;
    if (!UUID_RE.test(basicTeamId)) return json({ error: 'Team not found.' }, 400);
    const guard = await requireBasicCoachTeamOwner(basicTeamId);
    if (!guard.ok) return authError(guard.status);

    const [announcements, recipientSummary] = await Promise.all([
      getBasicCoachTeamAnnouncements(basicTeamId),
      getBasicCoachTeamAnnouncementRecipientSummary(basicTeamId),
    ]);
    return json({ ok: true, announcements, recipientSummary });
  } catch (error) {
    console.error('[coaches announcements GET] error:', error);
    return json({ error: 'Could not load your announcements.' }, 500);
  }
}

/** Send a one-way announcement to current roster contact emails (owner only). */
export async function POST(req: NextRequest, { params }: RouteCtx) {
  try {
    const { basicTeamId } = await params;
    if (!UUID_RE.test(basicTeamId)) return json({ error: 'Team not found.' }, 400);
    const guard = await requireBasicCoachTeamOwner(basicTeamId);
    if (!guard.ok) return authError(guard.status);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { input, error } = normalizeBasicCoachTeamAnnouncementBody(body);
    if (error) return json({ error }, 400);
    if (!input.subject) return json({ error: 'A subject is required.' }, 400);
    if (!input.body) return json({ error: 'A message is required.' }, 400);

    const result = await sendBasicCoachTeamAnnouncement({
      basicCoachTeamId: basicTeamId,
      createdByUserId: guard.user.id,
      input,
    });
    return json({ ok: true, ...result });
  } catch (error) {
    const message = validationError(error);
    if (message) return json({ error: message }, 400);
    console.error('[coaches announcements POST] error:', error);
    return json({ error: 'Could not send the announcement.' }, 500);
  }
}
