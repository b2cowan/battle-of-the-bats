import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { throttleSignupFiles } from '@/lib/public-form-throttle';
import { isUuid } from '@/lib/utils';
import { dealForLink } from '@/lib/sponsor-link-route';
import { dealCreditNotePdf, invoicePdfResponse } from '@/lib/club-sponsor-invoice-pdf';

export const dynamic = 'force-dynamic';

/**
 * GET /api/public/sponsorship/[token]/credit-note/[refundId] — a refund's credit note (Part 3b; /accounting 2026-11-23).
 * Throttled first; the token's deal only, through the link's one door — a deal refunded in full (and so withdrawn) still
 * downloads its paper. A refund of another deal is not found.
 */
export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ token: string; refundId: string }> }) => {
  const throttled = throttleSignupFiles(req);
  if (throttled) return throttled;
  const { token, refundId } = await params;
  const gone = () => new NextResponse('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  if (!isUuid(refundId)) return gone();
  const at = await dealForLink(token, { keepRefunded: true });
  if ('failure' in at) return gone();
  const file = await dealCreditNotePdf(at.org, at.deal.id, refundId);
  return file ? invoicePdfResponse(file) : gone();
}, { route: '/api/public/sponsorship/[token]/credit-note/[refundId]' });
