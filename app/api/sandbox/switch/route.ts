import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { assertSafeSupabaseServerEnvironment } from '@/lib/supabase-safety';
import { getDemoOrgByKind } from '@/lib/demo-org';
import { attachDemoSession } from '@/lib/demo-session';
import { resolveTrustedAppOrigin, isTrustedAppOrigin } from '@/lib/app-origin';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';
import { captureError } from '@/lib/observability';
import { SANDBOX_CONFIRM_PATH } from '@/lib/sandbox-door';

/**
 * The confirm screen's one button: swap this browser's session for the demo organizer's.
 *
 * Reached ONLY from `/see-it-live/switch`, and only by a visitor who was already signed in as
 * themselves and pressed "Open the demo — sign me out". The door itself never comes here.
 *
 * ── Why this is a POST, and why it checks its Origin ────────────────────────────────────────
 *
 * It destroys the caller's session. A GET that does that can be fired by any page anywhere that can
 * embed a URL — an `<img src>` is enough — which would sign our own customers out at a stranger's
 * whim. A POST plus a same-origin check makes that a deliberate act by the person at the keyboard.
 * The cost of a false negative is one visitor sent back to the confirm screen; the cost of a false
 * positive is somebody else deciding when our customers get signed out.
 *
 * It takes NO input. There is no body to read, no redirect target to honour, and the account it
 * signs in is a compile-time constant checked against the allow-list inside `attachDemoSession`.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MINUTE = 60_000;
const ipLimiter = new FixedWindowRateLimiter(10 * MINUTE, 10);
const globalLimiter = new FixedWindowRateLimiter(5 * MINUTE, 150);

export async function POST(request: NextRequest) {
  assertSafeSupabaseServerEnvironment('See-it-live session swap');

  const origin = resolveTrustedAppOrigin(request);
  const demo = getDemoOrgByKind('tournament');
  if (!demo) return NextResponse.redirect(new URL('/for-tournament-organizers', origin), 303);

  const landing = new URL(demo.landingPath, origin);
  const confirmScreen = new URL(SANDBOX_CONFIRM_PATH, origin);

  // Same-origin only. A browser always sends `Origin` on a cross-origin form POST, so a missing
  // header is a same-origin submit or a non-browser client — neither is the attack this closes.
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin && !isTrustedAppOrigin(requestOrigin)) {
    return NextResponse.redirect(confirmScreen, 303);
  }

  const ip = clientIpFrom(request);
  if (!ipLimiter.take(ip) || !globalLimiter.take('global')) {
    console.warn(`[see-it-live/switch] rate-limited session swap ip=${ip}`);
    return NextResponse.redirect(confirmScreen, 303);
  }

  // 303 so the browser follows with a GET — a POST redirected as-is would re-submit.
  const response = NextResponse.redirect(landing, 303);
  try {
    // Writes the demo's cookies over whatever was there, which IS the sign-out the visitor agreed
    // to. No separate signOut call: one write, one outcome, nothing half-done in between.
    await attachDemoSession(request, response, demo.organizerEmail);
  } catch (err) {
    await captureError(err, { route: '/api/sandbox/switch', method: 'POST', severity: 'critical' });
    // Their own session is untouched — the write either landed or it didn't. Send them to the fan
    // side rather than a dead end; it is public and it is most of the demo.
    return NextResponse.redirect(landing, 303);
  }

  return response;
}
