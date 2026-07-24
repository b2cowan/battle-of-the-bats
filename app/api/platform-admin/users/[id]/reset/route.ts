import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { platformPasswordResetHtml } from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { withObservability, captureAndJson } from '@/lib/observability';

export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPermission('manage_support');
  if (auth.response) return auth.response;

  // id param is present but unused — email is the key for generateLink
  await params;

  const body = await req.json() as { email?: string };
  const { email } = body;

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  // SECURITY: build the reset destination from a trusted server-side constant, NOT the request
  // Origin header. This route emails the link to the CUSTOMER, but the request is made by a support
  // operator — deriving the host from operator-controlled input (Origin is settable on a scripted,
  // non-browser request) would let a crafted request point a real reset email (carrying a live,
  // one-time recovery token) at an attacker-controlled host. The operator is always on the canonical
  // admin domain, so a fixed base URL is both correct and the safe choice here.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    // Land on the dedicated set-password page (which catches the recovery token in the URL and
    // shows the "Set New Password" form). Pointing at /auth/login dead-ends the customer on the
    // sign-in screen. Matches the customer-facing forgot-password flow.
    options: {
      redirectTo: `${baseUrl}/auth/reset-password`,
    },
  });

  if (error || !data?.properties?.action_link) {
    console.error('[platform-admin] generateLink error:', error);
    return captureAndJson(
      error ?? new Error('generateLink returned no action_link for password reset'),
      { error: 'Failed to send reset email' },
      500,
    );
  }

  // SECURITY: never return the recovery link to the operator. The action_link is a live,
  // one-time credential — anyone who opens it is signed in AS the customer. Email it straight
  // to the customer instead (wrapped in the scan-safe confirm page, exactly like the
  // customer-facing forgot-password flow) so the operator never holds a usable session token.
  const confirmUrl = `${baseUrl}/auth/reset-confirm?link=${encodeURIComponent(data.properties.action_link)}`;
  try {
    await sendTransactionalEmail({
      key: 'password_reset',
      to: email,
      vars: { resetLink: confirmUrl },
      defaultSubject: 'Reset your FieldLogicHQ password',
      defaultHtml: platformPasswordResetHtml(confirmUrl),
    });
  } catch (emailErr) {
    console.error('[platform-admin] reset email send error:', emailErr);
    return captureAndJson(
      emailErr instanceof Error ? emailErr : new Error('reset email send failed'),
      { error: 'Failed to send reset email' },
      500,
    );
  }

  await writePlatformAuditLog(auth.user.email!, null, 'generate_reset_link', 'email', null, email);

  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/users/[id]/reset' });
