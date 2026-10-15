'use client';

import { useEffect, useState } from 'react';
import { useChatUnread } from '@/lib/use-chat-unread';

/**
 * The free portal's Chat row (Free coach header parity, owner A1, 2026-10-13): shown only when the coach has
 * a chat, or one is coming — `/api/coaches/chat-door`, asked once per portal visit — and always while a
 * message is unread (the count is live, so a room that opens mid-visit lights the row). Returns whether to
 * show the row and the unread count it carries. `enabled=false` asks nothing and shows nothing.
 */
export function useChatDoor(enabled: boolean): { show: boolean; unread: number } {
  const unread = useChatUnread(enabled);
  const [door, setDoor] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/coaches/chat-door', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { show?: boolean };
        if (!cancelled) setDoor(Boolean(data.show));
      } catch {
        /* the row stays hidden; an unread message still opens it */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { show: enabled && (door || unread > 0), unread };
}
