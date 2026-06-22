import { NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { listRoomsForUser } from '@/lib/chat-service';

export const runtime = 'nodejs';

/**
 * GET /api/chat/rooms — every tournament chat room the signed-in coach (or admin) can see, with
 * unread counts. Portal-agnostic: the same endpoint backs both coach portals. Self-heals
 * memberships so a coach who signed in after the organizer opened chat still finds their room.
 */
export const GET = withObservability(async () => {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  const rooms = await listRoomsForUser(user.id);
  return NextResponse.json({ rooms });
}, { route: '/api/chat/rooms' });
