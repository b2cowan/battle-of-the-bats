import { NextRequest, NextResponse } from 'next/server';
import { authAccountExistsForEmail } from '@/lib/auth-account-lookup';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';
import { withObservability, captureAndJson } from '@/lib/observability';
import { isValidEmail } from '@/lib/auth-errors';

/**
 * Step 1 of the registration form (owner A1, 2026-10-13): "does this email have an account?" — so a
 * returning coach is asked for their password BEFORE any team name is typed, and a new one goes
 * straight to the new-coach form with the email filled in. Today's form learned it only at Submit,
 * then sent the coach back to the form (F2 of `COACH_REGISTER_EXISTING_TEAM_PLAN.md`).
 *
 * ⚠ IT REVEALS NOTHING THE FORM DID NOT ALREADY. Submitting today's form with any address answers
 * the same question (a 409 from coach-signup turns into "This email already has a FieldLogicHQ
 * account"). What this adds is a cheap way to ask it, so it is RATE-LIMITED as sign-in effectively is
 * (Supabase throttles password attempts per IP): per source IP, a spoofing-proof global ceiling, and
 * per address — a registration-night rush from one rink's wifi stays inside it, a script walking a
 * list of addresses does not. Best-effort per instance, like every limiter in `lib/rate-limit.ts`.
 *
 * A FieldLogicHQ staff email is refused exactly as `/api/register` and coach-signup refuse it: staff
 * are not coaches, and the form must not offer them a sign-in it will then refuse at Submit.
 *
 * ⚠ Its OWN buckets, not `lib/public-form-throttle.ts`'s, on purpose: those are one visitor's budget
 * for the public forms' writes, and a coach checking an address must not spend the registration it is
 * about to submit.
 */
const MINUTE = 60_000;
const ipLimiter = new FixedWindowRateLimiter(15 * MINUTE, 30);       // per source IP (spoofable → global backstop)
const globalLimiter = new FixedWindowRateLimiter(5 * MINUTE, 300);   // ceiling across all callers
const emailLimiter = new FixedWindowRateLimiter(15 * MINUTE, 10);    // per address asked about

const TOO_MANY = 'Too many attempts. Please wait a few minutes and try again.';

export const POST = withObservability(async (req: NextRequest) => {
  if (!ipLimiter.take(clientIpFrom(req)) || !globalLimiter.take('global')) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as { email?: unknown };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (!emailLimiter.take(email)) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }
  if (await isPlatformAdminEmail(email)) {
    return NextResponse.json({ error: 'This email address cannot be used to register a team.' }, { status: 403 });
  }

  try {
    return NextResponse.json({ exists: await authAccountExistsForEmail(email) });
  } catch (err) {
    // The lookup fails CLOSED (it throws rather than guess "no account"): say so, and let the coach
    // try again — guessing "new coach" would send a returning one into the create-account form.
    return captureAndJson(err, { error: 'We couldn’t check that email just now. Please try again.' }, 500);
  }
}, { route: '/api/register/account-check' });
