import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isPlausibleNoLoginToken } from '@/lib/no-login-token';
import { throttlePublicForm, throttlePublicFormRecipient } from '@/lib/public-form-throttle';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import { invitationToResend } from '@/lib/family-invitation';
import { resendRepInvitation } from '@/lib/family-invitation-mail';
import { resendPlacementInvitation } from '@/lib/house-league-placement-mail';

/**
 * D's "Email me a new invitation" (Signed-in family accounts Stage 4a, Part 4.4; ruling 9; drawing tab 2 state D). For an
 * expired or replaced invitation only: a fresh one to the address it was for — the placement email again (house league) or the
 * coach's invitation again (rep). Never to any other address; nothing is typed here.
 *
 * ⚠ ONE ANSWER, whatever happened: { ok: true } whether an email went, the address could not get one any more (withdrawn, left,
 * removed, stopped, at two guardians), the token is unknown, or the per-address limit was reached. As "Email me my link" since
 * Stage 1 — the page never tells a stranger anything about the address or the child.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ token: string }> },) => {
  const { token } = await params;
  if (!GUARDIAN_TIER_ENABLED) return NextResponse.json({ error: 'guardian_tier_unavailable' }, { status: 404 });

  const limited = throttlePublicForm(req);
  if (limited) return limited;
  if (!isPlausibleNoLoginToken(token)) return NextResponse.json({ ok: true });

  const inv = await invitationToResend(token);
  // The per-address bucket is silent: a reached limit sends nothing and answers the same.
  if (inv && !throttlePublicFormRecipient(inv.email)) {
    try {
      if (inv.source === 'placement') {
        await resendPlacementInvitation({ orgId: inv.orgId, email: inv.email, sentByUserId: null, reconnects: inv.reconnects });
      } else {
        await resendRepInvitation({ orgId: inv.orgId, email: inv.email, repPlayerId: inv.repPlayerId, sentByUserId: inv.sentByUserId });
      }
    } catch (e) {
      console.error('[family/claim/resend] a re-send failed (the page is answered the same):', e instanceof Error ? e.message : String(e));
    }
  }
  return NextResponse.json({ ok: true });
}, { route: '/api/family/claim/[token]/resend' });
