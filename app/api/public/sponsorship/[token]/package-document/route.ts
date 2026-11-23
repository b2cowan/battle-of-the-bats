import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { throttleSignupFiles } from '@/lib/public-form-throttle';
import { dealForLink } from '@/lib/sponsor-link-route';
import { readPackage } from '@/lib/club-sponsorships-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CLUB_FORM_BUCKET } from '@/lib/club-form-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/public/sponsorship/[token]/package-document — "The full package (1.4 MB) ↗" (round 1 tab 4): the PDF of THIS
 * deal's package, through a one-hour signed link. Throttled first; the token's deal only; never another package's file.
 */
export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const throttled = throttleSignupFiles(req);
  if (throttled) return throttled;
  const { token } = await params;
  const gone = (status: number) => new NextResponse('Not found', { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  const at = await dealForLink(token);
  if ('failure' in at) return gone(404);
  const pkg = await readPackage(at.org.id, at.deal.packageId);
  if (!pkg?.documentPath || !pkg.document) return gone(404);
  const { data, error } = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).createSignedUrl(pkg.documentPath, 3600);
  if (error || !data?.signedUrl) return gone(502);
  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set('Cache-Control', 'private, no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}, { route: '/api/public/sponsorship/[token]/package-document' });
