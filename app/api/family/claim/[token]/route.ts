import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { withObservability } from '@/lib/observability';
import {
  checkNoLoginRateLimit,
  isPlausibleNoLoginToken,
  tooManyRequests,
} from '@/lib/no-login-token';
import { throttleInvitationAttempt } from '@/lib/public-form-throttle';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import { acceptInvitation, acceptWithNewAccount, FAMILY_HOME_PATH, type AcceptResult } from '@/lib/family-invitation';
import { clientIpFrom } from '@/lib/rate-limit';
import { accountDoorRefusal, checkAcceptance, recordDoorAcceptance } from '@/lib/legal-acceptance';

/**
 * Accept an invitation to join a child's team (Signed-in family accounts Stage 4a, Part 4; the rules are lib/family-invitation.ts).
 *
 *   { mode: 'new', email, password, guardianBox, consentBox }  — a NEW account made from the invitation (ruling 15: created
 *                       already confirmed, the typed email must match), accepted in the same request. The page signs in after.
 *   { guardianBox, consentBox }                               — the signed-in account (state A, or just signed in with its
 *                       password on the page). Its email must equal the invited address (ruling 5: otherwise refused).
 *
 * ⚠ The token only opens this; it never signs anyone in (the session is the account's own, made by the page's own sign-in)
 * and never shows a team. POST only — a link scanner following the URL from an email must not be able to accept anything.
 * Answers: 200 { ok, next } · 400 consent_required | password_short · 401 sign_in_required · 409 another_email (signed in as
 * someone else) | email_mismatch (typed) | account_exists · 404 one of D / E / F's states, never why.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ token: string }> },) => {
  const { token } = await params;

  const verdict = await checkNoLoginRateLimit('family_join_request', req);
  if (!verdict.allowed) return tooManyRequests(verdict);

  if (!GUARDIAN_TIER_ENABLED) {
    return NextResponse.json({ error: 'guardian_tier_unavailable' }, { status: 404 });
  }
  if (!isPlausibleNoLoginToken(token)) {
    return NextResponse.json({ error: 'no_longer_works' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const boxes = { guardianBox: body?.guardianBox === true, consentBox: body?.consentBox === true };
  const consentIp = clientIpFrom(req);

  if (body?.mode === 'new') {
    const email = typeof body?.email === 'string' ? body.email : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const limited = throttleInvitationAttempt(token);
    if (limited) return limited;
    // The third box (GST/HST Stage 6 step 6.3, §20 (5h)): a new account always ticks it — refused BEFORE the account is made.
    const termsRefusal = accountDoorRefusal(body);
    if (termsRefusal) return termsRefusal;
    const outcome = await acceptWithNewAccount({ token, typedEmail: email, password, consentIp, ...boxes });
    if (outcome.kind === 'joined' && outcome.userId) {
      await recordDoorAcceptance({ id: outcome.userId, email }, 'family_accept', body);
    }
    if (outcome.kind === 'account_exists') return NextResponse.json({ error: 'account_exists' }, { status: 409 });
    if (outcome.kind === 'password_short') return NextResponse.json({ error: 'password_short' }, { status: 400 });
    if (outcome.kind === 'mismatch') return NextResponse.json({ error: 'email_mismatch', maskedEmail: outcome.maskedEmail }, { status: 409 });
    return answer(outcome);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  // The third box for an account that has not agreed yet (5h). An account that has, sends none and is never asked; one signed
  // in on this page with its password learns it here, and the page then shows the box. Off while the legal pages are off.
  if ((await checkAcceptance(user)).state === 'needed') {
    const termsRefusal = accountDoorRefusal(body);
    if (termsRefusal) return termsRefusal;
    await recordDoorAcceptance(user, 'family_accept', body);
  }
  const outcome = await acceptInvitation({ token, userId: user.id, userEmail: user.email, consentIp, ...boxes });
  if (outcome.kind === 'mismatch') {
    return NextResponse.json({ error: 'another_email', maskedEmail: outcome.maskedEmail }, { status: 409 });
  }
  return answer(outcome);
}, { route: '/api/family/claim/[token]' });

function answer(outcome: Exclude<AcceptResult, { kind: 'mismatch' }>) {
  if (outcome.kind === 'consent_required') return NextResponse.json({ error: 'consent_required' }, { status: 400 });
  // One shape per drawn state; a dead invitation says only which of D / E / F it is, never why.
  if (outcome.kind === 'state') return NextResponse.json({ error: outcome.state }, { status: 404 });
  return NextResponse.json({ ok: true, next: `${FAMILY_HOME_PATH}?joined=1` });
}
