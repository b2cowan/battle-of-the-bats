import { NextResponse } from 'next/server';
import { createClient as createPlainClient } from '@supabase/supabase-js';
import { withObservability } from '@/lib/observability';
import { getSessionTwoStep } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/lib/supabase-server';
import { isDemoOrganizerEmail } from '@/lib/demo-org';
import { freshCodeRefusal, hasFreshCode } from '@/lib/two-step-fresh';
import { passwordChangedEmail, sendTwoStepEmail } from '@/lib/two-step-emails';

const MIN_LENGTH = 8;

/**
 * CHANGE PASSWORD from Account › Sign-in & security (Board Ready · two-step sign-in, Part 2; ask 7: no signed-in person
 * could change it before). Asks for the current password, and a code from the last 15 minutes if two-step is on.
 *
 * ⚠ The trap (Part 1): the current password is checked on a client that keeps NO cookies, never the session's own client.
 * A password sign-in on the cookie client REPLACES the person's session with a password-only one, so a person with
 * two-step on would land on the code step mid-change. The session that check creates is signed out at once. The new
 * password is saved through the admin door (a two-step account's own password change needs the code level, and the
 * service cannot count our backup codes). That save ends every session, this one too, so this device signs back in with
 * the new password and the others are then signed out. The service's "secure password change" setting is neither
 * relied on nor changed (no production Auth settings).
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
  // ⚠ Saving a password through the admin door ends EVERY session of the person, this device's included (proven on dev
  // 2026-11-11: the old session reads "Auth session missing" at once). So this device is signed back in with the new
  // password, on the cookie client, and only then are the others sent away. A two-step person's new session is
  // password-only, so they are asked for their code once more; that is the safe side (`needsCode`).
  const supabase = await createClient();
  let signedBackIn = false;
  try {
    const { data: back, error: backErr } = await supabase.auth.signInWithPassword({ email: user.email, password: next });
    signedBackIn = !backErr && !!back?.session;
  } catch { signedBackIn = false; }
  let othersSignedOut = true;
  if (signedBackIn) {
    try {
      const { error: outErr } = await supabase.auth.signOut({ scope: 'others' });
      if (outErr) othersSignedOut = false;
    } catch { othersSignedOut = false; }
  }
  // Part 4 (owner ruling 2026-11-12): the account is told, so a change it didn't make is seen. AFTER this device is signed
  // back in and the others are sent away (/review: a slow mail service must never hold those up), with a short limit.
  await sendTwoStepEmail(user.email, passwordChangedEmail({ atIso: new Date().toISOString(), othersSignedOut: signedBackIn && othersSignedOut }), 'password_changed', {
    orgId: null, askedBy: user.id, timeoutMs: 5_000,
  });
  return NextResponse.json({ ok: true, othersSignedOut, signedBackIn, needsCode: signedBackIn && state.hasFactor });
}, { route: '/api/auth/password' });
