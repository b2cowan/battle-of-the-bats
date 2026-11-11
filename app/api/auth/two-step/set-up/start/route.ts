import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { getSessionTwoStep } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isDemoOrganizerEmail } from '@/lib/demo-org';
import { REPLACING_AUTHENTICATOR_FLAG, isReplacingAuthenticator, provedWithin } from '@/lib/two-step-session';
import { TWO_STEP_FRESH_MINUTES } from '@/lib/two-step-rule';

/**
 * Start setting up two-step (drawings tab 2, "Scan"). Returns the QR code, the key and the authenticator link.
 *
 *   - Refused for the shared demo accounts: one visitor setting it up would sign out every visitor and lock the demo
 *     (tab 9). Each new demo visit also clears any authenticator off them (lib/demo-session.ts).
 *   - Clears the person's own half-finished set-ups first: the service counts them toward its 10-per-person limit and
 *     sweeps only those older than about 5 minutes; each attempt is also named uniquely (Part 1 Step 0).
 *   - A person who already has it on may start again only to REPLACE a lost phone, right after a backup code let them in
 *     (tab 3, "Set up my new phone"): the old authenticator is removed first. Part 2 adds "Set up a new phone" for a
 *     person who still has theirs.
 */
export const POST = withObservability(async (req: Request) => {
  const state = await getSessionTwoStep();
  if (!state?.passed) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const { user } = state;
  if (isDemoOrganizerEmail(user.email)) {
    return NextResponse.json({ error: 'The demo account can’t use two-step sign-in.', code: 'demo_account' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { replace?: boolean };
  const { data: listed, error: listErr } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: user.id });
  if (listErr) return NextResponse.json({ error: 'We couldn’t start the set-up. Try again.' }, { status: 502 });
  const factors = listed?.factors ?? [];
  const hasVerified = factors.some(f => f.status === 'verified');

  const replacing = hasVerified && body.replace === true;
  if (hasVerified && !(replacing && state.viaBackupCode && provedWithin(state, TWO_STEP_FRESH_MINUTES))) {
    // A replace whose backup code is over 15 minutes old asks for one again (the page sends the person to the code step).
    const code = body.replace === true ? 'needs_fresh_code' : 'already_on';
    return NextResponse.json({ error: 'Two-step sign-in is already on.', code }, { status: 409 });
  }
  // Finishing a replacement started earlier (the old authenticator already gone): only from a session a backup code let
  // in, like the start of it.
  if (!hasVerified && isReplacingAuthenticator(user) && !state.viaBackupCode) {
    return NextResponse.json({ error: 'Use a backup code first.', code: 'needs_fresh_code' }, { status: 409 });
  }
  // Replacing: mark the account FIRST, so two-step stays on while the old authenticator is gone and the new one is not
  // finished (a stolen password still opens nothing; the person signs in with a backup code). Cleared at verify.
  if (replacing) {
    const { error: markErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...(user.app_metadata ?? {}), [REPLACING_AUTHENTICATOR_FLAG]: true },
    });
    if (markErr) return NextResponse.json({ error: 'We couldn’t start the set-up. Try again.' }, { status: 502 });
  }
  // Half-finished set-ups go every time; the lost phone's authenticator goes when replacing it.
  for (const f of factors) {
    if (f.status !== 'verified' || replacing) {
      await supabaseAdmin.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
    }
  }

  const supabase = await createClient();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Authenticator ${stamp}`,
    issuer: 'FieldLogicHQ',
  });
  if (error || !data) {
    return NextResponse.json({ error: 'We couldn’t start the set-up. Try again.' }, { status: 502 });
  }
  return NextResponse.json({
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  });
}, { route: '/api/auth/two-step/set-up/start' });
