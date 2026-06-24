import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { castVote, ChatError } from '@/lib/chat-service';
import { FixedWindowRateLimiter } from '@/lib/rate-limit';

export const runtime = 'nodejs';

type Params = { params: Promise<{ roomId: string; messageId: string }> };

const MINUTE = 60_000;
const voteLimiter = new FixedWindowRateLimiter(MINUTE, 120);
const globalLimiter = new FixedWindowRateLimiter(MINUTE, 1200);

/**
 * POST /api/chat/rooms/[roomId]/polls/[messageId]/vote — cast / change / retract MY vote on a poll
 * option. Body: { optionId }. Routed server-side (the votes table is SELECT-only to browsers) so
 * membership / mute / poll-open / single-vs-multiple are enforced in code. Returns the recomputed tally.
 */
export const POST = withObservability(async (req: NextRequest, { params }: Params) => {
  const { roomId, messageId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  if (!voteLimiter.take(`u:${user.id}`) || !globalLimiter.take('global')) {
    return NextResponse.json({ error: 'You are voting too quickly. Please slow down.' }, { status: 429 });
  }

  const json = (await req.json().catch(() => ({}))) as { optionId?: unknown };
  const optionId = typeof json.optionId === 'string' ? json.optionId : '';
  if (!optionId) return NextResponse.json({ error: 'optionId required' }, { status: 400 });

  try {
    const { tally } = await castVote({ roomId, messageId, userId: user.id, optionId });
    return NextResponse.json({ tally });
  } catch (err) {
    if (err instanceof ChatError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    throw err;
  }
}, { route: '/api/chat/rooms/[roomId]/polls/[messageId]/vote' });
