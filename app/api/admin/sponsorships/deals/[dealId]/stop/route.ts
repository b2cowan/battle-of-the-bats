import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { addOfferStop, readDeal, readDealBusiness } from '@/lib/club-sponsorship-deals-server';
import { actorOf } from '@/lib/club-sponsorship-deal-actions';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';

/**
 * "DO NOT OFFER AGAIN" (Board Ready Stage 6, Part 2; ask 13, /legal §1): a stop the business said by reply or by phone,
 * honoured at once. For good, per club and address, sponsorship offers only — kept with who pressed it, and no seat at the
 * club can clear it (the stops table is insert-only). Invoices and receipts for a live deal still go.
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
  // The address it was offered to AND the one the business has since given: "do not offer again" follows the business.
  const addresses = [...new Set([deal.offeredTo, (await readDealBusiness(org.id, dealId))?.email].filter((a): a is string => !!a?.trim()).map(a => a.trim().toLowerCase()))];
  if (!addresses.length) return refused(SPONSORSHIPS_WORDS.say.failed);
  const by = await actorOf(gate.ctx);
  for (const address of addresses) await addOfferStop(org.id, address, by);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/sponsorships/deals/[dealId]/stop' });
