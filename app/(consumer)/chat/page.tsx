import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import { safeNextPath } from '@/lib/safe-redirect';
import warm from '@/components/consumer/warmTheme.module.css';
import shell from './chat-inbox.module.css';
import ChatTab from './ChatTab';

/**
 * /chat — Chat tab (Unified Home IA).
 *
 * Phase 0 shipped the static logged-out / fan pitch; Phase 4 puts the signed-in MEMBER inbox in front
 * of it. The SSR shell stays anon-safe: we resolve only sign-in state here (to skip the inbox fetch +
 * avoid a preview flash for logged-out visitors). All REAL chat data is client-fetched from
 * /api/consumer/chat/inbox — no per-user chat content is ever SSR'd into cacheable HTML (and /chat is
 * on the SW denylist). Member-only read/post stays enforced at the DB layer; the fan preview is static.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Chat',
  robots: { index: false, follow: false },
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string | string[]; back?: string | string[] }>;
}) {
  const { room, back } = await searchParams;
  const rawRoom = typeof room === 'string' ? room : Array.isArray(room) ? room[0] : undefined;

  // A3 QA (2026-07-27): a coach arriving from the portal (the shell's Chat tab appends
  // `?back=<current portal path>`) gets a visible way home — first-time tournament coaches
  // otherwise land in the global Chat tab with no idea how to return. Sanitized to an
  // internal path AND restricted to the coach portal, so the affordance can't be aimed
  // anywhere else; absent for fans and direct visits.
  const rawBack = typeof back === 'string' ? back : Array.isArray(back) ? back[0] : undefined;
  const safeBack = rawBack ? safeNextPath(rawBack, '/chat') : null;
  const coachBackHref = safeBack && safeBack.startsWith('/coaches') ? safeBack : null;
  // Normalize an empty `?room=` to "no deep link" so it neither forces a pointless signed-out
  // sign-in round-trip nor blocks the lone-room auto-open (an empty string isn't nullish, so it
  // would otherwise win the `??` in ChatInbox and defeat that fallback).
  const roomId = rawRoom && rawRoom.length > 0 ? rawRoom : undefined;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const signedIn = !!user?.email;

  // WI-2 (owner decision, WhatsApp model): a chat push tapped while signed out must prompt sign-in
  // and then land IN the conversation — same as the score push. Only when a room is targeted; bare
  // /chat keeps today's public preview. safeNextPath sanitizes the round-trip destination.
  if (!signedIn && roomId) {
    const next = safeNextPath(`/chat?room=${roomId}`, '/chat');
    redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <div className={`${warm.warmTab} ${shell.chatShell}`}>
      {coachBackHref && (
        <Link href={coachBackHref} className={shell.coachReturn}>
          <ArrowLeft size={14} aria-hidden /> Back to your Coaches Portal
        </Link>
      )}
      <ChatTab signedIn={signedIn} initialRoomId={roomId} />
    </div>
  );
}
