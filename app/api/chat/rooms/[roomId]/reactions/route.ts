import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { getMembership, getReactionsForMessages } from '@/lib/chat-service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ roomId: string }> };

// Bound the batch so a crafted request can't ask for an unbounded set (the loaded window is ≤ a few
// hundred messages in practice).
const MAX_IDS = 300;

/**
 * GET /api/chat/rooms/[roomId]/reactions?messageIds=a,b,c — the active-reaction summary (per message:
 * emoji → { count, mine }) for the given messages. The client calls this on first paint and as the
 * refresh-on-event signal when a reaction realtime event fires (the live payload is never trusted to
 * mutate counts). Room-scoped, so a messageId from another room contributes nothing.
 */
export const GET = withObservability(async (req: NextRequest, { params }: Params) => {
  const { roomId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const membership = await getMembership(roomId, user.id);
  if (!membership || membership.status === 'removed') return forbidden();

  const raw = new URL(req.url).searchParams.get('messageIds') ?? '';
  const messageIds = raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS);

  const reactions = await getReactionsForMessages(roomId, messageIds, user.id);
  return NextResponse.json({ reactions });
}, { route: '/api/chat/rooms/[roomId]/reactions' });
