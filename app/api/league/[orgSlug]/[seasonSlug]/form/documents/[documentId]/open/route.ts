import { NextResponse } from 'next/server';
import { getLeagueSeasonBySlug } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { throttleSignupFiles } from '@/lib/public-form-throttle';
import { CLUB_FORM_BUCKET, ensureSeasonForm, readSignupForm } from '@/lib/club-form-server';
import { HANDOVER_MAX_AGE_S, handoverCookieName, signHandover } from '@/lib/club-form-family';

export const dynamic = 'force-dynamic';

/** The one-hour link the published Privacy Policy promises. */
const ONE_HOUR = 60 * 60;

/**
 * GET /api/league/[orgSlug]/[seasonSlug]/form/documents/[documentId]/open?v={versionId}[&download=1] — a family opens a
 * club's PDF (Board Ready Stage 4 Part 2; rulings 2, 8, 18; drawing tab 5). OUR SERVER hands it over: it checks the
 * document is live on the season's form and that `v` is its current version, then answers with a one-hour signed link
 * (in the tab; "Download it instead" asks for an attachment) and a receipt cookie naming the version and the moment of
 * hand-over. The sign-up (and Your sign-up's re-tick) brings the receipt back, and the tick records that time. Nothing is
 * stored before the sign-up. The same door for the sign-up page and Your sign-up, so it needs no family link; a season
 * still in draft opens nothing (its page is hidden too).
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; seasonSlug: string; documentId: string }> },) => {
  const { orgSlug, seasonSlug, documentId } = await params;
  const throttled = throttleSignupFiles(req);
  if (throttled) return throttled;

  const gone = (status: number, line: string) => new NextResponse(line, {
    status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) return gone(404, 'Not found');
  const season = await getLeagueSeasonBySlug(org.id, seasonSlug);
  if (!season || season.status === 'draft') return gone(404, 'Not found');

  const url = new URL(req.url);
  const versionId = url.searchParams.get('v') ?? '';
  const { view, versions } = await readSignupForm(await ensureSeasonForm(season.id));
  const doc = view.documents.find(d => d.id === documentId && d.source === 'pdf');
  if (!doc) return gone(404, 'This document isn’t on the sign-up any more. Go back and reload the page.');
  if (doc.versionId !== versionId) return gone(409, `${org.name} updated this document. Go back and reload the page to open the new version.`);
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
  // No secret, no receipt: the PDF still opens, but can't be ticked (it fails closed, like every signed value here).
  const receipt = signHandover(doc.versionId, Date.now());
  if (receipt) res.cookies.set(handoverCookieName(doc.id), receipt, {
    httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' || process.env.NODE_ENV === 'production', maxAge: HANDOVER_MAX_AGE_S,
    // Read only by this season's own requests (the sign-up and Your sign-up's re-tick).
    path: `/api/league/${orgSlug}/${seasonSlug}`,
  });
  return res;
}, { route: '/api/league/[orgSlug]/[seasonSlug]/form/documents/[documentId]/open' });
