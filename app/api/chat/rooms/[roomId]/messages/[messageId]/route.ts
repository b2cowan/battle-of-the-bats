import { NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { getMembership, deleteOwnMessage } from '@/lib/chat-service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ roomId: string; messageId: string }> };

/**
 * DELETE /api/chat/rooms/[roomId]/messages/[messageId] — retract YOUR OWN message (soft-delete).
 * Ownership is enforced server-side (deleteOwnMessage checks sender_user_id === caller). Moderator
 * deletion of anyone's message goes through the admin moderation route, not here.
 */
export const DELETE = withObservability(async (_req: Request, { params }: Params) => {
  const { roomId, messageId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const membership = await getMembership(roomId, user.id);
  if (!membership || membership.status === 'removed') return forbidden();
  // A mute is a moderation action — a muted member must not be able to scrub their own posts
  // (evasion), consistent with their composer being disabled.
  if (membership.muted_until && new Date(membership.muted_until) > new Date()) return forbidden();

  const result = await deleteOwnMessage({ roomId, messageId, userId: user.id });
  if (result === 'not_found') return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
  if (result === 'forbidden') return forbidden();
  return NextResponse.json({ ok: true });
}, { route: '/api/chat/rooms/[roomId]/messages/[messageId]' });
