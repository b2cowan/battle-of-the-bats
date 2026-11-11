import { NextResponse } from 'next/server';
import { createClient as createPlainClient } from '@supabase/supabase-js';
import { withObservability } from '@/lib/observability';
import { getSessionTwoStep } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/lib/supabase-server';
import { isDemoOrganizerEmail } from '@/lib/demo-org';
import { freshCodeRefusal, hasFreshCode } from '@/lib/two-step-fresh';

const MIN_LENGTH = 8;

/**
 * CHANGE PASSWORD from Account › Sign-in & security (Board Ready · two-step sign-in, Part 2; ask 7: no signed-in person
 * could change it before). Asks for the current password, and a code from the last 15 minutes if two-step is on.
 *
 * ⚠ The trap (Part 1): the current password is checked on a client that keeps NO cookies, never the session's own client.
 * A password sign-in on the cookie client REPLACES the person's session with a password-only one, so a person with
 * two-step on would land on the code step mid-change. The session that check creates is signed out at once. The new
 * password is saved through the admin door (a two-step account's own password change needs the code level, and the
 * service cannot count our backup codes), then every OTHER session is signed out; this one stays. The service's "secure
 * password change" setting is neither relied on nor changed (no production Auth settings).
 */
export const POST = withObservability(async (req: Request) => {
  const state = await getSessionTwoStep();
  if (!state?.passed) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const { user } = state;
  if (isDemoOrganizerEmail(user.email)) return NextResponse.json({ error: 'Not available on the demo.' }, { status: 403 });
  if (!user.email) return NextResponse.json({ error: 'This account signs in without a password.' }, { status: 409 });

  const body = await req.json().catch(() => ({})) as { current?: unknown; next?: unknown };
  const current = typeof body.current === 'string' ? body.current : '';
  const next = typeof body.next === 'string' ? body.next : '';
  if (!current) return NextResponse.json({ error: 'Type your current password.', code: 'wrong_password' }, { status: 400 });
  if (next.length < MIN_LENGTH) {
    return NextResponse.json({ error: `Use at least ${MIN_LENGTH} characters.`, code: 'weak_password' }, { status: 400 });
  }
  // The sign-in service refuses a password over 72 bytes; say so plainly rather than "couldn't save".
  if (new TextEncoder().encode(next).length > 72) {
    return NextResponse.json({ error: 'Use a shorter password (72 characters at most).', code: 'long_password' }, { status: 400 });
  }
  if (next === current) {
    return NextResponse.json({ error: 'Choose a password you haven’t been using.', code: 'same_password' }, { status: 400 });
  }

  // The current password, on a client with no cookies and no stored session.
  const checker = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: signedIn, error: pwErr } = await checker.auth.signInWithPassword({ email: user.email, password: current });
  if (signedIn?.session) {
    // The check's own session goes at once (scope local: only that one).
    try { await checker.auth.signOut({ scope: 'local' }); } catch { /* it expires on its own within the hour */ }
  }
  if (pwErr || signedIn?.user?.id !== user.id) {
    if (pwErr?.code === 'over_request_rate_limit' || pwErr?.status === 429) {
      return NextResponse.json({ error: 'Too many tries. Wait a few minutes, then try again.', code: 'too_many_tries' }, { status: 429 });
    }
    return NextResponse.json({ error: 'That isn’t your current password.', code: 'wrong_password' }, { status: 400 });
  }

  // After the password (so nobody types a code only to be told the password was wrong), before the write.
  if (!hasFreshCode(state)) return freshCodeRefusal();

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: next });
  if (error) {
    const weak = error.code === 'weak_password';
    return NextResponse.json({
      error: weak ? 'That password is too easy to guess. Try a longer one.' : 'We couldn’t save your password. Try again.',
      code: weak ? 'weak_password' : 'not_saved',
    }, { status: weak ? 400 : 502 });
  }
  let othersSignedOut = true;
  try {
    const { error: outErr } = await (await createClient()).auth.signOut({ scope: 'others' });
    if (outErr) othersSignedOut = false;
  } catch { othersSignedOut = false; }
  return NextResponse.json({ ok: true, othersSignedOut });
}, { route: '/api/auth/password' });
