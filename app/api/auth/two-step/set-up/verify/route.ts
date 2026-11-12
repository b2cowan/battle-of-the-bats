import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { getSessionTwoStep } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase-server';
import { isDemoOrganizerEmail } from '@/lib/demo-org';
import { createBackupCodes, normalizeAuthenticatorCode, recordCodeUse } from '@/lib/two-step-codes';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { REPLACING_AUTHENTICATOR_FLAG, isReplacingAuthenticator } from '@/lib/two-step-session';
import { freshCodeRefusal, hasFreshCode } from '@/lib/two-step-fresh';
import { sendTwoStepEmail, twoStepTurnedOnEmail } from '@/lib/two-step-emails';

/**
 * Finish setting up two-step (tab 2): the first code from the app turns it on, and the ten backup codes are made and
 * returned ONCE. The session becomes "password and code" (its cookies are rewritten here); the sign-in service signs
 * every OTHER session out at this moment, which is what "Your other devices were signed out" says. A new phone set up
 * beside the old one (`replace`) removes the old one here, after the new one is verified (Part 2).
 */
export const POST = withObservability(async (req: Request) => {
  const state = await getSessionTwoStep();
  if (!state?.passed) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (isDemoOrganizerEmail(state.user.email)) {
    return NextResponse.json({ error: 'The demo account can’t use two-step sign-in.', code: 'demo_account' }, { status: 403 });
  }
  // Like set-up/start (/review of Part 2): an account that already has two-step (or is replacing a lost phone) finishes
  // a set-up only with a proof from the last 15 minutes. Otherwise a stale session that set up an authenticator directly
  // with the sign-in service could finish here and remove the real one, or swap the backup codes. A first set-up (two-step
  // off) is never asked: hasFreshCode is true with no authenticator.
  if (!hasFreshCode(state)) return freshCodeRefusal();
  const body = await req.json().catch(() => ({})) as { factorId?: string; code?: string; replace?: boolean };
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
  const wasReplacing = isReplacingAuthenticator(state.user);
  // A new phone set up BESIDE the old one (set-up/start "adding"): now that it works, the old one goes. A failure there
  // leaves both working (never neither). While a lost phone was being replaced, the sign-in service would let anyone
  // holding the password add an authenticator of their own: every other one goes then too, so only the one just verified
  // here remains — and BEFORE the mark is cleared, since clearing it is what lets a code count again (/review of Part 2).
  let oldRemoved = true;
  if (body.replace === true || wasReplacing) {
    const { data: listed, error: listErr } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: state.user.id });
    if (listErr) oldRemoved = false;
    for (const f of listed?.factors ?? []) {
      if (f.id === body.factorId || f.status !== 'verified') continue;
      const { error } = await supabaseAdmin.auth.admin.mfa.deleteFactor({ userId: state.user.id, id: f.id });
      if (error) oldRemoved = false;
    }
  }
  if (wasReplacing) {
    // An authenticator that could not be removed keeps the mark on (only backup codes count) until a retry removes it.
    if (!oldRemoved) {
      return NextResponse.json({ error: 'We couldn’t finish setting up your new phone. Try again.', code: 'not_finished' }, { status: 502 });
    }
    // The replaced phone is finished: the mark goes (the new authenticator now keeps two-step on).
    await supabaseAdmin.auth.admin.updateUserById(state.user.id, {
      app_metadata: { ...(state.user.app_metadata ?? {}), [REPLACING_AUTHENTICATOR_FLAG]: false },
    });
  }
  // The session verified above still carries the replacement mark in its token. The database check (mig 468) ignores a
  // typed code while that mark is in the token, so take a fresh token now that the mark is gone. Best effort: a failure
  // here only means the browser's direct reach waits for its next ordinary refresh.
  if (wasReplacing) await supabase.auth.refreshSession().catch(() => undefined);
  const backupCodes = await createBackupCodes(state.user.id);
  // Part 4 (Part 1 call 2; owner ruling 2026-11-12): the account is told. Someone holding only the password could turn
  // two-step on and lock the real person out; this is their warning. A new phone (beside the old one, or replacing a lost
  // one) says so instead. Best effort.
  if (state.user.email) {
    const newPhone = state.hasFactor || wasReplacing || body.replace === true;
    await sendTwoStepEmail(state.user.email, twoStepTurnedOnEmail({ atIso: new Date().toISOString(), newPhone, oldRemoved }), 'two_step_turned_on', {
      orgId: null, askedBy: state.user.id, timeoutMs: 5_000,
    });
  }
  return NextResponse.json({ ok: true, backupCodes, oldRemoved });
}, { route: '/api/auth/two-step/set-up/verify' });
