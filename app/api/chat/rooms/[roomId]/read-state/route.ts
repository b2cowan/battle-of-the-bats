import { NextResponse } from 'next/server';
import { CHAT_PAUSED, CHAT_PAUSED_ERROR } from '@/lib/chat-pause';
import { getAuthenticatedUser, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { getMembership, getReadByCount } from '@/lib/chat-service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ roomId: string }> };

/**
 * GET /api/chat/rooms/[roomId]/read-state?since=<ISO> — aggregate "read by N of M" for the caller's
 * own message sent at `since`. Returns counts only (readBy / memberCount); the per-member "last seen"
 * is organizer-only (the roster). Any active member may read their own send's receipt.
 */
export const GET = withObservability(async (req: Request, { params }: Params) => {
  if (CHAT_PAUSED) return NextResponse.json({ error: CHAT_PAUSED_ERROR }, { status: 409 }); // ⚖ chat is paused (2026-10-18, ruling P8)
  const { roomId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const membership = await getMembership(roomId, user.id);
  if (!membership || membership.status === 'removed') return forbidden();

  const since = new URL(req.url).searchParams.get('since');
  if (!since || Number.isNaN(new Date(since).getTime())) {
    return NextResponse.json({ error: 'Missing or invalid since.' }, { status: 400 });
  }

  const result = await getReadByCount(roomId, user.id, since);
  return NextResponse.json(result);
}, { route: '/api/chat/rooms/[roomId]/read-state' });
