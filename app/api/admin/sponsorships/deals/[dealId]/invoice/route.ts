import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { requireSponsorships } from '@/lib/club-sponsorships-auth';
import { dealInvoicePdf, invoicePdfResponse } from '@/lib/club-sponsor-invoice-pdf';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';

/**
 * THE DEAL'S INVOICE, AS A PDF (Board Ready Stage 6 Part 3a; round 1 tab 6, round 2 tab 2) — the deal page's invoice
 * number opens it. The same file the business downloads from its link: the receipt once paid in full (ask 10).
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ dealId: string }> };

export const GET = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const { dealId } = await params;
  const file = isUuid(dealId) ? await dealInvoicePdf(org, dealId) : null;
  if (!file) return NextResponse.json({ error: SPONSORSHIPS_WORDS.say.notFound, code: 'not_found' }, { status: 404 });
  return invoicePdfResponse(file);
}, { route: '/api/admin/sponsorships/deals/[dealId]/invoice' });
