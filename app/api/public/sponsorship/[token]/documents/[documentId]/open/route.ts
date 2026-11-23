import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { throttleSignupFiles } from '@/lib/public-form-throttle';
import { dealForLink } from '@/lib/sponsor-link-route';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CLUB_FORM_BUCKET, readSignupForm, sponsorshipFormId } from '@/lib/club-form-server';
import { HANDOVER_MAX_AGE_S, handoverCookieName, signHandover } from '@/lib/club-form-family';

export const dynamic = 'force-dynamic';

/** The one-hour link the published Privacy Policy promises. */
const ONE_HOUR = 60 * 60;

/**
 * GET /api/public/sponsorship/[token]/documents/[documentId]/open?v={versionId}[&download=1] — the business opens a PDF
 * of the club's sponsorship form (the family form's hand-over, rulings 8 and 18, as it is). OUR SERVER hands it over: a
 * one-hour signed link and a receipt cookie naming the version and the moment, read back by this link's send ONLY (the
 * cookie's path is this link's). Throttled first; the token's deal only.
 */
export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ token: string; documentId: string }> }) => {
  const throttled = throttleSignupFiles(req);
  if (throttled) return throttled;
  const { token, documentId } = await params;
  const gone = (status: number, line: string) => new NextResponse(line, {
    status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
  const at = await dealForLink(token);
  if ('failure' in at) return gone(404, 'Not found');
  const formId = await sponsorshipFormId(at.org.id);
  if (!formId) return gone(404, 'Not found');
  const url = new URL(req.url);
  const versionId = url.searchParams.get('v') ?? '';
  const { view, versions } = await readSignupForm(formId);
  const doc = view.documents.find(d => d.id === documentId && d.source === 'pdf');
  if (!doc) return gone(404, 'This document isn’t on the page any more. Go back and reload the page.');
  if (doc.versionId !== versionId) return gone(409, `${at.org.name} updated this document. Go back and reload the page to open the new version.`);
  const path = versions.find(v => v.id === doc.versionId)?.filePath;
  if (!path) return gone(404, 'Not found');
  const download = url.searchParams.get('download') === '1';
  const { data, error } = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET)
    .createSignedUrl(path, ONE_HOUR, download ? { download: doc.fileName ?? 'document.pdf' } : undefined);
  if (error || !data?.signedUrl) return gone(502, 'The document didn’t open. Go back and try again.');
  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set('Cache-Control', 'private, no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  // No secret, no receipt: the PDF still opens, but can't be ticked (it fails closed).
  const receipt = signHandover(doc.versionId, Date.now());
  if (receipt) res.cookies.set(handoverCookieName(doc.id), receipt, {
    httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' || process.env.NODE_ENV === 'production', maxAge: HANDOVER_MAX_AGE_S,
    // Read only by this link's own send.
    path: `/api/public/sponsorship/${token}`,
  });
  return res;
}, { route: '/api/public/sponsorship/[token]/documents/[documentId]/open' });
