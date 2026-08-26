import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isDemoOrganizerEmail } from './demo-org';
import {
  SANDBOX_MARKER_COOKIE, isSupabaseAuthCookieName, requestIsLeavingTheSandbox,
} from './sandbox-exit-rule';

/**
 * lib/sandbox-exit.ts — THE rule: leaving the demo world ends the demo.
 *
 * The "See it live" doors sign a visitor into a REAL Supabase session for a shared fictional
 * account (`lib/demo-session.ts`) — deliberately real, because that is what lets a stranger use
 * the genuine authenticated product with no login. The cost is that every "is anyone signed in?"
 * question in the whole product then answers *yes, as the demo coach*: the consumer shell drew a
 * COACHES PORTAL door and a "Riverdale Ridge Baseball" workspace card on Discover, /account showed
 * a fictional person's account, the demo's follows synced into the visitor's browser, and the
 * demo's own "Start free →" CTA landed on the sign-up form still carrying that session.
 *
 * ── Why this is one rule and not another patch ──────────────────────────────────────────────
 *
 * This leak has been patched twice before, one screen at a time and both times in the browser:
 * the marketing bar ends the demo when it mounts (`lib/use-client-signed-in.ts`), and the sign-in
 * screen ends it when it mounts (`app/(consumer)/auth/login/page.tsx`, reported 2026-08-25). A
 * mount-time patch cannot help a SERVER-rendered header — which is exactly what draws the
 * workspace card and the portal door — so the third screen was always going to leak, and so was
 * the fourth. Owner ruling 2026-08-26: **the demo is self-contained.** Walking out of the demo
 * world IS walking out of the demo, decided before the page renders, for every surface at once.
 *
 * ── The three things this must never do ─────────────────────────────────────────────────────
 *
 *  1. **Never end a real customer's session.** The marker cookie alone is not proof — a prospect
 *     who walks the demo and then signs in as themselves can be holding a stale marker over their
 *     own session. So the session is READ and its address checked against the hardcoded
 *     allow-list before a single auth cookie is touched; a non-demo session loses only the marker.
 *  2. **Never reach past this browser.** Expiring cookies forgets the demo HERE. It deliberately
 *     does not call `signOut()`: every demo visitor shares ONE auth user, and supabase-js defaults
 *     to `scope: 'global'`, which would eject every other prospect standing in the demo at that
 *     moment — on the shop window, with the doors open. (The same trap is documented at both
 *     client-side exits; this one avoids it by never signing out at all.)
 *  3. **Never cost a real customer a round-trip.** The session read happens only when the marker
 *     cookie is present, i.e. only for a browser that has actually been through a demo door.
 */

// The proxy asks this module for the rule AND for the response that carries it out, so the one
// predicate it needs comes back out through the same door. Everything else in the rule module is
// imported from there directly — a re-export nobody uses is just a second place to look.
export { isSandboxSurfacePath } from './sandbox-exit-rule';

/** Whoever this request's cookies say is signed in, read WITHOUT the power to write them back. */
export async function currentSessionUser(
  request: NextRequest,
): Promise<{ id: string; email: string | null } | null> {
  const reader = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        // Deliberately inert: asking who is here must never mutate the caller's cookies. At the
        // door that property decides whether we may touch their session at all.
        setAll: () => { /* no-op */ },
      },
    },
  );
  const { data: { user } } = await reader.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email?.trim().toLowerCase() ?? null };
}

/**
 * Next marks a prefetch several ways, and the VALUE is not always '1' — its segment cache sends
 * '2' and '3' for its other fetch strategies (verified in the installed next@16.3.0). Matching
 * only '1' would have let a hover-triggered prefetch read as a visit and end a live demo, so any
 * value counts, alongside the older `purpose` header and the standard `sec-purpose`.
 */
function isPrefetchRequest(request: NextRequest): boolean {
  return !!request.headers.get('next-router-prefetch')
    || request.headers.get('purpose') === 'prefetch'
    || (request.headers.get('sec-purpose') ?? '').includes('prefetch');
}

/**
 * Did the visitor GO somewhere, or did a page they are already on ask for a file?
 *
 * A full page load announces itself as `Sec-Fetch-Dest: document`. Everything a page pulls in
 * afterwards — icons, the web manifest, the service-worker script, fonts, images — is a
 * same-origin GET carrying the same cookies, and by path alone every one of them looks like
 * "somewhere outside the demo". Without this check the demo tore its OWN session down moments
 * after the door opened, while the visitor sat on the page that had just asked for its favicon.
 * (Caught in /review 2026-08-26 — and a curl probe had called it green, because curl does not
 * fetch subresources and a browser does.)
 *
 * ⚠ A client-side route change is deliberately NOT counted, and that is a considered trade rather
 * than an oversight. Such a navigation is an RSC fetch — and in next@16.3.0 a background PREFETCH
 * is an RSC fetch too, with no header that reliably tells them apart (its segment cache omits the
 * prefetch header entirely for one of its strategies; verified in the installed package). Reading
 * RSC as a visit would let a link merely scrolling into view end a demo somebody is still using —
 * a worse failure than the one it would fix. So the request layer owns full page loads, and the
 * browser-side half (lib/use-client-signed-in.ts) owns route changes, where it reads the pathname
 * directly and no prefetch can impersonate one.
 *
 * The `accept` fallback covers a client too old to send Sec-Fetch-Dest. An `iframe` or `embed`
 * dest is not a navigation: something embedding a page is not the visitor walking out.
 */
function isNavigationRequest(request: NextRequest): boolean {
  const dest = request.headers.get('sec-fetch-dest');
  if (dest) return dest === 'document';
  return (request.headers.get('accept') ?? '').includes('text/html');
}

/**
 * The rule, as a response: `null` to carry on, or a redirect to the SAME address with the demo
 * forgotten. The bounce is what makes this simple — the re-request arrives with no demo cookies at
 * all, so every downstream guard, layout and server component sees an ordinary stranger rather
 * than a session we are half-way through deleting. It cannot loop: the second pass has no marker,
 * because BOTH branches expire it.
 */
export async function sandboxExitResponse(request: NextRequest): Promise<NextResponse | null> {
  const leaving = requestIsLeavingTheSandbox({
    method: request.method,
    pathname: request.nextUrl.pathname,
    hasSandboxMarker: !!request.cookies.get(SANDBOX_MARKER_COOKIE),
    isPrefetch: isPrefetchRequest(request),
    isNavigation: isNavigationRequest(request),
  });
  if (!leaving) return null;

  // ⚠ The marker says "look", never "act". A prospect who walked the demo and later signed in as
  // THEMSELVES still carries it, so only the hardcoded fictional addresses may lose a session —
  // everyone else loses nothing but the marker.
  const session = await currentSessionUser(request);
  const isDemoSession = isDemoOrganizerEmail(session?.email);

  const response = NextResponse.redirect(request.nextUrl, 307);
  const expire = (name: string) => response.cookies.set(name, '', { path: '/', maxAge: 0 });
  expire(SANDBOX_MARKER_COOKIE);
  if (isDemoSession) {
    for (const cookie of request.cookies.getAll()) {
      if (isSupabaseAuthCookieName(cookie.name)) expire(cookie.name);
    }
  }
  return response;
}
