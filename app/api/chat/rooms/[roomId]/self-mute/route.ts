import { NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { ChatError, setSelfMute } from '@/lib/chat-service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ roomId: string }> };

/**
 * POST /api/chat/rooms/[roomId]/self-mute — the member's OWN "Mute this room" toggle (Unified Home
 * R3-2). Body: { muted: boolean }. Distinct from the organizer mute: this silences pushes + drops the
 * room from unread counts, but the member keeps read + post access. setSelfMute verifies membership.
 */
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const { roomId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as { muted?: unknown };
  const muted = body.muted === true;

  try {
    const result = await setSelfMute({ roomId, userId: user.id, muted });
    return NextResponse.json({ ok: true, muted: result.muted });
  } catch (err) {
    if (err instanceof ChatError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    throw err;
  }
}, { route: '/api/chat/rooms/[roomId]/self-mute' });
