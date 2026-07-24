import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { withObservability, captureError } from '@/lib/observability';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export const POST = withObservability(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({})) as {
    email?: unknown;
    password?: unknown;
    firstName?: unknown;
    lastName?: unknown;
  };

  const email     = typeof body.email     === 'string' ? body.email.trim().toLowerCase() : '';
  const password  = typeof body.password  === 'string' ? body.password : '';
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName  = typeof body.lastName  === 'string' ? body.lastName.trim()  : '';

  if (!email || !password) {
    return json({ error: 'Email and password are required.' }, 400);
  }
  if (!firstName || !lastName) {
    return json({ error: 'Enter your first and last name.' }, 400);
  }
  if (password.length < 8) {
    return json({ error: 'Password must be at least 8 characters.' }, 400);
  }
  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }
  // FieldLogicHQ staff are NOT coaches — block before createUser so a public form can't
  // create an orphaned coach account on a staff email (also guards /coaches/join + /start/team).
  if (await isPlatformAdminEmail(email)) {
    return json({ error: 'This email address cannot be used to register a team.' }, 403);
  }

  // Name parity with org signup: store the same four fields on the auth user so
  // platform-admin support views (which read display_name / full_name) and the
  // email greetings (which greet by first_name) have the coach's real name. Without
  // this a coach account had blank user_metadata while an org owner did not.
  const fullName = `${firstName} ${lastName}`.trim();
  const { error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // intent confirmed by completing the registration form
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      display_name: fullName,
    },
  });

  if (error) {
    // Supabase returns "User already registered" for duplicate emails
    if (
      error.message?.toLowerCase().includes('already registered') ||
      error.message?.toLowerCase().includes('already exists') ||
      error.status === 422
    ) {
      return json({ error: 'email_exists' }, 409);
    }
    // Pipe the REAL failure into the existing observability pipeline (same path org signup /
    // org create already use) so the platform-admin issue AND the production alert email carry
    // the actual cause — e.g. an auth signing-key error — instead of a generic "HTTP 500". Signup
    // is on the critical-route allowlist, so this escalates to a critical alert on first occurrence.
    // captureError never throws and, by marking the request captured, replaces withObservability's
    // generic returned-5xx fallback with this rich attribution (no double-count).
    await captureError(error, {
      statusCode: 500,
      user: { email },
      requestContext: {
        operation: 'supabaseAdmin.auth.admin.createUser',
        supabaseStatus: error.status ?? null,
        supabaseCode: (error as { code?: string }).code ?? null,
      },
    });
    return json({ error: 'Account could not be created. Please try again.' }, 500);
  }

  return json({ ok: true });
}, { route: '/api/auth/coach-signup' });
