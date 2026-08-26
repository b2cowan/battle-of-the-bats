'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase-browser';
import { isDemoOrganizerEmail } from '@/lib/demo-org';
import { forgetSandboxMarkerCookie, isSandboxSurfacePath } from '@/lib/sandbox-exit-rule';

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
 * ── Leaving the demo ────────────────────────────────────────────────────────────
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
 * So this hook applies the SAME rule the request layer applies (`lib/sandbox-exit.ts`,
 * owner ruling 2026-08-26): outside the demo world a demo session is not an identity, it
 * is a demo the visitor has walked out of, and it ends on arrival. It was scoped to the
 * marketing bar alone until then — which is precisely why Discover, /account and the
 * sign-up page went on reading as the demo coach. Two halves, one predicate: the demo's
 * own pages keep the session (they ARE the demo), and no real customer session is ever
 * touched, because `isDemoOrganizerEmail` only matches the two fictional addresses.
 *
 * ⚠ This half exists for the surfaces the request layer deliberately does not run on —
 * cached public event pages, where adding a session round-trip to every anonymous fan's
 * page load would be the wrong trade. It is a second line, never the first.
 *
 * NB: several older surfaces (TournamentAccountSheet, AccountFollowSync, the fan
 * alert-prefs client) still hand-roll this same getSession + onAuthStateChange
 * pattern — this is the shared primitive they can migrate onto.
 */
export function useClientSignedIn(enabled = true): boolean {
  const [signedIn, setSignedIn] = useState(false);
  // ⚠ The PATHNAME is a dependency, and that is load-bearing rather than tidy. The request layer
  // deliberately ignores client-side route changes (it cannot tell one from a prefetch — see
  // lib/sandbox-exit.ts), which leaves this half as the ONLY thing that notices a visitor
  // stepping out of the demo without a full page load. Reading the path once at mount made it
  // blind to exactly that.
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const resolve = async () => {
      const session = await getSession();
      if (cancelled) return;
      const insideTheDemo = isSandboxSurfacePath(pathname);
      if (!insideTheDemo && isDemoOrganizerEmail(session?.user?.email)) {
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
        // Drop the sandbox marker with it. The server-side leave-the-demo rule keys off that
        // cookie, and a stale one left over a LATER real sign-in costs that customer a session
        // read and a redirect on every page — correct (the rule checks the address before it
        // touches anything) but pure waste. See lib/sandbox-exit.ts.
        forgetSandboxMarkerCookie();
        // Re-render the server's half of this page as a stranger. The chrome above the fold was
        // rendered with the demo's identity before this ran — on a client-side route change
        // nothing else will correct it, and a workspace card for a fictional club is the exact
        // thing the visitor is not supposed to see out here.
        router.refresh();
        return;
      }
      setSignedIn(!!session?.user);
    };
    void resolve();
    const { data } = createClient().auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void resolve();
    });
    // A page restored from the back/forward cache does NOT re-run this effect — the whole JS heap
    // comes back exactly as it was. So a visitor who pressed Back out of the demo, onto the very
    // marketing page they entered it from, kept BOTH the stale doors and a LIVE demo session:
    // the bar honestly read "Sign In", and the sign-in screen then followed that session back
    // into the demo. `persisted` scopes this to genuine bfcache restores — an ordinary load has
    // already resolved above, so this adds no work to the common path.
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) void resolve(); };
    window.addEventListener('pageshow', onPageShow);
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [enabled, pathname, router]);
  // Derive false when disabled (mirrors usePendingInviteCount): the internal state is
  // not updated while disabled — no listener is subscribed off-route — so returning it
  // raw would latch the last on-route value. Returning false when !enabled keeps the
  // consumer (and its downstream enabled-gated hooks) correctly inert off-route.
  return enabled ? signedIn : false;
}
