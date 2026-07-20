'use client';

import { useEffect, useState } from 'react';

/**
 * Count of pending team/org invitations awaiting this account — drives the red "needs you"
 * badge on the Home tab (Unified Home Phase 5 unified badge policy). Fetched on mount and on
 * tab refocus; invitations are rare and human-paced, so there's no polling interval or realtime
 * channel (unlike chat unread). Pass enabled=false (signed-out) to skip the fetch entirely; the
 * hook then reports 0 without ever setting state in the effect body. Best-effort — a transient
 * failure leaves the last-known count, and setCount only fires inside the fetch callback.
 */
export function usePendingInviteCount(enabled = true): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let controller: AbortController | null = null;

    const fetchCount = async () => {
      // Cancel any in-flight request first, so a slow earlier response can never overwrite a newer
      // one (out-of-order resolution on a fast refocus/refetch).
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await fetch('/api/consumer/invites/count', { cache: 'no-store', signal: controller.signal });
        if (!alive || !res.ok) return;
        const data = await res.json();
        if (alive) setCount(typeof data.count === 'number' ? data.count : 0);
      } catch {
        /* aborted or transient failure — keep last-known count */
      }
    };

    void fetchCount();
    // Refetch on tab refocus, AND when an invite is accepted/declined IN PLACE — PendingInvitationsCard
    // dispatches `flhq:invites-changed`. The nav lives in the persistent consumer layout (no remount on
    // in-shell navigation), so without this signal the red badge would keep the resolved invite's stale
    // count until a background/foreground or hard reload. (visibilitychange alone covers refocus; no
    // `focus` listener — it would double-fire.)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchCount();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('flhq:invites-changed', fetchCount);

    return () => {
      alive = false;
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('flhq:invites-changed', fetchCount);
    };
  }, [enabled]);

  // Derive 0 when disabled rather than resetting state in the effect body (avoids the
  // set-state-in-effect lint) — a sign-out drops the badge immediately.
  return enabled ? count : 0;
}
