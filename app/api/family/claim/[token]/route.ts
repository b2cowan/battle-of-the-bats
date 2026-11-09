import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { withObservability } from '@/lib/observability';
import {
  checkNoLoginRateLimit,
  isPlausibleNoLoginToken,
  tooManyRequests,
} from '@/lib/no-login-token';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import { acceptInvitation } from '@/lib/family-invitation';
import { clientIpFrom } from '@/lib/rate-limit';

/**
 * Accept an invitation to join a child's team (Signed-in family accounts Stage 4a; the rules are lib/family-invitation.ts).
 *
 * ⚠ Ruling 5: the signed-in account's email must equal the invited address — a different email is REFUSED (the coach's approval
 * queue for a mismatched claim is gone). Both boxes are required (/legal draft a). There is no age question (ruling 12).
 * ⚠ The token only opens this; it never signs anyone in (the session is the account's own) and never shows a team.
 * POST only — a link scanner following the URL from an email must not be able to accept anything on the recipient's behalf.
 * (Stage 4a Part 4 rebuilds the page and its sign-in-or-create step around this.)
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
    return NextResponse.json({ error: 'invalid' }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const outcome = await acceptInvitation({
    token,
    userId: user.id,
    userEmail: user.email,
    consentIp: clientIpFrom(req),
    guardianBox: body?.guardianBox === true,
    consentBox: body?.consentBox === true,
  });
  if (outcome.kind === 'consent_required') return NextResponse.json({ error: 'consent_required' }, { status: 400 });
  if (outcome.kind === 'mismatch') {
    return NextResponse.json({ error: 'another_email', maskedEmail: outcome.maskedEmail }, { status: 409 });
  }
  // One shape per drawn state; a dead invitation says only which of D / E / F it is, never why.
  if (outcome.kind === 'state') return NextResponse.json({ error: outcome.state }, { status: 404 });
  return NextResponse.json({ ok: true });
}, { route: '/api/family/claim/[token]' });
