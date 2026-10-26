import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { registrationsInSeason } from '@/lib/league-season-scope';
import { isPlayerRating, setRatings } from '@/lib/house-league-ratings';
import { withObservability } from '@/lib/observability';

/**
 * Rate players (Club Tier 9c, copy §3): one or many accepted players of this season at once, 1-5, or null to clear. The
 * runners only, on a live season (the gate's `rate`; a finished season's ratings are erased, 9c·2b). Autosaved: each tap
 * is one call.
 */
export const PUT = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'rate');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'rate', season);
  if (refused) return refused;

  const body = await req.json().catch(() => ({}));
  const registrationIds: unknown = body.registrationIds;
  const rating: unknown = body.rating;
  if (!Array.isArray(registrationIds) || registrationIds.length === 0 || registrationIds.length > 500) {
    return NextResponse.json({ error: 'Choose the players to rate.' }, { status: 400 });
  }
  if (rating !== null && !isPlayerRating(rating)) {
    return NextResponse.json({ error: 'A rating is a number from 1 to 5.' }, { status: 400 });
  }
  if (!(await registrationsInSeason(seasonId, registrationIds))) {
    return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
  }
  // Ratings are for accepted players (copy §3 rate.empty).
  const { data: accepted, error } = await supabaseAdmin.from('league_registrations').select('id')
    .in('id', registrationIds as string[]).eq('season_id', seasonId).eq('status', 'active');
  if (error) return NextResponse.json({ error: 'That rating didn’t save. Check your connection and tap it again.' }, { status: 500 });
  if ((accepted ?? []).length !== new Set(registrationIds).size) {
    return NextResponse.json({ error: 'Ratings are for accepted players in this division.' }, { status: 409 });
  }

  await setRatings(registrationIds as string[], rating === null ? null : rating as 1 | 2 | 3 | 4 | 5, ctx!.user.id);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/ratings' });
