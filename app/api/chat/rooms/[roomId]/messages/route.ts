import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import {
  getRoomById,
  getMembership,
  getRoomMessages,
  postChatMessage,
  ChatError,
} from '@/lib/chat-service';
import { FixedWindowRateLimiter } from '@/lib/rate-limit';

export const runtime = 'nodejs';

type Params = { params: Promise<{ roomId: string }> };

const MINUTE = 60_000;
// Per-sender throttle + a global backstop (best-effort, per-instance — see lib/rate-limit.ts).
const userLimiter = new FixedWindowRateLimiter(MINUTE, 30);
const globalLimiter = new FixedWindowRateLimiter(MINUTE, 600);

function mutedNow(mutedUntil: string | null): string | null {
  return mutedUntil && new Date(mutedUntil) > new Date() ? mutedUntil : null;
}

/**
 * GET — paginated message history (oldest-first window). The UI loads history HERE, then treats
 * realtime INSERTs as post-connection updates (the SUBSCRIBED-≠-streaming race lesson). Membership
 * is the access key (org-agnostic), matching the engine's RLS.
 */
export const GET = withObservability(async (req: NextRequest, { params }: Params) => {
  const { roomId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const room = await getRoomById(roomId);
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const membership = await getMembership(roomId, user.id);
  if (!membership || membership.status === 'removed') return forbidden();

  const url = new URL(req.url);
  const before = url.searchParams.get('before');
  const limit = Number(url.searchParams.get('limit')) || 50;
  const { messages, participants, hasMore } = await getRoomMessages(roomId, { before, limit });

  return NextResponse.json({
    room: { id: room.id, name: room.name, isArchived: room.isArchived },
    self: {
      userId: user.id,
      isModerator: membership.member_role === 'moderator',
      mutedUntil: mutedNow(membership.muted_until),
    },
    messages,
    participants,
    hasMore,
  });
}, { route: '/api/chat/rooms/[roomId]/messages' });

/**
 * POST — send a message. Routed server-side (not a direct client INSERT) so we attach notifications,
 * rate-limits, and mute/closed enforcement. The service layer enforces archived/removed/muted.
 */
export const POST = withObservability(async (req: NextRequest, { params }: Params) => {
  const { roomId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  if (!userLimiter.take(`u:${user.id}`) || !globalLimiter.take('global')) {
    return NextResponse.json(
      { error: 'You are sending messages too quickly. Please slow down.' },
      { status: 429 },
    );
  }

  const json = (await req.json().catch(() => ({}))) as { body?: unknown };
  const text = typeof json.body === 'string' ? json.body : '';

  try {
    const message = await postChatMessage({ roomId, senderUserId: user.id, body: text });
    return NextResponse.json({ message });
  } catch (err) {
    if (err instanceof ChatError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
}, { route: '/api/chat/rooms/[roomId]/messages' });
