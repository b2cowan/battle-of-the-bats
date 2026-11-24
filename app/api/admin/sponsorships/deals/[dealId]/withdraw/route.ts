import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { readDeal, withdrawDeal } from '@/lib/club-sponsorship-deals-server';
import { actorOf } from '@/lib/club-sponsorship-deal-actions';
import { closeSponsorCheckout } from '@/lib/sponsor-card-server';
import { canWithdraw } from '@/lib/club-sponsorship-deals';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';

/**
 * WITHDRAW A DEAL (Board Ready Stage 6, Part 2; ask 4: until it is paid), with the reason, kept with who withdrew it. Its
 * link stops showing the offer, its place comes down and is freed. An issued invoice is voided with it (Part 3 prints the
 * void); its number is never given again (mig 526's counter). A deal with a payment on it is refused (void the payment
 * first; mig 528's guard holds it in the database too).
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ dealId: string }> };

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const { dealId } = await params;
  const deal = isUuid(dealId) ? await readDeal(org.id, dealId) : null;
  if (!deal) return NextResponse.json({ error: SPONSORSHIPS_WORDS.say.notFound, code: 'not_found' }, { status: 404 });
  if (deal.paidAmount > 0 && deal.state !== 'paid') return refused(DEAL_WORDS.deal.errPaidWithdraw, 409, 'has_payment');
  if (!canWithdraw(deal)) return refused(DEAL_WORDS.deal.errPaid, 409, 'paid');
  const b = (await req.json().catch(() => null) ?? {}) as Record<string, unknown>;
  const reason = typeof b.reason === 'string' ? b.reason.trim() : '';
  if (!reason || reason.length > 300) return refused(DEAL_WORDS.deal.errReason);
  // A card page still open on the deal is closed first (Part 3b): paid after the withdrawal, it would have nowhere to land.
  const closed = await closeSponsorCheckout(dealId);
  if (closed !== 'closed') return refused(DEAL_WORDS.card.errCardPaying, 409, closed === 'paid' ? 'card_paid' : 'card_open');
  try {
    if (!(await withdrawDeal(org.id, dealId, await actorOf(gate.ctx), reason))) return refused(DEAL_WORDS.deal.errPaid, 409, 'paid');
  } catch (e) {
    // mig 528's guard: a payment was recorded while this window sat open.
    if ((e as { code?: string }).code === 'SP004') return refused(DEAL_WORDS.deal.errPaidWithdraw, 409, 'has_payment');
    throw e;
  }
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/sponsorships/deals/[dealId]/withdraw' });
