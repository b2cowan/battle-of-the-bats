import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { readRegistrationForm } from '@/lib/club-form-staff';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { seasonRegistration, staffSeason } from '@/lib/club-form-staff-route';

/**
 * One registration's "Sign-up answers" and "Documents" (Board Ready Stage 4 Part 3; drawing tab 6 · B). Health answers come
 * back here and nowhere else a list reads (ruling 5): only the record window asks, when it opens, behind the Registrations
 * read (ruling 6).
 */
export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ seasonId: string; regId: string }> }) => {
  const { seasonId, regId } = await params;
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err || !ctx) return err ?? NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const season = await staffSeason(ctx.org.id, seasonId);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const reg = await seasonRegistration(season.id, regId);
  if (!reg) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
  const form = await readRegistrationForm({ seasonId: season.id, reg });
  return NextResponse.json({ form }, { headers: { 'Cache-Control': 'no-store' } });
}, { route: '/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/answers' });
