import { supabaseAdmin } from './supabase-admin';
import { REPLACING_AUTHENTICATOR_FLAG } from './two-step-session';

/**
 * TAKING SOMEONE'S TWO-STEP OFF — the one order (Board Ready · two-step sign-in, Parts 2 and 3). Three doors use it:
 * turning your own off (Part 2), the club resetting a member (Part 3, drawings tab 6) and support resetting an owner after
 * the 24-hour wait (Part 3, tab 7). The order is a security decision, so it lives here once:
 *
 *   1. the account is MARKED first (`two_step_replacing`): from here two-step reads ON whatever is removed below, and the
 *      person signs in with a backup code;
 *   2. every authenticator goes (verified and half-finished);
 *   3. the removal is CONFIRMED (listed again, none left), and only THEN the mark is cleared: two-step is now off;
 *   4. the backup codes go last, once the account already reads as off: a failure there leaves two-step off with unused
 *      codes nobody is asked for (the next set-up replaces them).
 *
 * A failure part-way leaves two-step ON (`tests/unit/two-step-part2.test.ts` §3 holds the order, with mutants).
 */
export async function removeEveryAuthenticator(userId: string): Promise<boolean> {
  // The person's OWN authenticators, before anything changes (/review of Part 3): while the mark is set and none is left,
  // the sign-in service lets any session set up a first one, so a failure must never take the mark off for a stranger's.
  const { data: before, error: beforeErr } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId });
  if (beforeErr) return false;
  const ownIds = new Set((before?.factors ?? []).filter(f => f.status === 'verified').map(f => f.id));

  // A failure after the mark: while one of the person's own authenticators still works, the mark is taken off again (best
  // effort), so the account is plainly "on" rather than "replacing". Otherwise the mark STAYS: it is what keeps two-step
  // on, and the person signs in with a backup code (/review of Part 2). A verified authenticator that was not theirs
  // before this began is removed (best effort).
  const failed = async () => {
    try {
      const { data } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId });
      const verified = (data?.factors ?? []).filter(f => f.status === 'verified');
      if (verified.some(f => ownIds.has(f.id))) {
        await supabaseAdmin.auth.admin.updateUserById(userId, { app_metadata: { [REPLACING_AUTHENTICATOR_FLAG]: false } });
      } else {
        for (const f of verified) await supabaseAdmin.auth.admin.mfa.deleteFactor({ userId, id: f.id });
      }
    } catch { /* the mark keeps two-step on either way */ }
    return false;
  };

  // 1. Mark first: from here, two-step reads ON whatever is removed below.
  const { error: markErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { [REPLACING_AUTHENTICATOR_FLAG]: true }, // merged into the account's other keys by the service
  });
  if (markErr) return false;

  // 2. Every authenticator goes (verified and half-finished).
  const { data: listed, error: listErr } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId });
  if (listErr) return failed();
  for (const f of listed?.factors ?? []) {
    const { error } = await supabaseAdmin.auth.admin.mfa.deleteFactor({ userId, id: f.id });
    if (error) return failed();
  }

  // 3. Confirmed gone, then the mark is cleared: two-step is now off.
  const { data: after, error: afterErr } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId });
  if (afterErr || (after?.factors ?? []).length > 0) return failed();
  const { error: clearErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { [REPLACING_AUTHENTICATOR_FLAG]: false },
  });
  if (clearErr) return failed();

  // 4. The backup codes, last.
  await supabaseAdmin.from('two_step_backup_codes').delete().eq('user_id', userId);
  return true;
}

/**
 * Sign a person out on every device (the support console's own "Sign out everywhere" door too). True when every session
 * is gone — including when none was open.
 *
 * ⚠ Through `sign_out_everywhere` (mig 474), NOT the sign-in service's admin `DELETE /users/{id}/sessions`: that route
 * does not exist in the service (it answers "404 page not found" for a real account), so for a long time this returned
 * false for everyone and no reset ever ran (found walking Part 3 step 4, 2026-11-12).
 */
export async function signOutEverywhere(userId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return false;
  try {
    const { error } = await supabaseAdmin.rpc('sign_out_everywhere', { p_user_id: userId });
    if (error) {
      console.error('[two-step-reset] sign_out_everywhere failed:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export type ResetOutcome = 'done' | 'not_signed_out' | 'not_removed';

/**
 * RESET SOMEONE ELSE'S TWO-STEP (the club's door and support's timed reset). Signed out FIRST, so a failure before any
 * change leaves everything as it was ('not_signed_out'); then the one order above ('not_removed' leaves two-step on);
 * then signed out again, for a session that began in between (best effort: the first one already ended every session
 * that existed when the reset was asked for).
 */
export async function resetTwoStep(userId: string): Promise<ResetOutcome> {
  if (!(await signOutEverywhere(userId))) return 'not_signed_out';
  if (!(await removeEveryAuthenticator(userId))) return 'not_removed';
  await signOutEverywhere(userId);
  return 'done';
}

export type TwoStepFacts = {
  /** Two-step is on: a verified authenticator, or a lost phone being replaced (the mark). */
  on: boolean;
  /** When the earliest working authenticator was set up (ISO), null when off or only the mark holds it on. */
  since: string | null;
};

/** Is this person's two-step on, and since when? Read with the service role (never the person's own session). */
export async function twoStepFactsFor(userId: string): Promise<TwoStepFacts> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) return { on: false, since: null };
  const user = data.user;
  const verified = (user.factors ?? []).filter(f => f.status === 'verified');
  const replacing = (user.app_metadata as Record<string, unknown> | undefined)?.[REPLACING_AUTHENTICATOR_FLAG] === true;
  const since = verified.map(f => f.created_at).filter(Boolean).sort()[0] ?? null;
  return { on: verified.length > 0 || replacing, since };
}
