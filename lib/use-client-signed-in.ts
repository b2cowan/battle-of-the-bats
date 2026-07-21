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
    const resolve = () => getSession().then(s => { if (!cancelled) setSignedIn(!!s?.user); });
    void resolve();
    const { data } = createClient().auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void resolve();
    });
    return () => { cancelled = true; data.subscription.unsubscribe(); };
  }, [enabled]);
  // Derive false when disabled (mirrors usePendingInviteCount): the internal state is
  // not updated while disabled — no listener is subscribed off-route — so returning it
  // raw would latch the last on-route value. Returning false when !enabled keeps the
  // consumer (and its downstream enabled-gated hooks) correctly inert off-route.
  return enabled ? signedIn : false;
}
