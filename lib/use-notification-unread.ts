'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { bellQuery, rowBelongsToBell, type BellSource } from '@/lib/notification-bell-scope';

/**
 * Unread notification count for the signed-in user in ONE bell — drives the sidebar/bell badge AND, since
 * "The Flip" moved the mobile bell into the admin More sheet, the More-tab + Notifications-row badges.
 * One hook so every surface shows the same number.
 *
 * `bell` is a club's bell (`orgBell(id)`) or the free coach's (`TEAM_COACH_BELL`, Free coach header
 * parity B3) — lib/notification-bell-scope.ts.
 *
 * Re-counts on mount + whenever a notification for this user is inserted (Supabase Realtime; RLS
 * limits which rows reach us, and we still confirm client-side that the row is THIS bell's — the same
 * rule the server's count reads, so a free coach's notice never bumps a club's badge) — AND whenever a list
 * on the page reads, finishes, deletes or marks-all-read a notice of this bell (`announceNotificationsChanged`,
 * sent by useNotificationFeed once its request lands). Before that (/design 2026-10-15) a coach who opened
 * a notice on the phone's Notifications page still saw the old count on More until the page reloaded — in
 * both portals' bars: Realtime is wired for INSERTs only. `setCount` is exposed so the open panel can push
 * the count down as items are read. Best-effort — transient failures keep the last-known count.
 */
export const NOTIFICATIONS_CHANGED_EVENT = 'flhq:notifications-changed';

/** A list changed what is unread in `bell` (read, Done, deleted, Mark all read) and the server has it: every
 *  count for that bell on the page re-reads its number. Sent after the request lands, so the re-read sees it. */
export function announceNotificationsChanged(bell: BellSource): void {
  window.dispatchEvent(new CustomEvent<BellSource>(NOTIFICATIONS_CHANGED_EVENT, { detail: bell }));
}

export function useNotificationUnread(bell: BellSource | null | undefined) {
  const [count, setCount] = useState(0);
  // Unique per hook instance — the sidebar bell + bottom nav can both mount this in the same tree
  // (CSS hides one per breakpoint), so a shared channel name would collide on the Supabase client.
  const instanceId = useId();
  // Only the LATEST read may set the count (/review 2026-10-16): two re-reads close together (open a notice,
  // then Done) can answer out of order, and the older answer landing last would pin a stale, higher number.
  const readSeq = useRef(0);

  const refresh = useCallback(async () => {
    if (!bell) return;
    const seq = ++readSeq.current;
    try {
      const res = await fetch(`/api/notifications?${bellQuery(bell)}&unreadOnly=true&limit=1`);
      if (!res.ok) return;
      const data = await res.json();
      if (seq !== readSeq.current) return; // a newer read is on its way
      setCount(data.unreadCount ?? 0);
    } catch {
      /* silent — never crash the shell over a badge */
    }
  }, [bell]);

  useEffect(() => {
    if (bell) void refresh();
  }, [bell, refresh]);

  // A list on this page read, finished or deleted a notice of THIS bell: re-read the true count.
  useEffect(() => {
    if (!bell) return;
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<BellSource>).detail === bell) void refresh();
    };
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
  }, [bell, refresh]);

  useEffect(() => {
    if (!bell) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const userId = data.user?.id ?? null;
      if (!userId) return;
      channel = supabase
        .channel(`notif-unread:${userId}:${bell}:${instanceId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            if (rowBelongsToBell(bell, payload.new as { org_id?: string; event_type?: string } | null)) {
              setCount(prev => prev + 1);
            }
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [bell, instanceId]);

  return { count: bell ? count : 0, setCount };
}
