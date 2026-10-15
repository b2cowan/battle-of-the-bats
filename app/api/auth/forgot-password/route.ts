import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { platformPasswordResetHtml } from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { withObservability } from '@/lib/observability';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';
import { registrationReturnPath } from '@/lib/consumer-routes';

export const POST = withObservability(async (req: NextRequest) => {
  const { email, next } = await req.json();
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ ok: true }); // never reveal whether email exists
  }
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
    email: email.trim().toLowerCase(),
    options: {
      redirectTo: `${origin}/auth/reset-password`,
    },
  });

  if (error || !data?.properties?.action_link) {
    console.error('[forgot-password] generateLink error:', error?.message);
    return NextResponse.json({ ok: true }); // still 200 — no enumeration
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

  return NextResponse.json({ ok: true });
}, { route: '/api/auth/forgot-password' });
