'use client';

import { useEffect, useState } from 'react';
import { Loader2, MessageCircle, RotateCw } from 'lucide-react';
import { fireConsumerEvent } from '@/lib/consumer-events-client';
import ChatPreview from './ChatPreview';
import ChatInbox, { type InboxRoom } from './ChatInbox';
import styles from './chat-inbox.module.css';

/**
 * Chat tab client branch (Unified Home Phase 4). Decides, per account, what the tab is:
 *   • signed-out                 → the static pitch (ChatPreview), immediately, no fetch.
 *   • signed-in, ≥1 chat room    → the real cross-context inbox (ChatInbox).
 *   • signed-in, no rooms (fan)  → the same static pitch (honest "chat opens up on a team's staff").
 *
 * The inbox rides ONE client fetch (/api/consumer/chat/inbox) — no real chat data is ever SSR'd. The
 * aggregator self-heals memberships on load, so a coach who just signed in isn't shown a false "no chats".
 */
export default function ChatTab({ signedIn }: { signedIn: boolean }) {
  // 'ready' means the fetch resolved; whether that renders the inbox or the fan pitch is DERIVED from
  // rooms.length (no separate 'inbox'/'preview' states to keep in sync with the list). Signed-out is
  // 'ready' with no rooms → the static preview, immediately, no fetch.
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(signedIn ? 'loading' : 'ready');
  const [rooms, setRooms] = useState<InboxRoom[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  // §6 metric — Chat tab opens by auth state (fan/logged-out included; fires once per open).
  useEffect(() => { fireConsumerEvent('chat_tab_opened', { signedIn }); }, [signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    (async () => {
      setStatus('loading'); // in the async callback (not the effect body) — reset the spinner on retry
      try {
        const res = await fetch('/api/consumer/chat/inbox', { cache: 'no-store' });
        if (!res.ok) { if (!cancelled) setStatus('error'); return; }
        const data = await res.json();
        if (cancelled) return;
        setRooms(data.rooms ?? []);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [signedIn, reloadKey]);

  if (status === 'loading') {
    return (
      <div className={styles.centerState}>
        <Loader2 size={20} className={styles.spin} aria-hidden /> Loading your conversations…
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.centerState}>
        <MessageCircle size={30} aria-hidden className={styles.centerIcon} />
        <p className={styles.centerText}>We couldn&rsquo;t load your conversations.</p>
        <button type="button" className={styles.retryBtn} onClick={() => setReloadKey((k) => k + 1)}>
          <RotateCw size={14} aria-hidden /> Try again
        </button>
      </div>
    );
  }

  // status === 'ready': the inbox if there's anything to show, else the honest fan pitch.
  return rooms.length > 0 ? <ChatInbox initialRooms={rooms} /> : <ChatPreview signedIn={signedIn} />;
}
