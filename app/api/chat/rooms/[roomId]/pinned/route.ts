import { NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { getMembership, getPinnedMessages } from '@/lib/chat-service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ roomId: string }> };

/**
 * GET /api/chat/rooms/[roomId]/pinned — the room's currently-pinned messages (for the pinned banner).
 * Any active member may read them; pinning/unpinning is organizer-only (the admin moderation route).
 */
export const GET = withObservability(async (_req: Request, { params }: Params) => {
  const { roomId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const membership = await getMembership(roomId, user.id);
  if (!membership || membership.status === 'removed') return forbidden();

  const pinned = await getPinnedMessages(roomId);
  return NextResponse.json({ pinned });
}, { route: '/api/chat/rooms/[roomId]/pinned' });
