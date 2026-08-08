import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { assertSafeSupabaseServerEnvironment } from '@/lib/supabase-safety';
import { getDemoOrgByKind } from '@/lib/demo-org';
import { attachDemoSession } from '@/lib/demo-session';
import { resolveSameHostOrigin, isTrustedAppOrigin } from '@/lib/app-origin';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';
import { captureError } from '@/lib/observability';
import { COACH_CONFIRM_PATH } from '@/lib/sandbox-door';

/**
 * The coach confirm screen's one button: swap this browser's session for the demo coach's.
 *
 * The twin of `/api/sandbox/switch` — read that route's docblock for why this is a POST, why it
 * checks its Origin, and why it takes NO input. The account it signs in is a compile-time
 * constant checked against the allow-list inside `attachDemoSession`; each sandbox keeps its own
 * endpoint so that constant never becomes a parameter.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MINUTE = 60_000;
const ipLimiter = new FixedWindowRateLimiter(10 * MINUTE, 10);
const globalLimiter = new FixedWindowRateLimiter(5 * MINUTE, 150);

export async function POST(request: NextRequest) {
  assertSafeSupabaseServerEnvironment('See-it-live coach session swap');

  const origin = resolveSameHostOrigin(request);
  const demo = getDemoOrgByKind('coach');
  if (!demo) return NextResponse.redirect(new URL('/for-coaches', origin), 303);

  const landing = new URL(demo.landingPath, origin);
  const confirmScreen = new URL(COACH_CONFIRM_PATH, origin);

  // Same-origin only — see the tournament twin.
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin && !isTrustedAppOrigin(requestOrigin)) {
    return NextResponse.redirect(confirmScreen, 303);
  }

  const ip = clientIpFrom(request);
  if (!ipLimiter.take(ip) || !globalLimiter.take('global')) {
    console.warn(`[see-it-live/switch-coach] rate-limited session swap ip=${ip}`);
    return NextResponse.redirect(confirmScreen, 303);
  }

  // 303 so the browser follows with a GET — a POST redirected as-is would re-submit.
  const response = NextResponse.redirect(landing, 303);
  try {
    // One write, one outcome: the demo's cookies land over whatever was there, which IS the
    // sign-out the visitor agreed to.
    await attachDemoSession(request, response, demo.organizerEmail);
  } catch (err) {
    await captureError(err, { route: '/api/sandbox/switch-coach', method: 'POST', severity: 'critical' });
    // Their own session is untouched — the write either landed or it didn't. The coach portal
    // would bounce a stranger to login, so the honest degraded landing is the marketing page.
    return NextResponse.redirect(new URL('/for-coaches', origin), 303);
  }

  return response;
}
