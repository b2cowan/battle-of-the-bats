import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { signupVerificationHtml } from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { COACHES_START_PATH, normalizeCoachPortalNext } from '@/lib/coaches-portal-routes';
import { captureError, captureAndJson, withObservability } from '@/lib/observability';

function shouldRequireEmailVerification() {
  const explicit = process.env.REQUIRE_SIGNUP_EMAIL_VERIFICATION;
  if (explicit !== undefined) return explicit === 'true';
  return process.env.NODE_ENV === 'production';
}

async function rollbackAuthUser(id: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) console.error('Coaches Portal signup rollback auth user error:', error);
}

function normalizeNext(value: unknown): string {
  return typeof value === 'string'
    ? normalizeCoachPortalNext(value.slice(0, 240), COACHES_START_PATH)
    : COACHES_START_PATH;
}

export const POST = withObservability(async (req: Request) => {
  let userId: string | null = null;

  try {
    const { email, password, next, firstName, lastName } = await req.json();
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const normalizedPassword = String(password ?? '');
    const safeNext = normalizeNext(next);
    // Coach's real name (collected at signup so a Basic account isn't nameless). Optional here so a
    // signed-in / claim caller isn't blocked; the signup form enforces it before this call.
    const first = String(firstName ?? '').trim().slice(0, 80);
    const last = String(lastName ?? '').trim().slice(0, 80);
    const fullName = `${first} ${last}`.trim();
    // display_name too, matching the coach-signup route — the platform-admin org-detail member list
    // reads display_name with no fallback, so omitting it would show a blank name there.
    const userMetadata = (first || last)
      ? { first_name: first, last_name: last, full_name: fullName, display_name: fullName }
      : undefined;

    if (!normalizedEmail || !normalizedPassword) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }
    if (normalizedPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const requireVerification = shouldRequireEmailVerification();
    const origin =
      req.headers.get('origin') ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'https://www.fieldlogichq.ca';

    if (requireVerification && !process.env.RESEND_API_KEY) {
      return captureAndJson(
        new Error('Signup email verification required but RESEND_API_KEY is not configured'),
        { error: 'Email verification is not configured.' },
        500,
      );
    }

    let actionLink: string | null = null;

    if (requireVerification) {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: normalizedEmail,
        password: normalizedPassword,
        options: {
          data: userMetadata,
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
        },
      });

      if (linkError || !linkData?.user || !linkData.properties?.action_link) {
        const message = linkError?.message ?? 'Failed to create verification link.';
        const status = message.toLowerCase().includes('already') ? 409 : 400;
        return NextResponse.json({ error: message }, { status });
      }

      userId = linkData.user.id;
      actionLink = linkData.properties.action_link;
    } else {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: normalizedPassword,
        email_confirm: true,
        user_metadata: userMetadata,
      });

      if (authError || !authData.user) {
        const message = authError?.message ?? 'Failed to create user account.';
        const status = message.toLowerCase().includes('already') ? 409 : 400;
        return NextResponse.json({ error: message }, { status });
      }

      userId = authData.user.id;
    }

    if (requireVerification) {
      if (!actionLink) {
        if (userId) await rollbackAuthUser(userId);
        return captureAndJson(
          new Error('generateLink returned no action_link for signup verification'),
          { error: 'Failed to generate verification email.' },
          500,
        );
      }

      const verifyUrl = `${origin}/auth/signup-confirm?link=${encodeURIComponent(actionLink)}`;
      await sendTransactionalEmail({
        key: 'signup_verification',
        to: normalizedEmail,
        vars: { orgName: 'your Coaches Portal', verifyUrl },
        defaultSubject: 'Verify your FieldLogicHQ email',
        defaultHtml: signupVerificationHtml({ orgName: 'your Coaches Portal', verifyUrl }),
      });

      return NextResponse.json({
        success: true,
        requiresEmailVerification: true,
        email: normalizedEmail,
      });
    }

    return NextResponse.json({ success: true, requiresEmailVerification: false, email: normalizedEmail });
  } catch (err) {
    console.error('Coaches Portal signup route error:', err);
    await captureError(err, { route: '/api/auth/team-signup', method: 'POST', statusCode: 500 });
    if (userId) {
      await rollbackAuthUser(userId).catch(() => {});
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}, { route: '/api/auth/team-signup' });
