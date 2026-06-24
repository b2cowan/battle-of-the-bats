import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { getMembership, createPoll, getPollTallies, ChatError } from '@/lib/chat-service';
import { FixedWindowRateLimiter } from '@/lib/rate-limit';

export const runtime = 'nodejs';

type Params = { params: Promise<{ roomId: string }> };

const MINUTE = 60_000;
const createLimiter = new FixedWindowRateLimiter(MINUTE, 20); // poll creation is rare; a low cap is fine
const MAX_IDS = 300;

/**
 * POST /api/chat/rooms/[roomId]/polls — create a poll (organizer only; enforced in createPoll). Body:
 * { question, options: string[], multiple }. A poll is a chat message, so it appears live in the
 * stream via the existing message realtime. Returns { message } (the poll message view).
 */
export const POST = withObservability(async (req: NextRequest, { params }: Params) => {
  const { roomId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  if (!createLimiter.take(`u:${user.id}`)) {
    return NextResponse.json({ error: 'You are creating polls too quickly.' }, { status: 429 });
  }

  const json = (await req.json().catch(() => ({}))) as { question?: unknown; options?: unknown; multiple?: unknown };
  const question = typeof json.question === 'string' ? json.question : '';
  const options = Array.isArray(json.options) ? json.options.filter((v): v is string => typeof v === 'string') : [];
  const multiple = json.multiple === true;

  try {
    const message = await createPoll({ roomId, byUserId: user.id, question, options, multiple });
    return NextResponse.json({ message });
  } catch (err) {
    if (err instanceof ChatError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    throw err;
  }
}, { route: '/api/chat/rooms/[roomId]/polls' });

/**
 * GET /api/chat/rooms/[roomId]/polls?messageIds=a,b,c — the active-vote tallies (per poll: option →
 * { count, mine }) for the given poll messages. Used on first paint + as the realtime refresh signal.
 * Room-scoped, so a messageId from another room contributes nothing.
 */
export const GET = withObservability(async (req: NextRequest, { params }: Params) => {
  const { roomId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const membership = await getMembership(roomId, user.id);
  if (!membership || membership.status === 'removed') return forbidden();

  const raw = new URL(req.url).searchParams.get('messageIds') ?? '';
  const messageIds = raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS);

  const tallies = await getPollTallies(roomId, messageIds, user.id);
  return NextResponse.json({ tallies });
}, { route: '/api/chat/rooms/[roomId]/polls' });
