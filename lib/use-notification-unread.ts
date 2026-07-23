'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

/**
 * Unread org-notification count for the signed-in user — drives the sidebar/bell badge AND, since
 * "The Flip" moved the mobile bell into the admin More sheet, the More-tab + Notifications-row badges.
 * One hook so every surface shows the same number.
 *
 * Re-counts on mount + whenever a notification for this user is inserted (Supabase Realtime; RLS
 * limits which rows reach us, and we still confirm org_id client-side). `setCount` is exposed so the
 * open panel can push the count down as items are read. Best-effort — transient failures keep the
 * last-known count.
 */
export function useNotificationUnread(orgId: string | null | undefined) {
  const [count, setCount] = useState(0);
  // Unique per hook instance — the sidebar bell + bottom nav can both mount this in the same tree
  // (CSS hides one per breakpoint), so a shared channel name would collide on the Supabase client.
  const instanceId = useId();

  const refresh = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/notifications?orgId=${orgId}&unreadOnly=true&limit=1`);
      if (!res.ok) return;
      const data = await res.json();
      setCount(data.unreadCount ?? 0);
    } catch {
      /* silent — never crash the shell over a badge */
    }
  }, [orgId]);

  useEffect(() => {
    if (orgId) void refresh();
  }, [orgId, refresh]);

  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const userId = data.user?.id ?? null;
      if (!userId) return;
      channel = supabase
        .channel(`notif-unread:${userId}:${orgId}:${instanceId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            if ((payload.new as { org_id?: string } | null)?.org_id === orgId) {
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
  }, [orgId, instanceId]);

  return { count: orgId ? count : 0, setCount };
}
