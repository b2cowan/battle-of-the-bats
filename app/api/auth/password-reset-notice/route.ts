import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { createClient } from '@/lib/supabase-server';
import { passwordChangedEmail, sendTwoStepEmail } from '@/lib/two-step-emails';
import { getSignedInUser } from '@/lib/two-step-session';

/** The password must have been saved this recently, by the service's own clock, for the notice to go out. */
const FRESH_MS = 5 * 60_000;
/** One notice per person per window (the mail service refuses a repeat with the same key). */
const ONCE_MS = 10 * 60_000;

/**
 * The "your password was changed" email for the ORDINARY reset (the forgot-password link). That reset page saves the
 * new password straight with the sign-in service from the browser, so — unlike Account › change password and the
 * backup-code reset — nothing of ours ran afterwards, and the only notice it could ever produce was the sign-in
 * service's own, which needs a custom sender we don't run (owner 2026-11-18: every account email goes out from our
 * sender, the service sends none).
 *
 * The page calls this once the new password is saved. It tells ONLY the signed-in person's own address, so it cannot
 * be used to mail anyone else. Best effort: the page never waits on or shows the result.
 *
 * ⚖ SIGNED IN MEANS BOTH STEPS (owner 2026-11-26): the person is read by `getSignedInUser`, so with two-step on, a
 * password alone gets nothing here. Before, it signed the owner's devices out and mailed them. An ordinary reset
 * keeps its email: the page asks for the code before it saves. (A backup-code reset is mailed by its own route.) One
 * rare edge goes without it: a lost-phone replacement whose mark failed to clear, where an app code counts for
 * nothing until it does (lib/two-step-session.ts).
 * ⚠ THE FRESHNESS WINDOW DOES NOT PROVE A PASSWORD CHANGE. `updated_at` also moves on an ordinary sign-in (seen on dev
 * 2026-11-26), so a person who is fully signed in can still call this without having changed anything.
 *
 * Signs the other devices out first, as the other two password routes do, so the email's claim about them is true.
 * This device keeps its session (a signed-out-others call spares the current one).
 */
export const POST = withObservability(async () => {
  const supabase = await createClient();
  const user = await getSignedInUser(supabase);
  if (!user?.email) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const changedAt = Date.parse(user.updated_at ?? '');
  if (!Number.isFinite(changedAt) || Date.now() - changedAt > FRESH_MS) {
    return NextResponse.json({ ok: true, sent: false });
  }

  let othersSignedOut = true;
  try {
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    if (error) othersSignedOut = false;
  } catch { othersSignedOut = false; /* the password is saved either way */ }

  const sent = await sendTwoStepEmail(user.email, passwordChangedEmail({ atIso: new Date().toISOString(), othersSignedOut }), 'password_changed', {
    orgId: null, askedBy: user.id, timeoutMs: 5_000,
    idempotencyKey: `password-reset-notice:${user.id}:${Math.floor(Date.now() / ONCE_MS)}`,
  });
  return NextResponse.json({ ok: true, sent });
}, { route: '/api/auth/password-reset-notice' });
