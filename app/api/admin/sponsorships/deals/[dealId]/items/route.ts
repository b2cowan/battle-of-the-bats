import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { readDeal, setDealItem } from '@/lib/club-sponsorship-deals-server';
import { actorOf } from '@/lib/club-sponsorship-deal-actions';
import { checklistOf, checklistOpen } from '@/lib/club-sponsorship-deals';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';

/**
 * TICK A DELIVERY LINE (Board Ready Stage 6, Part 2; round 1 tab 5, asks 4 and 5). The checklist opens once the deal is
 * invoiced (nothing can be delivered on an open offer). The logo line puts the logo up now rather than when the deal is
 * paid; unticking it before payment takes it down again. Who ticked it is kept by name ("Ticked by Dana Ruiz").
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ dealId: string }> };

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const { dealId } = await params;
  const deal = isUuid(dealId) ? await readDeal(org.id, dealId) : null;
  if (!deal || deal.state === 'withdrawn') return NextResponse.json({ error: SPONSORSHIPS_WORDS.say.notFound, code: 'not_found' }, { status: 404 });
  if (!checklistOpen(deal)) return refused(DEAL_WORDS.deal.checklistClosed, 409, 'closed');
  const b = (await req.json().catch(() => null) ?? {}) as Record<string, unknown>;
  const itemId = typeof b.itemId === 'string' ? b.itemId : '';
  if (!checklistOf(deal).some(l => l.id === itemId)) return refused(SPONSORSHIPS_WORDS.say.failed);
  await setDealItem(org.id, dealId, itemId, b.on === true, await actorOf(gate.ctx));
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/sponsorships/deals/[dealId]/items' });
