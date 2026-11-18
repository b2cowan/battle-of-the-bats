import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { createClient } from '@/lib/supabase-server';
import { isDemoOrganizerEmail } from '@/lib/demo-org';
import { passwordChangedEmail, sendTwoStepEmail } from '@/lib/two-step-emails';

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
 * The page calls this once the new password is saved. It tells ONLY the signed-in person's own address, and only when
 * the service says their password changed in the last few minutes, so it cannot be used to mail anyone or to mail the
 * person a "changed" notice for a change that did not happen. Best effort: the page never waits on or shows the result.
 *
 * Signs the other devices out first, as the other two password routes do, so the email's claim about them is true.
 * This device keeps its session (a signed-out-others call spares the current one).
 */
export const POST = withObservability(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (isDemoOrganizerEmail(user.email)) return NextResponse.json({ ok: true, sent: false });

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
