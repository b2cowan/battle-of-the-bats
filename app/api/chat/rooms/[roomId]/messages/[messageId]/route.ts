import { NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import {
  getMembership,
  deleteOwnMessage,
  getRoomById,
  isCoachPeerRoom,
  isMessageVisibleToMember,
  softDeleteMessage,
} from '@/lib/chat-service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ roomId: string; messageId: string }> };

/**
 * DELETE /api/chat/rooms/[roomId]/messages/[messageId] — retract YOUR OWN message (soft-delete).
 * Ownership is enforced server-side (deleteOwnMessage checks sender_user_id === caller).
 *
 * Project 2A: in a COACH_PEER room, the room's own moderator (the head coach today; the org-wide
 * 2B room's moderator later) may remove ANY visible message — those rooms have no admin surface,
 * so their moderation lives here. Tournament rooms are deliberately excluded: their moderator
 * delete stays on the org-plan-gated admin route.
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

  if (membership.member_role === 'moderator' && membership.status === 'active') {
    const room = await getRoomById(roomId);
    if (room && isCoachPeerRoom(room)) {
      // Read-only means read-only (CH-1): no moderation in an archived room — matching the pin
      // route. A member's own-delete below is likewise blocked by the closed room's posting rules
      // being moot; deleting is a mutation, so refuse it here for moderators explicitly.
      if (room.isArchived) return NextResponse.json({ error: 'This conversation is closed.' }, { status: 403 });
      // Moderate only what you can see (approved spec): a watermarked moderator cannot remove a
      // pre-join message.
      const visible = await isMessageVisibleToMember(roomId, messageId, membership.history_visible_from);
      if (visible === 'not_found') return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
      if (!visible) return forbidden();
      await softDeleteMessage({ roomId, messageId, byUserId: user.id });
      return NextResponse.json({ ok: true });
    }
  }

  const result = await deleteOwnMessage({ roomId, messageId, userId: user.id });
  if (result === 'not_found') return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
  if (result === 'forbidden') return forbidden();
  return NextResponse.json({ ok: true });
}, { route: '/api/chat/rooms/[roomId]/messages/[messageId]' });
