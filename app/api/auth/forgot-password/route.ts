import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { platformPasswordResetHtml } from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { withObservability } from '@/lib/observability';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';
import { registrationReturnPath } from '@/lib/consumer-routes';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';
import { holdUntilFloor } from '@/lib/no-tell-floor';

// The same budget as "Send the link again" (app/api/auth/resend-verification): an address gets three reset emails an
// hour, a network ten tries in 15 minutes, and the route a ceiling, so it cannot be used to flood an inbox (owner,
// 2026-10-20, after the First Look 2c review). A refusal names no account: the per-address count runs for every address.
const MINUTE = 60_000;
const ipLimiter = new FixedWindowRateLimiter(15 * MINUTE, 10);
const emailLimiter = new FixedWindowRateLimiter(60 * MINUTE, 3);
const globalLimiter = new FixedWindowRateLimiter(5 * MINUTE, 60);

export const POST = withObservability(async (req: NextRequest) => {
  const startedAt = Date.now();
  const body = await req.json().catch(() => ({})) as { email?: unknown; next?: unknown };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) {
    await holdUntilFloor(startedAt);
    return NextResponse.json({ ok: true }); // never reveal whether email exists
  }
  if (!ipLimiter.take(clientIpFrom(req)) || !emailLimiter.take(email) || !globalLimiter.take('global')) {
    return NextResponse.json({ error: 'Too many requests. Please wait a few minutes and try again.' }, { status: 429 });
  }
  try {
    await sendReset(req, email, body.next);
  } finally {
    // Every answer leaves at the same time, so a found account (a link made, an email sent) is not slower to answer.
    await holdUntilFloor(startedAt);
  }
  return NextResponse.json({ ok: true });
}, { route: '/api/auth/forgot-password' });

async function sendReset(req: NextRequest, email: string, next: unknown): Promise<void> {
  // A coach who reset from a registration form returns to it (Register Your Existing Team, Stage 1,
  // 2026-10-13). Only a public registration page is honoured; it rides on OUR confirm link, not on
  // Supabase's redirect (whose allow-list is not this code's to widen), and the confirm page carries
  // it across the reset in the same tab.
  const returnTo = registrationReturnPath(next);

  // Trusted base URL for the emailed reset link. The request Origin is honored only when it is one
  // of our own hosts (preserving the dev-vs-prod "return where I started" behavior); an attacker
  // host is rejected and we fall back to the canonical app URL — see resolveTrustedAppOrigin.
  const origin = resolveTrustedAppOrigin(req);

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: `${origin}/auth/reset-password`,
    },
  });

  if (error || !data?.properties?.action_link) {
    console.error('[forgot-password] generateLink error:', error?.message);
    return; // the caller still answers 200 — no enumeration
  }

  // Wrap the Supabase action_link in our own confirm page so email scanners
  // can't consume the one-time token by pre-fetching anchor hrefs in the email.
  const confirmUrl = `${origin}/auth/reset-confirm?link=${encodeURIComponent(data.properties.action_link)}`
    + (returnTo ? `&next=${encodeURIComponent(returnTo)}` : '');

  try {
    // Operator override applies when customised; otherwise the built-in reset email
    // sends unchanged. (Wires the previously-orphaned `password_reset` template to the
    // live reset flow.)
    await sendTransactionalEmail({
      key: 'password_reset',
      to: email,
      vars: { resetLink: confirmUrl },
      defaultSubject: 'Reset your FieldLogicHQ password',
      defaultHtml: platformPasswordResetHtml(confirmUrl),
    });
    console.log(`[forgot-password] reset email sent to ${email}`);
  } catch (emailErr) {
    console.error('[forgot-password] sendEmail error:', emailErr);
  }
}
