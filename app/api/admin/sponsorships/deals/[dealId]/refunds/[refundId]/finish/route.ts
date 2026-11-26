import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { actorOf } from '@/lib/club-sponsorship-deal-actions';
import { finishStripeSponsorRefund, type SponsorRefundFinishRefusal } from '@/lib/online-payment-landing';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';

/**
 * FINISH A REFUND MADE IN STRIPE (Board Ready Stage 6 fixes Part A; the drawing's tab 2, RULED 2026-11-25, asks 1–2). The books
 * already took it; finishing gives the reason the business reads, issues the credit note (dated today) and emails it. Body:
 * { reason, outcome? } — `outcome` ('ended' | 'owing') only when the refund gave back the last of the deal's money (the database
 * asks then, and refuses it otherwise). Who: whoever may refund on a deal (Sponsorships). Never reaches Stripe, so it does not
 * read the launch switch: a refund already made is finished whatever the switch says.
 * Answers 200 { endsDeal, owingAgain, emailedTo }; 400/409 with the words. The database decides finished / nothing to finish.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ dealId: string; refundId: string }> };
const C = DEAL_WORDS.card;
const notFound = () => NextResponse.json({ error: SPONSORSHIPS_WORDS.say.notFound, code: 'not_found' }, { status: 404 });
/** Each refusal the finish can give, in the club's words (not_found answers 404). */
const REFUSED: Record<Exclude<SponsorRefundFinishRefusal, 'not_found'>, [string, number]> = {
  reason: [C.finishErrReason, 400],
  outcome: [C.errOutcome, 400],
  outcome_changed: [C.errOutcomeChanged, 409],
  already: [C.errFinishedAlready, 409],
  nothing: [C.errNothingToFinish, 409],
};

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const { dealId, refundId } = await params;
  if (!isUuid(dealId) || !isUuid(refundId)) return notFound();
  // The refund is this club's, on this deal, and was made in Stripe (the address names both).
  const { data: row, error: rowError } = await supabaseAdmin.from('club_sponsor_deal_refunds').select('id')
    .eq('id', refundId).eq('deal_id', dealId).eq('org_id', org.id).eq('origin', 'stripe').maybeSingle();
  if (rowError) throw rowError; // a failed read is not "no such refund"
  if (!row) return notFound();

  const b = (await req.json().catch(() => null) ?? {}) as Record<string, unknown>;
  const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 300) : '';
  if (!reason) return refused(C.finishErrReason, 400, 'reason');
  const outcome = b.outcome === 'ended' || b.outcome === 'owing' ? b.outcome : null;
  const by = await actorOf(gate.ctx);
  let r: Awaited<ReturnType<typeof finishStripeSponsorRefund>>;
  try {
    r = await finishStripeSponsorRefund({ orgId: org.id, refundId, reason, outcome, actorId: by.userId, actorName: by.name });
  } catch (e) {
    console.error('[sponsorships] a refund made in Stripe could not be finished:', refundId, e instanceof Error ? e.message : String(e));
    return refused(DEAL_WORDS.page.errFailed, 500, 'failed');
  }
  if (!r.ok) {
    if (r.why === 'not_found') return notFound();
    const [text, status] = REFUSED[r.why];
    return refused(text, status, r.why);
  }
  return NextResponse.json({ endsDeal: r.endsDeal, owingAgain: r.owingAgain, emailedTo: r.emailedTo });
}, { route: '/api/admin/sponsorships/deals/[dealId]/refunds/[refundId]/finish' });
