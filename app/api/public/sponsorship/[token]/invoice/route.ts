import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { throttleSignupFiles } from '@/lib/public-form-throttle';
import { dealForLink } from '@/lib/sponsor-link-route';
import { dealInvoicePdf, invoicePdfResponse } from '@/lib/club-sponsor-invoice-pdf';

export const dynamic = 'force-dynamic';

/**
 * GET /api/public/sponsorship/[token]/invoice — "Download the invoice (PDF)" / "Download your receipt (PDF)" (round 1 tab 4
 * screen D, round 2 tab 1; Part 3a). Throttled first (a file is heavier than a page); the token's deal only, through the
 * link's one door; a replaced link or a withdrawn deal gets nothing. The same file the club opens: the receipt once paid.
 */
export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const throttled = throttleSignupFiles(req);
  if (throttled) return throttled;
  const { token } = await params;
  const gone = () => new NextResponse('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  const at = await dealForLink(token, { keepRefunded: true });
  if ('failure' in at) return gone();
  const file = await dealInvoicePdf(at.org, at.deal.id);
  return file ? invoicePdfResponse(file) : gone();
}, { route: '/api/public/sponsorship/[token]/invoice' });
