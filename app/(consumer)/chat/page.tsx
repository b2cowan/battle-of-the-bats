import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase-server';
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

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const signedIn = !!user?.email;

  return (
    <div className={`${warm.warmTab} ${shell.chatShell}`}>
      <ChatTab signedIn={signedIn} />
    </div>
  );
}
