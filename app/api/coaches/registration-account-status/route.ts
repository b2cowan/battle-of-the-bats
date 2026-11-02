import { NextRequest, NextResponse } from 'next/server';
import { getRegistrationAccountStatus } from '@/lib/basic-coach-teams';
import { withObservability, captureAndJson } from '@/lib/observability';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';
import { TOO_MANY } from '@/lib/public-form-throttle';

const MINUTE = 60_000;
const ipLimiter = new FixedWindowRateLimiter(15 * MINUTE, 20);            // per source IP (spoofable → global backstop)
const globalLimiter = new FixedWindowRateLimiter(5 * MINUTE, 300);        // ceiling across all callers
const registrationLimiter = new FixedWindowRateLimiter(15 * MINUTE, 10); // per registration: a forwarded link cannot be used to guess its address

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Signed-out-safe: tells the /coaches/join landing whether the address a visitor TYPED is the one this tournament
 * registration was made with, and if so whether that coach ALREADY has an account, so the page can offer "sign in to see
 * {team}" instead of a redundant "create account" form (the merged register+account flow already created it).
 *
 * Signed-in family accounts Stage 2 (Part 3): the address no longer rides in the link, so the page asks for it. That makes
 * this a box anyone can type into, so it has limits of its own (per source, per registration, and together), and it answers
 * only for a caller who holds a real registrationId (an unguessable id sent to the coach) AND names its own stored email.
 * It still answers nothing about any other address: a mismatch is `{ matches: false, accountExists: false }`, the same for
 * an unknown registration, so it cannot be used to ask whether some address has an account.
 */
export const GET = withObservability(async (req: NextRequest) => {
  try {
    if (!ipLimiter.take(clientIpFrom(req)) || !globalLimiter.take('global')) {
      return json({ error: TOO_MANY }, 429);
    }

    const url = new URL(req.url);
    const registrationId = (url.searchParams.get('registrationId') ?? '').trim();
    const email = url.searchParams.get('email') ?? '';

    if (!registrationId || !email.trim()) {
      return json({ matches: false, accountExists: false });
    }
    if (!registrationLimiter.take(registrationId)) {
      return json({ error: TOO_MANY }, 429);
    }

    const status = await getRegistrationAccountStatus({ registrationId, email });
    if (!status) {
      // Registration/email don't line up — say nothing more (no oracle on any other address).
      return json({ matches: false, accountExists: false });
    }

    return json({
      matches: true,
      accountExists: status.accountExists,
      teamName: status.teamName,
    });
  } catch (error) {
    // A failed check is not "no account" and not "wrong address": the page says it couldn't check, and the coach tries again.
    return captureAndJson(error, { error: 'We couldn’t check that just now. Please try again.' }, 500);
  }
}, { route: '/api/coaches/registration-account-status' });
