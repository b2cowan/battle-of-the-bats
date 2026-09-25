import { NextResponse } from 'next/server';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';

/**
 * One throttle for the PUBLIC family forms — house-league registration, the registration status
 * lookup, and rep-team tryout registration. All three are unauthenticated, all three write or read
 * personal details, and the two registration forms send an email to an address the CALLER chooses
 * (Club Tier Readiness I01 / trust-plan defect 6, 2026-09-25). Until this module none of them had
 * any limit at all.
 *
 * Budgets are sized for a registration-night rush from one shared network (a school, a community
 * centre), not for the signup route's one-workspace-per-person shape, so they are looser than
 * /api/auth/signup's. Best-effort per instance, like every limiter in `lib/rate-limit.ts`; the
 * global bucket is the spoofing-proof backstop behind the per-IP one. The three forms share the
 * buckets on purpose: it is one visitor's budget for the public forms, not three.
 */
const MINUTE = 60_000;
const ipLimiter = new FixedWindowRateLimiter(60 * MINUTE, 30);        // per source IP (spoofable → global backstop)
const globalLimiter = new FixedWindowRateLimiter(5 * MINUTE, 150);    // ceiling across all callers
const recipientLimiter = new FixedWindowRateLimiter(60 * MINUTE, 8);  // per guardian email — caps mail to one inbox

const TOO_MANY = 'Too many attempts. Please wait a few minutes and try again.';

/** Call first thing in the handler. Returns a 429 to send back, or null to carry on. */
export function throttlePublicForm(req: Request): NextResponse | null {
  if (!ipLimiter.take(clientIpFrom(req)) || !globalLimiter.take('global')) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }
  return null;
}

/**
 * Call once the guardian email is validated, before anything is written or sent. A family
 * registering several children stays well inside the budget; a script mailing one stranger's
 * inbox from rotating addresses does not.
 */
export function throttlePublicFormRecipient(email: string): NextResponse | null {
  if (!recipientLimiter.take(email.trim().toLowerCase())) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }
  return null;
}
