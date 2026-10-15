import { NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { coachChatDoorOpen } from '@/lib/chat-service';

export const runtime = 'nodejs';

/**
 * GET /api/coaches/chat-door — does the free portal's left menu show Chat? (Free coach header parity, owner
 * A1, 2026-10-13.) `{ show }`: the caller is in a chat room, or one of their still-running tournaments can
 * still open one. Per person, never shared, so no-store. Read once per portal visit by CoachPortalShell; a
 * failure answers false and the row stays hidden (the unread count still opens it when a message lands).
 */
export const GET = withObservability(async () => {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  const show = await coachChatDoorOpen(user.id).catch(err => {
    console.error('[coaches chat-door] lookup failed (non-fatal):', err);
    return false;
  });
  return NextResponse.json({ show }, { headers: { 'Cache-Control': 'no-store' } });
}, { route: '/api/coaches/chat-door' });
