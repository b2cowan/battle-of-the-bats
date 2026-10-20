import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { withObservability, captureError } from '@/lib/observability';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';
import { findAuthUserByEmail } from '@/lib/auth-account-lookup';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';
import {
  sendSignupVerificationEmail, shouldRequireEmailVerification, verificationRedirect, verificationReturnPath,
} from '@/lib/signup-verification';
import { readStartDoor } from '@/lib/start-door';

/**
 * "Send the link again" on every check-your-email screen (owner V3, 2026-10-16; hub SIGNUP_EMAIL_VERIFICATION_HUB.html).
 *
 * Sends a fresh link to an account that is still waiting to verify. It is a MAGIC LINK, not a new signup link: a signup
 * link for an existing address would overwrite the waiting account's password, while opening a magic link confirms
 * the email and keeps it (proven on dev 2026-10-16). The answer is the same whether or not anything was sent — no
 * account exists, it is already verified, it is staff — so this can't be used to learn which emails have accounts.
 *
 * An account made by a start sign-up remembers its door (lib/start-door.ts): when the asking screen names no
 * destination of its own — sign-in (owner A7) — the link lands on that door's step 2.
 */
const MINUTE = 60_000;
const ipLimiter = new FixedWindowRateLimiter(15 * MINUTE, 10);
const emailLimiter = new FixedWindowRateLimiter(60 * MINUTE, 3);
const globalLimiter = new FixedWindowRateLimiter(5 * MINUTE, 60);
const SENT = { ok: true };

export const POST = withObservability(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({})) as { email?: unknown; next?: unknown; continueName?: unknown };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  const ip = clientIpFrom(req);
  if (!ipLimiter.take(ip) || !emailLimiter.take(email) || !globalLimiter.take('global')) {
    return NextResponse.json({ error: 'Too many requests. Please wait a few minutes and try again.' }, { status: 429 });
  }
  if (!shouldRequireEmailVerification() || await isPlatformAdminEmail(email)) return NextResponse.json(SENT);

  const user = await findAuthUserByEmail(email);
  if (!user || user.email_confirmed_at) return NextResponse.json(SENT);

  const origin = resolveTrustedAppOrigin(req);
  const door = readStartDoor(user.user_metadata)?.door;
  const next = verificationReturnPath(body.next, '/home', door);
  const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: verificationRedirect(origin, next) },
  });
  if (error || !link?.properties?.action_link) {
    await captureError(error ?? new Error('generateLink returned no action link'), {
      statusCode: 500, user: { email }, requestContext: { operation: 'supabaseAdmin.auth.admin.generateLink(magiclink)' },
    });
    return NextResponse.json(SENT);
  }
  const meta = (user.user_metadata ?? {}) as { first_name?: unknown };
  await sendSignupVerificationEmail({
    to: email,
    origin,
    actionLink: link.properties.action_link,
    next,
    door,
    // Only the tournament registration's resend sends its team name: that is a registration.
    registration: typeof body.continueName === 'string' && body.continueName.trim() !== '',
    firstName: typeof meta.first_name === 'string' ? meta.first_name : undefined,
    continueName: typeof body.continueName === 'string' ? body.continueName : null,
  });
  return NextResponse.json(SENT);
}, { route: '/api/auth/resend-verification' });
