import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationBySlug, getPublicTournamentBySlug } from '@/lib/db';
import { getTournamentViewer } from '@/lib/tournament-viewer-hats';

/**
 * GET /api/public/tournament-viewer?org={orgSlug}&tournament={tournamentSlug}
 *
 * The account chip's data source (Phase 3): the signed-in viewer's hats on this
 * event. Client-fetched ON PURPOSE — public tournament HTML is offline-cached by
 * the service worker as anonymous content, so per-user identity must ride the
 * /api/ lane (blanket never-cached) instead of the server-rendered page.
 * Anonymous / unknown org / non-public tournament all resolve to { viewer: null }
 * — this endpoint reveals nothing the viewer's own session doesn't already know.
 */
export async function GET(request: NextRequest) {
  const orgSlug = request.nextUrl.searchParams.get('org');
  const tournamentSlug = request.nextUrl.searchParams.get('tournament');
  if (!orgSlug || !tournamentSlug) {
    return NextResponse.json({ viewer: null }, { status: 400 });
  }

  try {
    const org = await getOrganizationBySlug(orgSlug);
    if (!org || org.subscriptionStatus === 'canceled') {
      return NextResponse.json({ viewer: null });
    }
    const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);
    if (!tournament) {
      return NextResponse.json({ viewer: null });
    }

    const viewer = await getTournamentViewer({
      orgSlug,
      orgId: org.id,
      orgName: org.name,
      tournamentId: tournament.id,
    });

    return NextResponse.json(
      { viewer },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ viewer: null });
  }
}
