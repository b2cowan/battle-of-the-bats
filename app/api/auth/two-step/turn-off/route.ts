import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { getSessionTwoStep } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isDemoOrganizerEmail } from '@/lib/demo-org';
import { twoStepRequirementsFor } from '@/lib/two-step-requirements';
import { REPLACING_AUTHENTICATOR_FLAG } from '@/lib/two-step-session';
import { freshCodeRefusal, hasFreshCode } from '@/lib/two-step-fresh';

/**
 * TURN OFF your own two-step sign-in (Board Ready · two-step sign-in, Part 2; drawings tab 5 "On · not required"). The
 * move a thief makes, so:
 *
 *   - a session that has not passed the code cannot reach it (the guard test proves a password-only session is refused);
 *   - refused while ANY seat is covered (platform staff always; a club seat in its 14 days or past them, ruled
 *     2026-11-11): turning it off there would only drop the person back into a countdown;
 *   - asks for a proof from the last 15 minutes (the one window answers it);
 *   - the order leaves two-step ON if anything fails part-way: the account is MARKED first (the `two_step_replacing` mark
 *     keeps two-step on with no authenticator, signed in by a backup code), every authenticator is removed, the removal is
 *     confirmed, and only THEN the mark is cleared. The backup codes go last, once the account already reads as off: a
 *     failure there leaves two-step off with unused codes nobody is asked for (the next set-up replaces them).
 *     `tests/unit/two-step-set-up-order.test.ts` holds the order.
 */
export const POST = withObservability(async () => {
  const state = await getSessionTwoStep();
  if (!state?.passed) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const { user } = state;
  if (isDemoOrganizerEmail(user.email)) return NextResponse.json({ error: 'Not available on the demo.' }, { status: 403 });
  if (!state.hasFactor) return NextResponse.json({ error: 'Two-step sign-in is already off.', code: 'already_off' }, { status: 409 });

  const requirements = await twoStepRequirementsFor(user);
  if (requirements.reasons.length > 0) {
    return NextResponse.json({ error: 'Two-step sign-in is required for your role, so it can’t be turned off.', code: 'required' }, { status: 403 });
  }
  if (!hasFreshCode(state)) return freshCodeRefusal();

  const refusal = () => NextResponse.json({ error: 'We couldn’t turn it off. Two-step sign-in is still on. Try again.', code: 'not_turned_off' }, { status: 502 });
  // A failure after the mark: while a working authenticator remains, the mark is taken off again (best effort), so the
  // account is plainly "on" rather than "replacing". With none left, the mark STAYS: it is what keeps two-step on, and the
  // person signs in with a backup code (/review of Part 2).
  const failed = async () => {
    try {
      const { data } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: user.id });
      if ((data?.factors ?? []).some(f => f.status === 'verified')) {
        await supabaseAdmin.auth.admin.updateUserById(user.id, { app_metadata: { [REPLACING_AUTHENTICATOR_FLAG]: false } });
      }
    } catch { /* the mark keeps two-step on either way */ }
    return refusal();
  };

  // 1. Mark first: from here, two-step reads ON whatever is removed below.
  const { error: markErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: { [REPLACING_AUTHENTICATOR_FLAG]: true }, // merged into the account's other keys by the service
  });
  if (markErr) return refusal();

  // 2. Every authenticator goes (verified and half-finished).
  const { data: listed, error: listErr } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: user.id });
  if (listErr) return failed();
  for (const f of listed?.factors ?? []) {
    const { error } = await supabaseAdmin.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
    if (error) return failed();
  }

  // 3. Confirmed gone, then the mark is cleared: two-step is now off.
  const { data: after, error: afterErr } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: user.id });
  if (afterErr || (after?.factors ?? []).length > 0) return failed();
  const { error: clearErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: { [REPLACING_AUTHENTICATOR_FLAG]: false },
  });
  if (clearErr) return failed();

  // 4. The backup codes, last.
  await supabaseAdmin.from('two_step_backup_codes').delete().eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}, { route: '/api/auth/two-step/turn-off' });
