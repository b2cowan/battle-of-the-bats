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

// The invitation accept page's "type the email" check and its new-account submit send no email, so they do not spend the
// per-address mail bucket (a stranger could otherwise burn a parent's registration budget with a made-up link). They are capped
// per INVITATION instead: that is what stops a link holder guessing the invited address behind its masked form (Stage 4a S2 review).
const invitationLimiter = new FixedWindowRateLimiter(60 * MINUTE, 10);

/** The one refusal sentence every public form shows. Exported so a test can pin that no form words it differently. */
export const TOO_MANY = 'Too many attempts. Please wait a few minutes and try again.';

// The early-access lead form has buckets of its own (Stage 7 Part 8 review): it is the one public form anyone can aim at a
// stranger's address, and its traffic must never spend the family registration forms' budget.
const leadIpLimiter = new FixedWindowRateLimiter(60 * MINUTE, 30);
const leadGlobalLimiter = new FixedWindowRateLimiter(5 * MINUTE, 150);

// The tournament Register form has buckets of its own too (Signed-in family accounts Stage 2, ask 4): same numbers and words as
// the family forms, but a coach registering a team must never spend a family's budget, nor the other way round.
const registerIpLimiter = new FixedWindowRateLimiter(60 * MINUTE, 30);
const registerGlobalLimiter = new FixedWindowRateLimiter(5 * MINUTE, 150);
const registerRecipientLimiter = new FixedWindowRateLimiter(60 * MINUTE, 8);

/** Call first thing in the handler. Returns a 429 to send back, or null to carry on. */
export function throttlePublicForm(req: Request): NextResponse | null {
  if (!ipLimiter.take(clientIpFrom(req)) || !globalLimiter.take('global')) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }
  return null;
}

/** Call first thing in the early-access lead form's handler: the same shape as `throttlePublicForm`, its own buckets. */
export function throttleLeadForm(req: Request): NextResponse | null {
  if (!leadIpLimiter.take(clientIpFrom(req)) || !leadGlobalLimiter.take('global')) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }
  return null;
}

/** Call first thing in the tournament Register handler: the same shape as `throttlePublicForm`, its own buckets. */
export function throttleRegisterForm(req: Request): NextResponse | null {
  if (!registerIpLimiter.take(clientIpFrom(req)) || !registerGlobalLimiter.take('global')) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }
  return null;
}

/** Call once the registrant's email is known, before anything is written or sent: at most 8 registrations an hour per address. */
export function throttleRegisterRecipient(email: string): NextResponse | null {
  if (!registerRecipientLimiter.take(email.trim().toLowerCase())) {
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

/** The accept page's address check and new-account submit: at most 10 tries an hour against one invitation link. */
export function throttleInvitationAttempt(token: string): NextResponse | null {
  if (!invitationLimiter.take(token)) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }
  return null;
}
