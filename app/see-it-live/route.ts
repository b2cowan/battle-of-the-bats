import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { assertSafeSupabaseServerEnvironment } from '@/lib/supabase-safety';
import { getDemoOrgByKind, isDemoOrganizerEmail } from '@/lib/demo-org';
import { demoOrgIdForSlug } from '@/lib/demo-org-server';
import { attachDemoSession, currentSessionUser } from '@/lib/demo-session';
import { resolveSameHostOrigin } from '@/lib/app-origin';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';
import { captureError } from '@/lib/observability';
import { SANDBOX_CONFIRM_PATH } from '@/lib/sandbox-door';

/**
 * `/see-it-live` — THE door into the tournament sandbox (slice S3).
 *
 * A prospect presses "See it live" on the marketing site and arrives, with no login and no email,
 * on a real tournament that is running right now. That posture is a binding decision
 * (`BUSINESS_DECISIONS.md`, 2026-08-02, "The product demo is UNGATED at the door"): **no form, no
 * interstitial, no lead capture, ever.** Nothing may be added here that asks the visitor for
 * anything.
 *
 * ── Why a shared, no-login session is safe ──────────────────────────────────────────────────
 *
 * Because of what it can reach, not because of who presses it:
 *
 *  1. **The account is hardcoded.** It comes from `lib/demo-org.ts` and nothing derived from the
 *     request can influence it. There is no `email`, no `account`, and deliberately **no `next` /
 *     redirect parameter at all** — the landing path is a constant on the allow-list entry. A door
 *     that took a redirect target would be an open-redirect wearing a marketing button.
 *  2. **That account cannot write.** Slice S2's chokepoint (`proxy.ts` + `lib/demo-guard.ts`)
 *     refuses every non-GET aimed at a demo org, above every route and session check. The block was
 *     built and verified BEFORE this door existed, which is the whole point of the slice order.
 *  3. **That account cannot contact anyone.** Three independent outbound chokepoints refuse the
 *     demo org, and every contact in the seed is an unreachable `@example.com` address.
 *
 * So the worst case for a stranger holding this session is: a stranger looking at made-up teams.
 *
 * ── The one visitor who gets asked something ────────────────────────────────────────────────
 *
 * Establishing this session REPLACES whatever session the browser already held. For a prospect —
 * everyone this door is for — there is nothing to replace and they walk straight in, which is what
 * the ungated ruling protects. For somebody already signed in, walking straight in would sign a
 * paying customer out of their own account without warning. So that one visitor, and only that
 * visitor, is sent to a confirm screen (`/see-it-live/switch`) that tells them what will happen and
 * offers the fan side as the alternative.
 *
 * **That is not a gate and does not weaken the ruling.** The ruling forbids asking a stranger for
 * something before they may come in; this asks a customer for permission before we touch their
 * account. Nothing is collected either way, and a logged-out visitor never sees it.
 * (Owner ruling 2026-08-03, taking option (a) of the three put to them.)
 *
 * ── The redirect host ───────────────────────────────────────────────────────────────────────
 *
 * ⚠ This route SETS A SESSION COOKIE AND REDIRECTS IN THE SAME BREATH, so the two must land on the
 * same host or the cookie is thrown away. It used to resolve the CANONICAL origin here, which meant
 * a visitor arriving on the apex `fieldlogichq.ca` had their session written for the apex and was
 * then sent to `www` — where the browser correctly refuses to send it. They arrived anonymous, on a
 * door whose entire promise is "no login". (Traced live on production 2026-08-07.)
 *
 * `resolveSameHostOrigin` keeps them where they are and still validates the host through the same
 * predicate the email path uses, so an unrecognised host falls back to canonical. The
 * account-takeover shape the canonical fallback exists to stop is an emailed link carrying a live
 * token — see `lib/app-origin.ts` for why that reasoning does not transfer to a redirect the
 * visitor follows on this request.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Abuse controls. One shared no-login door is a scraping target, and each press costs a Supabase
// admin call. Nothing here is writable, so the exposure is read load on one small tournament —
// watch it, don't gate for it (plan, Risks). Per-IP first so a throttled abuser cannot spend the
// shared global allowance; the global ceiling is the spoofing-proof backstop. Best-effort and
// per-Lambda-instance, exactly like /api/auth/signup.
const MINUTE = 60_000;
const ipLimiter = new FixedWindowRateLimiter(10 * MINUTE, 10);
const globalLimiter = new FixedWindowRateLimiter(5 * MINUTE, 150);

/** Where a visitor goes when there is no sandbox to show them. Never a 404. */
const FALLBACK_PATH = '/for-tournament-organizers';

/**
 * "The sandbox isn't seeded here" is a standing condition, not an event: while it holds, EVERY
 * press reports it. Reported once per process it is an alert; reported per request it is a flood
 * that buries the alert — and the demo-org alert suppression cannot help, because at this point we
 * have no org to attribute it to. So it pages once and then goes quiet.
 */
let unseededAlreadyReported = false;

export async function GET(request: NextRequest) {
  assertSafeSupabaseServerEnvironment('See-it-live demo door');

  const origin = resolveSameHostOrigin(request);
  const demo = getDemoOrgByKind('tournament');

  // No tournament sandbox is registered in the allow-list at all (it is a compile-time constant,
  // so this is a "not built yet" state rather than a runtime failure).
  if (!demo) return NextResponse.redirect(new URL(FALLBACK_PATH, origin));

  const landing = new URL(demo.landingPath, origin);

  // Meter FIRST, before anything that costs a query, a Supabase round-trip or an alert.
  //
  // The first build metered only the branch that establishes a session, which left the failure
  // branches below completely unprotected: hammering the door in an environment where the sandbox
  // is not seeded spent an uncapped lookup and an uncapped `critical` capture per request — the
  // exact abuse these limiters exist to stop, on the one path where we are already unhappy.
  // A throttled caller still lands somewhere real; see below.
  const ip = clientIpFrom(request);
  const withinBudget = ipLimiter.take(ip) && globalLimiter.take('global');
  if (!withinBudget) {
    console.warn(`[see-it-live] rate-limited demo door press ip=${ip}`);
    // Still land them on the fan page — it is public, it is live, and it is most of the demo.
    // A prospect who pressed a marketing button should never meet a 429.
    return NextResponse.redirect(landing);
  }

  // Is the sandbox actually seeded in THIS environment? Rides the demo-org id cache, so it is one
  // query on the first press and free thereafter. A prospect must never meet a 404.
  let seeded = false;
  try {
    seeded = (await demoOrgIdForSlug(demo.slug)) !== null;
  } catch (err) {
    await captureError(err, { route: '/see-it-live', method: 'GET', severity: 'critical' });
    return NextResponse.redirect(new URL(FALLBACK_PATH, origin));
  }
  if (!seeded) {
    if (!unseededAlreadyReported) {
      unseededAlreadyReported = true;
      await captureError(
        new Error(`See-it-live pressed but the demo org "${demo.slug}" is not seeded here`),
        { route: '/see-it-live', method: 'GET', severity: 'critical' },
      );
    }
    return NextResponse.redirect(new URL(FALLBACK_PATH, origin));
  }

  // ── Who is already here? ────────────────────────────────────────────────────────────────────
  //
  // Keyed on the SESSION, not on an email. An account without an email address (Supabase supports
  // phone and anonymous identities; this app does not mint them today, but the door must not be the
  // thing that assumes so) would otherwise read as "nobody is here" and have its session silently
  // replaced — the precise harm the confirm screen exists to prevent. Fail toward asking.
  const session = await currentSessionUser(request);
  if (session) {
    if (session.email === demo.organizerEmail) {
      // Already the demo organizer — a second press, or a returning visitor. Nothing to do.
      return NextResponse.redirect(landing);
    }
    if (session.email && isDemoOrganizerEmail(session.email)) {
      // The coach sandbox's shared demo account. Nothing of theirs to protect — swap silently,
      // so a prospect walking from one demo to the other never meets a warning about "their"
      // account that was never theirs.
      const response = NextResponse.redirect(landing);
      try {
        await attachDemoSession(request, response, demo.organizerEmail);
      } catch (err) {
        await captureError(err, { route: '/see-it-live', method: 'GET', severity: 'critical' });
        return NextResponse.redirect(landing);
      }
      return response;
    }
    // Somebody else's account. Ask before touching it.
    return NextResponse.redirect(new URL(SANDBOX_CONFIRM_PATH, origin));
  }

  const response = NextResponse.redirect(landing);
  try {
    await attachDemoSession(request, response, demo.organizerEmail);
  } catch (err) {
    // Graceful degradation, on purpose: the fan side is anonymous and is the half that proves the
    // demo is live within seconds. A prospect gets the tournament; we get paged.
    await captureError(err, { route: '/see-it-live', method: 'GET', severity: 'critical' });
    return NextResponse.redirect(landing);
  }

  return response;
}
