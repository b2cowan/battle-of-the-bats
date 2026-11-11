import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { getSessionTwoStep } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase-server';
import { isDemoOrganizerEmail } from '@/lib/demo-org';
import { createBackupCodes, normalizeAuthenticatorCode, recordCodeUse } from '@/lib/two-step-codes';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { REPLACING_AUTHENTICATOR_FLAG, isReplacingAuthenticator } from '@/lib/two-step-session';

/**
 * Finish setting up two-step (tab 2): the first code from the app turns it on, and the ten backup codes are made and
 * returned ONCE. The session becomes "password and code" (its cookies are rewritten here); the sign-in service signs
 * every OTHER session out at this moment, which is what "Your other devices were signed out" says.
 */
export const POST = withObservability(async (req: Request) => {
  const state = await getSessionTwoStep();
  if (!state?.passed) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (isDemoOrganizerEmail(state.user.email)) {
    return NextResponse.json({ error: 'The demo account can’t use two-step sign-in.', code: 'demo_account' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({})) as { factorId?: string; code?: string };
  const code = normalizeAuthenticatorCode(body.code ?? '');
  if (!body.factorId || !code) {
    return NextResponse.json({ error: 'Type the 6 digits the app shows.', code: 'wrong_code' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: body.factorId });
  if (chErr || !challenge) {
    return NextResponse.json({ error: 'That set-up has expired. Start again.', code: 'expired' }, { status: 409 });
  }
  const { error: vErr } = await supabase.auth.mfa.verify({ factorId: body.factorId, challengeId: challenge.id, code });
  if (vErr) {
    return NextResponse.json({
      error: 'That code didn’t work. The codes change every 30 seconds. Type the one showing now.',
      code: 'wrong_code',
    }, { status: 400 });
  }
  await recordCodeUse(state.user.id, code);
  // A replaced phone is finished: the account's "replacing" mark goes (the new authenticator now keeps two-step on).
  if (isReplacingAuthenticator(state.user)) {
    await supabaseAdmin.auth.admin.updateUserById(state.user.id, {
      app_metadata: { ...(state.user.app_metadata ?? {}), [REPLACING_AUTHENTICATOR_FLAG]: false },
    });
  }
  const backupCodes = await createBackupCodes(state.user.id);
  return NextResponse.json({ ok: true, backupCodes });
}, { route: '/api/auth/two-step/set-up/verify' });
