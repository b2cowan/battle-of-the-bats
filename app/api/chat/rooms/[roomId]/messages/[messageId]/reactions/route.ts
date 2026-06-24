import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { getMembership, toggleReaction, getReactionReactors, ChatError } from '@/lib/chat-service';
import { isReactionEmoji } from '@/lib/chat-reactions';
import { FixedWindowRateLimiter } from '@/lib/rate-limit';

export const runtime = 'nodejs';

type Params = { params: Promise<{ roomId: string; messageId: string }> };

const MINUTE = 60_000;
// A reaction is one tap; a generous per-user cap stops a stuck client / abuse without ever throttling
// normal use. Best-effort, per-instance (see lib/rate-limit.ts), mirroring the message route.
const userLimiter = new FixedWindowRateLimiter(MINUTE, 120);
const globalLimiter = new FixedWindowRateLimiter(MINUTE, 1200);

/**
 * POST /api/chat/rooms/[roomId]/messages/[messageId]/reactions — toggle the caller's reaction.
 * Body: { emoji }. Routed server-side (the table is SELECT-only to browsers) so membership / mute /
 * archived / rate-limit are enforced in code. Soft-delete toggle: tapping the same emoji again removes
 * it. Returns { reacted, reactions } where reactions is the message's authoritative summary.
 */
export const POST = withObservability(async (req: NextRequest, { params }: Params) => {
  const { roomId, messageId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  if (!userLimiter.take(`u:${user.id}`) || !globalLimiter.take('global')) {
    return NextResponse.json({ error: 'You are reacting too quickly. Please slow down.' }, { status: 429 });
  }

  const json = (await req.json().catch(() => ({}))) as { emoji?: unknown };
  if (!isReactionEmoji(json.emoji)) {
    return NextResponse.json({ error: 'Unsupported reaction.' }, { status: 400 });
  }

  try {
    const { reacted, summary } = await toggleReaction({ roomId, messageId, userId: user.id, emoji: json.emoji });
    return NextResponse.json({ reacted, reactions: summary });
  } catch (err) {
    if (err instanceof ChatError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
}, { route: '/api/chat/rooms/[roomId]/messages/[messageId]/reactions' });

/**
 * GET /api/chat/rooms/[roomId]/messages/[messageId]/reactions?emoji=X — the coaches who reacted with
 * that emoji (names), for the "who reacted" popover. Any active member may read; room-scoped so a
 * messageId from another room returns nothing.
 */
export const GET = withObservability(async (req: NextRequest, { params }: Params) => {
  const { roomId, messageId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const membership = await getMembership(roomId, user.id);
  if (!membership || membership.status === 'removed') return forbidden();

  const emoji = new URL(req.url).searchParams.get('emoji') ?? '';
  if (!isReactionEmoji(emoji)) return NextResponse.json({ reactors: [] });

  const reactors = await getReactionReactors({ roomId, messageId, emoji });
  return NextResponse.json({ reactors });
}, { route: '/api/chat/rooms/[roomId]/messages/[messageId]/reactions' });
