'use client';

import { useEffect, useId, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { CHAT_PAUSED } from '@/lib/chat-pause';

/**
 * Total unread chat messages across the caller's rooms — drives the "Chat" nav badge in the admin
 * sidebar + both coach portals. Re-counts on mount, on tab refocus, every 60s (staleness net), AND
 * immediately when any chat message is inserted (so the badge isn't up to 60s stale on a live
 * message — the /api/chat/unread endpoint re-scopes to the caller via auth.uid(), so an unfiltered
 * INSERT trigger is safe and cheap). Pass `enabled=false` on non-portal routes to skip everything.
 * Best-effort: a transient failure just leaves the last-known count. setCount only fires inside the
 * fetch callback (the external-system pattern).
 *
 * ⚖ While chat is paused (lib/chat-pause.ts, 2026-10-18) the hook does nothing at all — no fetch, no 60s poll, no
 * realtime channel — and reports 0, whatever a caller passes.
 */
export function useChatUnread(enabled = true): number {
  const [count, setCount] = useState(0);
  // Unique per hook instance — the sidebar + bottom nav both mount this hook in the same tree
  // (CSS hides one per breakpoint), so a shared channel name would collide on the Supabase client.
  const instanceId = useId();

  const on = enabled && !CHAT_PAUSED;
  useEffect(() => {
    if (!on) return;
    let alive = true;

    const fetchCount = async () => {
      try {
        const res = await fetch('/api/chat/unread', { cache: 'no-store' });
        if (!alive || !res.ok) return;
        const data = await res.json();
        if (alive) setCount(typeof data.count === 'number' ? data.count : 0);
      } catch {
        /* keep last-known count */
      }
    };

    void fetchCount();
    // visibilitychange alone covers tab refocus in modern browsers — adding a `focus` listener too
    // would double-fire a concurrent fetch on every alt-tab.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchCount();
    };
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(() => {
      if (alive) void fetchCount();
    }, 60_000);

    // Realtime nudge: any chat message insert → re-count now (RLS limits which rows reach us anyway).
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-unread-badge:${instanceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        if (alive) void fetchCount();
      })
      .subscribe();

    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [on, instanceId]);

  // Derive 0 when disabled (mirrors usePendingInviteCount): the last-fetched count is
  // never reset on cleanup, so returning it raw would keep a stale badge after `enabled`
  // goes false (e.g. an in-place sign-out on a tournament page) — visible to the next
  // person on a shared device. Returning 0 when !enabled clears it immediately.
  return on ? count : 0;
}
