'use client';

import { useEffect, useState } from 'react';
import { useChatUnread } from '@/lib/use-chat-unread';
import { CHAT_PAUSED } from '@/lib/chat-pause';

/**
 * The free portal's Chat door (Free coach header parity, owner A1, 2026-10-13; P2 on the phone, 2026-10-15):
 * shown only when the coach has a chat, or one is coming — `/api/coaches/chat-door`, asked once per portal
 * visit — and always while a message is unread (the count is live, so a room that opens mid-visit lights
 * it). One answer for both doors: the computer's left-menu row and the phone bar's Chat tab. Returns whether
 * to show it, the unread count it carries, and `ready` — whether the visit's answer is in, or the short wait
 * for it (WAIT_MS) is over. The phone bar waits on `ready` so its tabs arrive together: a Chat tab landing
 * after the others would shove all of them sideways — but a bar with no tabs is no way to move, so the wait
 * is capped and a slow answer only adds Chat late. `enabled=false` asks nothing and shows nothing.
 *
 * ⚖ While chat is paused (lib/chat-pause.ts, 2026-10-18; ruling P4F) the door is shut: nothing is asked, nothing is
 * shown, and the bar is ready at once — Overview · Tournaments · More, the bar a coach without chat already sees.
 */
const WAIT_MS = 800;

export function useChatDoor(enabled: boolean): { show: boolean; unread: number; ready: boolean } {
  const on = enabled && !CHAT_PAUSED;
  const unread = useChatUnread(on);
  const [door, setDoor] = useState(false);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    const waitOver = window.setTimeout(() => setAnswered(true), WAIT_MS);
    (async () => {
      try {
        const res = await fetch('/api/coaches/chat-door', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { show?: boolean };
        if (!cancelled) setDoor(Boolean(data.show));
      } catch {
        /* the door stays hidden; an unread message still opens it */
      } finally {
        if (!cancelled) setAnswered(true);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(waitOver);
    };
  }, [on]);

  if (CHAT_PAUSED) return { show: false, unread: 0, ready: enabled };
  return { show: on && (door || unread > 0), unread, ready: on && answered };
}
