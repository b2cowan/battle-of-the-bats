'use client';
/**
 * components/public/AccountFollowSync.tsx (N2)
 *
 * Invisible, layout-mounted: hydrates the signed-in account's follows for THIS
 * tournament into the client follow layer (lib/follow.ts) and re-runs on auth
 * transitions, so a fan who signs in on a new device gets her My Team pin and
 * "Following" buttons without re-following. Renders nothing; anonymous visitors
 * cost a local session read only (no network). Identity stays client-fetched —
 * never server-rendered into the SW-cached public HTML (account-chip rule).
 */
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { syncAccountFollowsToDevice } from '@/lib/follow';

export default function AccountFollowSync({ orgSlug, tournamentSlug }: {
  orgSlug: string;
  tournamentSlug: string;
}) {
  useEffect(() => {
    void syncAccountFollowsToDevice(orgSlug, tournamentSlug);
    // Sign-in/out are SPA navigations — re-hydrate so the merge tracks the session
    // (mirrors TournamentAccountSheet's auth listener).
    const { data } = createClient().auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        void syncAccountFollowsToDevice(orgSlug, tournamentSlug);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [orgSlug, tournamentSlug]);

  return null;
}
