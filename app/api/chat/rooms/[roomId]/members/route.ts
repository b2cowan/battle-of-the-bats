import { NextResponse } from 'next/server';
import { CHAT_PAUSED, CHAT_PAUSED_ERROR } from '@/lib/chat-pause';
import { getAuthenticatedUser, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { getMembership, getRoomMemberDirectory } from '@/lib/chat-service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ roomId: string }> };

/**
 * GET /api/chat/rooms/[roomId]/members — active-member directory (userId + display name) for the
 * @mention picker. Any active member may read it; names are the same already shown on messages.
 */
export const GET = withObservability(async (_req: Request, { params }: Params) => {
  if (CHAT_PAUSED) return NextResponse.json({ error: CHAT_PAUSED_ERROR }, { status: 409 }); // ⚖ chat is paused (2026-10-18, ruling P8)
  const { roomId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const membership = await getMembership(roomId, user.id);
  if (!membership || membership.status === 'removed') return forbidden();

  const members = await getRoomMemberDirectory(roomId);
  return NextResponse.json({ members });
}, { route: '/api/chat/rooms/[roomId]/members' });
