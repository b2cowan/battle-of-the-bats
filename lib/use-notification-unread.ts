'use client';

import { useCallback, useEffect, useId, useState } from 'react';
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
 * rule the server's count reads, so a free coach's notice never bumps a club's badge). `setCount` is
 * exposed so the open panel can push the count down as items are read. Best-effort — transient
 * failures keep the last-known count.
 */
export function useNotificationUnread(bell: BellSource | null | undefined) {
  const [count, setCount] = useState(0);
  // Unique per hook instance — the sidebar bell + bottom nav can both mount this in the same tree
  // (CSS hides one per breakpoint), so a shared channel name would collide on the Supabase client.
  const instanceId = useId();

  const refresh = useCallback(async () => {
    if (!bell) return;
    try {
      const res = await fetch(`/api/notifications?${bellQuery(bell)}&unreadOnly=true&limit=1`);
      if (!res.ok) return;
      const data = await res.json();
      setCount(data.unreadCount ?? 0);
    } catch {
      /* silent — never crash the shell over a badge */
    }
  }, [bell]);

  useEffect(() => {
    if (bell) void refresh();
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
