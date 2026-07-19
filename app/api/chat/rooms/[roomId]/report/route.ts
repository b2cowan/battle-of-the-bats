import { NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { ChatError, createMessageReport } from '@/lib/chat-service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ roomId: string }> };

/**
 * POST /api/chat/rooms/[roomId]/report — a member reports a message (long-press → "Report to
 * organizers"; Unified Home R3-2). Body: { messageId }. The report lands in the organizer's existing
 * chat Manage-room queue. Idempotent — reporting the same message twice is a no-op. createMessageReport
 * verifies room membership + that the message belongs to the room (and blocks reporting your own).
 */
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const { roomId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as { messageId?: unknown };
  const messageId = typeof body.messageId === 'string' ? body.messageId : '';
  if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 });

  try {
    const result = await createMessageReport({ roomId, messageId, reporterUserId: user.id });
    return NextResponse.json({ ok: true, alreadyReported: result === 'exists' });
  } catch (err) {
    if (err instanceof ChatError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    throw err;
  }
}, { route: '/api/chat/rooms/[roomId]/report' });
