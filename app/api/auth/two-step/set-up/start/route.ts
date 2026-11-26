import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { getSessionTwoStep } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { REPLACING_AUTHENTICATOR_FLAG, isReplacingAuthenticator } from '@/lib/two-step-session';
import { freshCodeRefusal, hasFreshCode } from '@/lib/two-step-fresh';

/**
 * Start setting up two-step (drawings tab 2, "Scan"). Returns the QR code, the key and the authenticator link.
 *
 *   - Clears the person's own half-finished set-ups first: the service counts them toward its 10-per-person limit and
 *     sweeps only those older than about 5 minutes; each attempt is also named uniquely (Part 1 Step 0).
 *   - A person who already has it on may start again only to set up a NEW PHONE, and only with a proof (the app's code
 *     or a backup code) from the last 15 minutes (Part 2; tab 5 "asks for a code first"). Two ways, by the session:
 *       · ADD, then remove (the session typed the app's code, `aal2`: the person still holds the old phone). The new
 *         authenticator is set up BESIDE the old one; the old one is removed only once the new one is verified
 *         (set-up/verify). No gap: two-step is on with a working app at every moment.
 *       · MARK, then remove (a backup code let the session in, `aal1`: the phone is lost; the service will not add a
 *         second authenticator to that session). Part 1's order, exactly: the account's `two_step_replacing` mark is
 *         set FIRST, the old authenticator is deleted AFTER it, and the mark is cleared only at verify. A stolen password
 *         still opens nothing in between: the person signs in with a backup code. `tests/unit/two-step-set-up-order.test.ts`
 *         holds the order (and kills a swap).
 */
export const POST = withObservability(async (req: Request) => {
  const state = await getSessionTwoStep();
  if (!state?.passed) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const { user } = state;

  const body = await req.json().catch(() => ({})) as { replace?: boolean };
  const { data: listed, error: listErr } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: user.id });
  if (listErr) return NextResponse.json({ error: 'We couldn’t start the set-up. Try again.' }, { status: 502 });
  const factors = listed?.factors ?? [];
  const hasVerified = factors.some(f => f.status === 'verified');

  if (hasVerified && body.replace !== true) {
    return NextResponse.json({ error: 'Two-step sign-in is already on.', code: 'already_on' }, { status: 409 });
  }
  // A new phone, or finishing a replacement started earlier (the old authenticator already gone): a proof from the last
  // 15 minutes first. The window asks for it, then sends this again.
  if ((hasVerified || isReplacingAuthenticator(user)) && !hasFreshCode(state)) return freshCodeRefusal();

  const adding = hasVerified && state.aal === 'aal2';
  const marking = hasVerified && !adding;
  // Lost phone: mark the account FIRST, so two-step stays on while the old authenticator is gone and the new one is not
  // finished. Cleared at verify.
  if (marking) {
    const { error: markErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...(user.app_metadata ?? {}), [REPLACING_AUTHENTICATOR_FLAG]: true },
    });
    if (markErr) return NextResponse.json({ error: 'We couldn’t start the set-up. Try again.' }, { status: 502 });
  }
  // Half-finished set-ups go every time; the lost phone's authenticator goes when marking (never when adding).
  for (const f of factors) {
    if (f.status !== 'verified' || marking) {
      const { error: delErr } = await supabaseAdmin.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
      // The old authenticator still there means the new one cannot be added: stop, and take the mark off again (the
      // account is plainly "on" with its old phone, /review of Part 2).
      if (delErr && marking && f.status === 'verified') {
        await supabaseAdmin.auth.admin.updateUserById(user.id, { app_metadata: { [REPLACING_AUTHENTICATOR_FLAG]: false } });
        return NextResponse.json({ error: 'We couldn’t start the set-up. Try again.' }, { status: 502 });
      }
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
    /** The old app keeps working until this one is verified; verify removes it then. */
    adding,
  });
}, { route: '/api/auth/two-step/set-up/start' });
