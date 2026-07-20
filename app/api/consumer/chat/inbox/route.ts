/**
 * GET /api/consumer/chat/inbox
 *
 * The signed-in member's cross-context Chat inbox (Unified Home Phase 4), client-fetched. The /chat
 * page ships an anon-safe static shell (the logged-out/fan pitch); ALL real chat data rides this one
 * authed call — no per-user chat content is ever SSR'd into cacheable HTML (the FP-2 viewer-identity
 * pattern, and /chat is on the SW denylist besides). Signed-out callers get an empty payload and the
 * client keeps the static preview.
 *
 * getChatInboxForUser SELF-HEALS memberships on load, so a coach who signed in after an organizer
 * opened chat immediately finds their rooms — never a false "no chats".
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { withObservability } from '@/lib/observability';
import { getChatInboxForUser } from '@/lib/chat-service';
import { writePlatformEvent } from '@/lib/platform-events';

export const runtime = 'nodejs';

export const GET = withObservability(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json(
      { signedIn: false, rooms: [], unreadTotal: 0 },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const inbox = await getChatInboxForUser(user.id);
  // §6 coach/member inbox-DAU metric. AWAITED (not after()) so it reliably records on the serverless
  // host (Amplify Lambda has no after()/waitUntil bridge). throw-proof; one cheap insert on a call
  // that's already client-fetched off the paint path.
  await writePlatformEvent({
    eventType: 'chat_inbox_loaded',
    source: 'app',
    actorUserId: user.id,
    actorEmail: user.email,
    metadata: { roomCount: inbox.rooms.length },
  });
  // Per-user, never shared — no-store beyond the SW's /api/ no-cache rule (matches every sibling
  // consumer API). Real chat content must never land in a cacheable response.
  return NextResponse.json(
    { signedIn: true, rooms: inbox.rooms, unreadTotal: inbox.unreadTotal },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}, { route: '/api/consumer/chat/inbox' });
