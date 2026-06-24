import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { getMembership, getPollVoters } from '@/lib/chat-service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ roomId: string; messageId: string }> };

/**
 * GET /api/chat/rooms/[roomId]/polls/[messageId]/voters?optionId=X — the coaches who voted that
 * option (names), for the "who voted" view (polls are visible-voter per the owner decision). Any active
 * member may read; room-scoped so a messageId/option from another room returns nothing.
 */
export const GET = withObservability(async (req: NextRequest, { params }: Params) => {
  const { roomId, messageId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const membership = await getMembership(roomId, user.id);
  if (!membership || membership.status === 'removed') return forbidden();

  const optionId = new URL(req.url).searchParams.get('optionId') ?? '';
  if (!optionId) return NextResponse.json({ voters: [] });

  const voters = await getPollVoters({ roomId, messageId, optionId });
  return NextResponse.json({ voters });
}, { route: '/api/chat/rooms/[roomId]/polls/[messageId]/voters' });
