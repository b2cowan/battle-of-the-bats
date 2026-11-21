import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { openFamilyFile } from '@/lib/club-form-staff';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { seasonRegistration, staffSeason } from '@/lib/club-form-staff-route';

/**
 * Open a family's file (Board Ready Stage 4 Part 3; rulings 6 and 9): a one-hour link that DOWNLOADS (`attachment`), made
 * only for a file attached to this registration (or its sign-up), behind the Registrations read. Each opening is written to
 * the club's activity log (who, when, the registration, the file's id; never its name or content). POST, so a link
 * prefetch never counts as an opening.
 */
export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ seasonId: string; regId: string; fileId: string }> }) => {
  const { seasonId, regId, fileId } = await params;
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err || !ctx) return err ?? NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const season = await staffSeason(ctx.org.id, seasonId);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  // A write passes its season (Q16); reading answers stays open on a finished season, so this refuses nothing more today.
  const refused = houseLeagueRefusal(ctx, 'read', season);
  if (refused) return refused;
  const reg = await seasonRegistration(season.id, regId);
  if (!reg) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
  const url = await openFamilyFile({ orgId: ctx.org.id, actorId: ctx.user.id, seasonId: season.id, reg, fileId });
  if (!url) return NextResponse.json({ error: 'That file is no longer here.' }, { status: 404 });
  return NextResponse.json({ url }, { headers: { 'Cache-Control': 'no-store' } });
}, { route: '/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/files/[fileId]' });
