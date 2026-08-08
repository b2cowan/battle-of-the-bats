import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { assertSafeSupabaseServerEnvironment } from '@/lib/supabase-safety';
import { getDemoOrgByKind, isDemoOrganizerEmail } from '@/lib/demo-org';
import { demoOrgIdForSlug } from '@/lib/demo-org-server';
import { attachDemoSession, currentSessionUser } from '@/lib/demo-session';
import { resolveSameHostOrigin } from '@/lib/app-origin';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';
import { captureError } from '@/lib/observability';
import { COACH_CONFIRM_PATH } from '@/lib/sandbox-door';

/**
 * `/see-it-live/coaches` — THE door into the coach sandbox.
 *
 * The coach twin of `/see-it-live` (read that route's docblock for the full argument — the safety
 * case, the ungated-door ruling, and why there is deliberately no `next`/redirect parameter).
 * Everything there holds here; what differs is the world behind the door:
 *
 *  · The account is the ONE demo coach from `lib/demo-org.ts` — an org member with role `coach`,
 *    so this session cannot see an admin surface even before the write block refuses it.
 *  · The landing is the mid-season team's Overview (the phase dock's default moment).
 *  · There is NO public fan side to fall back to — the coach portal sits behind sign-in — so
 *    every degraded path lands on the coaches marketing page instead of a half-open door.
 *
 * One behavior the tournament door gained at the same time: a visitor already holding the OTHER
 * sandbox's shared demo session is swapped silently instead of being asked. The confirm screen
 * exists to protect a customer's own session; a shared fictional account is not one.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Same abuse posture as the tournament door: per-IP first so a throttled abuser cannot spend the
// shared global allowance; global ceiling as the spoofing-proof backstop.
const MINUTE = 60_000;
const ipLimiter = new FixedWindowRateLimiter(10 * MINUTE, 10);
const globalLimiter = new FixedWindowRateLimiter(5 * MINUTE, 150);

/** Where a visitor goes when there is no sandbox to show them. Never a 404, never a login wall. */
const FALLBACK_PATH = '/for-coaches';

/** "Not seeded here" is a standing condition — page once, then go quiet (see `/see-it-live`). */
let unseededAlreadyReported = false;

export async function GET(request: NextRequest) {
  assertSafeSupabaseServerEnvironment('See-it-live coach demo door');

  const origin = resolveSameHostOrigin(request);
  const demo = getDemoOrgByKind('coach');
  if (!demo) return NextResponse.redirect(new URL(FALLBACK_PATH, origin));

  const landing = new URL(demo.landingPath, origin);

  // Meter FIRST — before anything that costs a query, a Supabase round-trip or an alert. Unlike
  // the tournament door there is no public half to degrade to, so a throttled press lands on the
  // marketing page rather than a 429.
  const ip = clientIpFrom(request);
  const withinBudget = ipLimiter.take(ip) && globalLimiter.take('global');
  if (!withinBudget) {
    console.warn(`[see-it-live/coaches] rate-limited demo door press ip=${ip}`);
    return NextResponse.redirect(new URL(FALLBACK_PATH, origin));
  }

  // Is the coach sandbox seeded in THIS environment? Rides the demo-org id cache.
  let seeded = false;
  try {
    seeded = (await demoOrgIdForSlug(demo.slug)) !== null;
  } catch (err) {
    await captureError(err, { route: '/see-it-live/coaches', method: 'GET', severity: 'critical' });
    return NextResponse.redirect(new URL(FALLBACK_PATH, origin));
  }
  if (!seeded) {
    if (!unseededAlreadyReported) {
      unseededAlreadyReported = true;
      await captureError(
        new Error(`See-it-live (coaches) pressed but the demo org "${demo.slug}" is not seeded here`),
        { route: '/see-it-live/coaches', method: 'GET', severity: 'critical' },
      );
    }
    return NextResponse.redirect(new URL(FALLBACK_PATH, origin));
  }

  // Who is already here? Keyed on the SESSION, not an email (see lib/demo-session.ts).
  const session = await currentSessionUser(request);
  if (session) {
    if (session.email === demo.organizerEmail) {
      // Already the demo coach — a second press, or a returning visitor. Nothing to do.
      return NextResponse.redirect(landing);
    }
    if (session.email && isDemoOrganizerEmail(session.email)) {
      // The OTHER sandbox's shared demo account. Nothing of theirs to protect — swap silently,
      // so a prospect walking from one demo to the other never meets a warning about "their"
      // account that was never theirs.
      const response = NextResponse.redirect(landing);
      try {
        await attachDemoSession(request, response, demo.organizerEmail);
      } catch (err) {
        await captureError(err, { route: '/see-it-live/coaches', method: 'GET', severity: 'critical' });
        return NextResponse.redirect(new URL(FALLBACK_PATH, origin));
      }
      return response;
    }
    // Somebody's real account. Ask before touching it.
    return NextResponse.redirect(new URL(COACH_CONFIRM_PATH, origin));
  }

  const response = NextResponse.redirect(landing);
  try {
    await attachDemoSession(request, response, demo.organizerEmail);
  } catch (err) {
    // No anonymous half to degrade to here: land on the marketing page, get paged.
    await captureError(err, { route: '/see-it-live/coaches', method: 'GET', severity: 'critical' });
    return NextResponse.redirect(new URL(FALLBACK_PATH, origin));
  }

  return response;
}
