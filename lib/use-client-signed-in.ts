'use client';
import { useEffect, useState } from 'react';
import { getSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase-browser';

/**
 * Client-side "is this visitor signed in" — resolved from a LOCAL session read
 * (getSession = a cookie read; anonymous visitors never hit the network) and kept
 * in step with SPA sign-in/out (no reload) via one auth-state subscription.
 *
 * Use this instead of SSR-ing identity into any page the service worker caches
 * anonymously (public tournament pages): baking `signedIn` into that HTML would
 * replay one person's state to the next on a shared device. Pass `enabled=false`
 * to make it fully inert (no read, no subscription) on routes where it doesn't apply.
 *
 * NB: several older surfaces (TournamentAccountSheet, AccountFollowSync, the fan
 * alert-prefs client) still hand-roll this same getSession + onAuthStateChange
 * pattern — this is the shared primitive they can migrate onto.
 */
export function useClientSignedIn(enabled = true): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const resolve = async () => {
      const session = await getSession();
      if (cancelled) return;
      setSignedIn(!!session?.user);
    };
    void resolve();
    const { data } = createClient().auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void resolve();
    });
    // A page restored from the back/forward cache does NOT re-run this effect — the whole JS heap
    // comes back exactly as it was, so a sign-in or sign-out made meanwhile would not show.
    // `persisted` scopes this to genuine bfcache restores — an ordinary load has already
    // resolved above, so this adds no work to the common path.
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) void resolve(); };
    window.addEventListener('pageshow', onPageShow);
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [enabled]);
  // Derive false when disabled (mirrors usePendingInviteCount): the internal state is
  // not updated while disabled — no listener is subscribed off-route — so returning it
  // raw would latch the last on-route value. Returning false when !enabled keeps the
  // consumer (and its downstream enabled-gated hooks) correctly inert off-route.
  return enabled ? signedIn : false;
}
