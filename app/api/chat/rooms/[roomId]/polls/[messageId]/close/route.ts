import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { setPollClosed, ChatError } from '@/lib/chat-service';
import { FixedWindowRateLimiter } from '@/lib/rate-limit';

export const runtime = 'nodejs';

type Params = { params: Promise<{ roomId: string; messageId: string }> };

// Close/reopen flips a message (a realtime broadcast to the whole room); cap it so a stuck/abusive
// client can't fan out unbounded UPDATEs. Generous — real use is a handful per poll.
const closeLimiter = new FixedWindowRateLimiter(60_000, 60);

/**
 * POST /api/chat/rooms/[roomId]/polls/[messageId]/close — close (or reopen) a poll. Organizer only
 * (enforced in setPollClosed). Body: { closed } (defaults to true = close). Closing flips the poll's
 * state on the message, which propagates live on the existing message realtime.
 */
export const POST = withObservability(async (req: NextRequest, { params }: Params) => {
  const { roomId, messageId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  if (!closeLimiter.take(`u:${user.id}`)) {
    return NextResponse.json({ error: 'Too many changes. Please slow down.' }, { status: 429 });
  }

  const json = (await req.json().catch(() => ({}))) as { closed?: unknown };
  const closed = json.closed !== false; // default: close

  try {
    await setPollClosed({ roomId, messageId, byUserId: user.id, closed });
    return NextResponse.json({ ok: true, closed });
  } catch (err) {
    if (err instanceof ChatError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    throw err;
  }
}, { route: '/api/chat/rooms/[roomId]/polls/[messageId]/close' });
