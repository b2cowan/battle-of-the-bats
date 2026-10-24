import { NextResponse } from 'next/server';
import { clubHosts } from '@/lib/club-host';
import { usesOwnAddress } from '@/lib/club-domain';
import { withObservability } from '@/lib/observability';

/**
 * GET /api/public/club-origin?orgSlug=… : the address a club's public pages are handed out at (Club Tier Stage 4e, Part 5).
 * `{ origin: "https://www.lakeshorelynx.ca" }` while the club's own web address is connected (or needs attention); `{ origin:
 * null }` otherwise, and the caller falls back to the address it is on. The admin and coach screens that hand out a link to a
 * club's PUBLIC pages (a tryout page, a tournament, a team page) ask this once, so the link a volunteer copies is the one
 * families should use. Public on purpose: it is the address already printed on the club's posters. Answered from the in-memory
 * host table, no database read per request.
 */
export const GET = withObservability(async (req: Request) => {
  const slug = new URL(req.url).searchParams.get('orgSlug')?.trim() ?? '';
  if (!slug) return NextResponse.json({ origin: null }, { status: 400 });
  const club = await clubHosts.forSlug(slug);
  const origin = club && club !== 'unavailable' && usesOwnAddress(club.status) ? `https://${club.host}` : null;
  return NextResponse.json({ origin }, { headers: { 'Cache-Control': 'public, max-age=30' } });
}, { route: '/api/public/club-origin' });
