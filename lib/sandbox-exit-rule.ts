import { isDemoOrgSlug, decodePathSegment } from './demo-org';
import { SEE_IT_LIVE_PATH } from './sandbox-door';

/**
 * lib/sandbox-exit-rule.ts — WHO is leaving the demo, decided with no I/O and no framework.
 *
 * The other half of `lib/sandbox-exit.ts`, which carries out the decision made here. They are two
 * files for two hard reasons, both learned rather than chosen:
 *
 *  · **The browser needs half of it.** The two client-side demo exits (the marketing bar and the
 *    sign-in screen) clear the marker cookie, and they cannot import a module that pulls in
 *    `next/server`.
 *  · **The decision has to be testable.** Every line below is a way this rule could quietly STOP
 *    firing — and a rule that stops firing brings the leak back on a screen nobody is watching.
 *    Keeping it free of a session read is what lets `tests/unit/demo-sandbox-exit.test.ts` pin the
 *    whole table.
 */

/** The cookie name. Only its PRESENCE is ever read — nothing reads the value back. */
export const SANDBOX_MARKER_COOKIE = 'flhq-in-sandbox';

/** A demo session lives at most this long anyway; the marker should not outlive the world. */
export const SANDBOX_MARKER_MAX_AGE_SECONDS = 12 * 60 * 60;

/**
 * Make sure this browser still carries the marker, and re-set it if it does not.
 *
 * ⚠ The demo's auth cookies and this marker are written together ONCE, at the door — but they do
 * not stay in step. A tab left open inside the sandbox keeps refreshing its Supabase token in the
 * background, straight to the auth server, writing fresh auth cookies that the request layer never
 * sees and that carry no marker with them. So a browser that exits the demo in one tab (both
 * cookies expired) and later has the session revived by the other tab's refresh ends up holding a
 * live demo session with NO marker — and since the marker is what makes the request layer look at
 * all, the leave-the-demo rule would be silently, permanently disarmed for that browser.
 *
 * The sandbox chrome calls this while it is mounted and whenever its tab is focused, which is
 * exactly when such a revival becomes reachable. Cheap: a cookie read, and a write only when the
 * marker has actually gone missing.
 */
export function ensureSandboxMarkerCookie(): void {
  if (typeof document === 'undefined') return;
  const present = document.cookie.split('; ').some(c => c.startsWith(`${SANDBOX_MARKER_COOKIE}=`));
  if (present) return;
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie =
    `${SANDBOX_MARKER_COOKIE}=1; path=/; max-age=${SANDBOX_MARKER_MAX_AGE_SECONDS}; samesite=lax${secure}`;
}

/**
 * Forget the marker in THIS browser. Called wherever a demo session is ended client-side, so a
 * visitor who leaves the demo and later signs in as themselves is not still carrying a hint that
 * costs their every page load a session read. Safe to call when there is no marker.
 */
export function forgetSandboxMarkerCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SANDBOX_MARKER_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/**
 * @supabase/ssr names its session cookies `sb-<project-ref>-auth-token`, chunked as `.0`, `.1`, …
 * when large. Stated ONCE here and reused by `lib/supabase-server.ts` — a second hand-written copy
 * of this match is how one of them ends up clearing three cookies out of four.
 */
export function isSupabaseAuthCookieName(name: string): boolean {
  return name.startsWith('sb-') && name.includes('-auth-token');
}

/**
 * Is this path INSIDE the demo world?
 *
 * Deliberately short: a demo org's own pages (every sandbox org is keyed by slug in the hardcoded
 * allow-list), and the doors themselves. Everything else — the marketing site, the consumer app,
 * sign-up, another org's public pages — is outside, and arriving there ends the demo.
 *
 * `/demos` (the chooser) is deliberately OUTSIDE: a visitor picking a different sandbox is a
 * visitor who has left the one they were in, and the other door signs them in again on press.
 */
export function isSandboxSurfacePath(pathname: string): boolean {
  if (pathname === SEE_IT_LIVE_PATH || pathname.startsWith(`${SEE_IT_LIVE_PATH}/`)) return true;
  // Decoded, because the ROUTER decodes: a raw comparison reads "%72iverdale-ridge" as a stranger
  // and would end a demo the visitor is standing in. Same decoder as the write block.
  const firstSegment = pathname.split('/').filter(Boolean)[0];
  return isDemoOrgSlug(firstSegment === undefined ? undefined : decodePathSegment(firstSegment));
}

/**
 * The decision, with no session read and no I/O in it: does this REQUEST look like a visitor
 * walking out of the demo? Split from the response below so the table it encodes — which methods,
 * which paths, prefetch, data calls — is testable without a Supabase round-trip, because every
 * entry in it is a way this rule could quietly stop firing.
 */
export function requestIsLeavingTheSandbox(input: {
  method: string;
  pathname: string;
  hasSandboxMarker: boolean;
  isPrefetch: boolean;
  isNavigation: boolean;
}): boolean {
  // Never been through a door — nothing to leave.
  if (!input.hasSandboxMarker) return false;

  // GET only. A page navigation is a GET; the bounce below would discard a POST body, and the
  // sandbox's own switch endpoints are POSTs (under /api, which is excluded anyway).
  if (input.method !== 'GET') return false;

  // A LINK PREFETCH is not a visit. Next prefetches on hover — ending the demo because a link to
  // the sign-up page scrolled into view would close the sandbox under a visitor still using it.
  if (input.isPrefetch) return false;

  // ⚠⚠ NEITHER IS A FAVICON. Only a NAVIGATION means the visitor went somewhere; a page pulls in
  // icons, a web manifest and a service-worker script from the site root, and every one of those
  // is a same-origin GET carrying the same cookies. Judged by path alone they all look like
  // "outside the demo" — so the demo tore its OWN session down moments after the door opened,
  // while the visitor sat on the page that had just requested them. Caught in /review 2026-08-26,
  // after a curl probe called it green: curl does not fetch subresources, and a browser does.
  if (!input.isNavigation) return false;

  // Data calls never decide this. The demo's own screens fetch constantly; the visitor's LOCATION
  // is what says whether they have left, and that is a page request.
  if (input.pathname.startsWith('/api/')) return false;

  return !isSandboxSurfacePath(input.pathname);
}

