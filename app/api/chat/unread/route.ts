import { NextResponse } from 'next/server';
import { CHAT_PAUSED } from '@/lib/chat-pause';
import { getAuthenticatedUser, unauthorized } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { getUnreadTotalForUser } from '@/lib/chat-service';

export const runtime = 'nodejs';

/** GET /api/chat/unread — total unread chat messages across the caller's rooms (portal sidebar badge). */
export const GET = withObservability(async () => {
  if (CHAT_PAUSED) return NextResponse.json({ count: 0 }); // ⚖ chat is paused (2026-10-18, ruling P8)
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  const count = await getUnreadTotalForUser(user.id);
  return NextResponse.json({ count });
}, { route: '/api/chat/unread' });
