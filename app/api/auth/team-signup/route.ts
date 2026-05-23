import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail, signupVerificationHtml } from '@/lib/email';

function shouldRequireEmailVerification() {
  const explicit = process.env.REQUIRE_SIGNUP_EMAIL_VERIFICATION;
  if (explicit !== undefined) return explicit === 'true';
  return process.env.NODE_ENV === 'production';
}

async function rollbackAuthUser(id: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) console.error('Team signup rollback auth user error:', error);
}

function normalizeNext(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') ? value.slice(0, 240) : '/team';
}

export async function POST(req: Request) {
  let userId: string | null = null;

  try {
    const { email, password, next } = await req.json();
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const normalizedPassword = String(password ?? '');
    const safeNext = normalizeNext(next);

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
      return NextResponse.json({ error: 'Email verification is not configured.' }, { status: 500 });
    }

    let actionLink: string | null = null;

    if (requireVerification) {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: normalizedEmail,
        password: normalizedPassword,
        options: {
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
        return NextResponse.json({ error: 'Failed to generate verification email.' }, { status: 500 });
      }

      const verifyUrl = `${origin}/auth/signup-confirm?link=${encodeURIComponent(actionLink)}`;
      await sendEmail(
        normalizedEmail,
        'Verify your FieldLogicHQ email',
        signupVerificationHtml({ orgName: 'your Team workspace', verifyUrl }),
      );

      return NextResponse.json({
        success: true,
        requiresEmailVerification: true,
        email: normalizedEmail,
      });
    }

    return NextResponse.json({ success: true, requiresEmailVerification: false, email: normalizedEmail });
  } catch (err) {
    console.error('Team signup route error:', err);
    if (userId) {
      await rollbackAuthUser(userId).catch(() => {});
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
