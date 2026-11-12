import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { getSessionTwoStep } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/lib/supabase-server';
import { provedWithin } from '@/lib/two-step-session';
import { TWO_STEP_FRESH_MINUTES } from '@/lib/two-step-rule';
import { passwordChangedEmail, sendTwoStepEmail } from '@/lib/two-step-emails';

/**
 * Save a new password for a reset that a BACKUP CODE let through (Board Ready · two-step sign-in, Part 1). The forgot-
 * password link signs the person in with the password's level; with two-step on, the sign-in service refuses a new
 * password until the code is typed, and it cannot count our backup codes. So the person who lost their phone AND forgot
 * their password (the reset link from their inbox, then a backup code) has their new password saved here.
 *
 * Only for that case: the session must have been let through by a backup code in the last 15 minutes. A session that
 * typed the app's code uses the sign-in service directly, as before.
 */
export const POST = withObservability(async (req: Request) => {
  const state = await getSessionTwoStep();
  if (!state?.passed || !state.viaBackupCode || !provedWithin(state, TWO_STEP_FRESH_MINUTES)) {
    return NextResponse.json({ error: 'Sign in again.', code: 'session_expired' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as { password?: string };
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8) return NextResponse.json({ error: 'Use at least 8 characters.', code: 'weak_password' }, { status: 400 });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(state.user.id, { password });
  if (error) {
    return NextResponse.json({ error: 'We couldn’t save your password.', code: error.code ?? 'unknown' }, { status: 400 });
  }
  // A new password signs the account out everywhere else, as the sign-in service's own password change does (/review).
  let othersSignedOut = true;
  try {
    const { error: outErr } = await (await createClient()).auth.signOut({ scope: 'others' });
    if (outErr) othersSignedOut = false;
  } catch { othersSignedOut = false; /* the password is saved either way */ }
  // Part 4 (owner ruling 2026-11-12): the account is told. Best effort.
  if (state.user.email) {
    await sendTwoStepEmail(state.user.email, passwordChangedEmail({ atIso: new Date().toISOString(), othersSignedOut }), 'password_changed', {
      orgId: null, askedBy: state.user.id, timeoutMs: 5_000,
    });
  }
  return NextResponse.json({ ok: true });
}, { route: '/api/auth/two-step/reset-password' });
