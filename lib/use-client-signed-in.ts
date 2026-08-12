'use client';
import { useEffect, useState } from 'react';
import { getSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase-browser';
import { isDemoOrganizerEmail } from '@/lib/demo-org';

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
 * ── `endDemoSession` ────────────────────────────────────────────────────────────
 *
 * The "See it live" doors sign a visitor into a SHARED FICTIONAL account with a real
 * Supabase session (`lib/demo-session.ts`) — deliberately real, because that is what
 * lets a stranger use the genuine authenticated product with no login. The cost is
 * that every "is anyone signed in" check in the app reads it as a login, and one of
 * those checks drives the marketing bar: a prospect who only ever pressed a demo
 * button came back to the homepage and was offered "Account" and "Open app →" for an
 * account that was never theirs, and that neither of those doors leads anywhere they
 * own. (Found 2026-08-11.)
 *
 * So callers on MARKETING ground pass `endDemoSession` — there, a demo session is not
 * an identity, it is a demo the visitor has walked out of, and it ends on arrival.
 * Deliberately scoped to that one surface: the demo's own pages must keep the session
 * (they ARE the demo), and no real customer session is ever touched, because
 * `isDemoOrganizerEmail` only ever matches the two hardcoded fictional addresses.
 *
 * NB: several older surfaces (TournamentAccountSheet, AccountFollowSync, the fan
 * alert-prefs client) still hand-roll this same getSession + onAuthStateChange
 * pattern — this is the shared primitive they can migrate onto.
 */
export function useClientSignedIn(
  enabled = true,
  options?: { endDemoSession?: boolean },
): boolean {
  const endDemoSession = options?.endDemoSession ?? false;
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const resolve = async () => {
      const session = await getSession();
      if (cancelled) return;
      if (endDemoSession && isDemoOrganizerEmail(session?.user?.email)) {
        // Report signed-OUT before ending it, so the bar never flashes the wrong pair of
        // doors on the way. The resulting SIGNED_OUT event re-runs this with a null
        // session, which takes the ordinary path below — it cannot loop.
        setSignedIn(false);
        // ⚠ `scope: 'local'` is LOAD-BEARING, not a default worth inheriting. EVERY demo visitor
        // shares ONE auth user (`lib/demo-org.ts` — two hardcoded fictional accounts), and
        // supabase-js `signOut()` defaults to scope **'global'**, which revokes the refresh token
        // of every session that user holds. One prospect wandering back to the homepage would
        // have ended the demo for every other prospect inside it at that moment — on the shop
        // window, with the doors open. 'local' forgets the demo in THIS browser and touches
        // nobody else. (Caught in /review before this shipped; do not "simplify" the scope away.)
        //
        // It also deliberately bypasses `lib/auth.ts`'s signOut(): that one runs an account-push
        // teardown first (up to ~5s of time-boxed races) which is meaningless for a shared
        // fictional account, and whose only real effect here would be to widen the window in
        // which a session that arrived meanwhile — a real sign-in in another tab — is the one we
        // end instead. Nothing is discarded: the follow-hygiene that matters rides the
        // SIGNED_OUT event in `lib/follow.ts`, which this still fires.
        await createClient().auth.signOut({ scope: 'local' });
        return;
      }
      setSignedIn(!!session?.user);
    };
    void resolve();
    const { data } = createClient().auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void resolve();
    });
    return () => { cancelled = true; data.subscription.unsubscribe(); };
  }, [enabled, endDemoSession]);
  // Derive false when disabled (mirrors usePendingInviteCount): the internal state is
  // not updated while disabled — no listener is subscribed off-route — so returning it
  // raw would latch the last on-route value. Returning false when !enabled keeps the
  // consumer (and its downstream enabled-gated hooks) correctly inert off-route.
  return enabled ? signedIn : false;
}
