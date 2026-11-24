import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { requireSponsorships } from '@/lib/club-sponsorships-auth';
import { dealCreditNotePdf, invoicePdfResponse } from '@/lib/club-sponsor-invoice-pdf';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';

/**
 * A REFUND'S CREDIT NOTE, AS A PDF (Board Ready Stage 6 Part 3b; /accounting 2026-11-23: the club reduces the GST/HST it
 * collected only with a credit note). Only a refund that reached the card on a taxed invoice has one. The same file the
 * business downloads from its link.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ dealId: string; refundId: string }> };

export const GET = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const { dealId, refundId } = await params;
  const file = isUuid(dealId) && isUuid(refundId) ? await dealCreditNotePdf(org, dealId, refundId) : null;
  if (!file) return NextResponse.json({ error: SPONSORSHIPS_WORDS.say.notFound, code: 'not_found' }, { status: 404 });
  return invoicePdfResponse(file);
}, { route: '/api/admin/sponsorships/deals/[dealId]/refunds/[refundId]/credit-note' });
