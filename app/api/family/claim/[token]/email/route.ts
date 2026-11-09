import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isPlausibleNoLoginToken } from '@/lib/no-login-token';
import { throttleInvitationAttempt, throttlePublicForm } from '@/lib/public-form-throttle';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import { invitationEmailCheck } from '@/lib/family-invitation';

/**
 * The accept page's email-first step (Signed-in family accounts Stage 4a, Part 4; drawing tab 2): "Type the email this
 * invitation was sent to". No address rides in the link (Stage 2 ruling 2), so the page asks, and the server compares — the page
 * never receives the full address. Answers { match: false }, or { match: true, hasAccount } so the page shows "Choose a password"
 * or "Your password". Throttled per IP (the family form buckets) and per invitation.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ token: string }> },) => {
  const { token } = await params;
  if (!GUARDIAN_TIER_ENABLED) return NextResponse.json({ error: 'guardian_tier_unavailable' }, { status: 404 });

  const limited = throttlePublicForm(req);
  if (limited) return limited;
  const body = await req.json().catch(() => ({}));
  const typed = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!typed || !isPlausibleNoLoginToken(token)) return NextResponse.json({ match: false });
  // Per invitation, not per typed address: a guess spends this link's budget, never a parent's mail budget.
  const perInvitation = throttleInvitationAttempt(token);
  if (perInvitation) return perInvitation;

  return NextResponse.json(await invitationEmailCheck(token, typed));
}, { route: '/api/family/claim/[token]/email' });
