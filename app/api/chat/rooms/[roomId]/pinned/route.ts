import { NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import {
  getMembership,
  getPinnedMessages,
  getRoomById,
  isCoachPeerRoom,
  isMessageVisibleToMember,
  setPinned,
} from '@/lib/chat-service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ roomId: string }> };

/**
 * GET /api/chat/rooms/[roomId]/pinned — the room's currently-pinned messages (for the pinned banner).
 * Any active member may read them; a pin whose message predates the caller's history watermark is
 * omitted (mig 208 — you can't be shown a spotlight on a message you can't see).
 */
export const GET = withObservability(async (_req: Request, { params }: Params) => {
  const { roomId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const membership = await getMembership(roomId, user.id);
  if (!membership || membership.status === 'removed') return forbidden();

  const pinned = await getPinnedMessages(roomId, membership.history_visible_from);
  return NextResponse.json({ pinned });
}, { route: '/api/chat/rooms/[roomId]/pinned' });

/**
 * POST /api/chat/rooms/[roomId]/pinned — pin/unpin a message as the room's own moderator.
 * COACH_PEER rooms only (Project 2A): their moderator (the head coach today; the org-wide 2B
 * room's moderator later) has no admin surface. Tournament rooms keep their organizer-only admin
 * route (which carries the org plan gate) — this route refuses them so it can never become a side
 * door around that gate.
 */
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const { roomId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  // Membership FIRST (review hardening): a non-member must learn nothing about the room — not its
  // existence, surface, or archived state — from this route's response shape.
  const membership = await getMembership(roomId, user.id);
  if (!membership || membership.status !== 'active' || membership.member_role !== 'moderator') {
    return forbidden();
  }

  const room = await getRoomById(roomId);
  if (!room || !isCoachPeerRoom(room)) return forbidden();
  if (room.isArchived) return NextResponse.json({ error: 'This conversation is closed.' }, { status: 403 });

  const json = (await req.json().catch(() => ({}))) as { messageId?: unknown; pinned?: unknown };
  const messageId = typeof json.messageId === 'string' ? json.messageId : null;
  if (!messageId) return NextResponse.json({ error: 'messageId is required.' }, { status: 400 });

  // Moderate only what you can see (approved spec): a watermarked moderator cannot pin/unpin a
  // pre-join message. Same 404-vs-403 contract as the sibling delete route.
  const visible = await isMessageVisibleToMember(roomId, messageId, membership.history_visible_from);
  if (visible === 'not_found') return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
  if (!visible) return forbidden();

  await setPinned({ roomId, messageId, byUserId: user.id, pinned: json.pinned !== false });
  return NextResponse.json({ ok: true });
}, { route: '/api/chat/rooms/[roomId]/pinned' });
