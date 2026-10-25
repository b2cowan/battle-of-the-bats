import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLeagueSeasons, getLeagueSeasonSummary } from '@/lib/db';
import { houseLeagueSeasonCap, isFreeFloorLeague, leagueCapHit } from '@/lib/free-floor';
import { writePlatformEvent } from '@/lib/platform-events';
import { withObservability } from '@/lib/observability';
import { DEFAULT_SPORT } from '@/lib/sports';
import { seasonSlugFrom, seasonSlugRefusal } from '@/lib/house-league-season';

export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err) return err;

  const seasons = await getLeagueSeasons(ctx!.org.id);
  const summaries = await Promise.all(seasons.map(s => getLeagueSeasonSummary(s)));
  return NextResponse.json({ seasons: summaries });
}, { route: '/api/admin/house-league/seasons' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;

  const body = await req.json();

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Give the season a name.' }, { status: 400 });
  if (name.length > 120) return NextResponse.json({ error: 'A season’s name is 120 characters or fewer.' }, { status: 400 });

  // The web address is made from the name (S1·a, F07); a caller may still send its own. Reserved or empty is refused, and a
  // name another season of this club already uses is refused by the unique (org, slug) below.
  const slug = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim().toLowerCase() : seasonSlugFrom(name);
  const slugRefused = seasonSlugRefusal(slug);
  if (slugRefused) return NextResponse.json({ error: slugRefused }, { status: 400 });

  // Free-floor (League Starter) cap: one non-archived season (draft or in-progress both count;
  // archiving an old season frees the slot for a new one). Server-enforced because house-league
  // is module-gated, not cap-gated. Paid plans are uncapped (Infinity).
  const seasonCap = houseLeagueSeasonCap(ctx!.org);
  if (seasonCap < Infinity) {
    const { count } = await supabaseAdmin
      .from('league_seasons')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', ctx!.org.id)
      .neq('status', 'archived');
    if ((count ?? 0) >= seasonCap) {
      await writePlatformEvent({
        eventType: 'scope_wall_hit',
        source: 'app',
        orgId: ctx!.org.id,
        actorUserId: ctx!.user?.id ?? null,
        actorEmail: ctx!.user?.email ?? null,
        metadata: { freeFloor: 'league_starter', capHit: 'league_season' },
      });
      return NextResponse.json(leagueCapHit('league_season'), { status: 403 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from('league_seasons')
    .insert({
      org_id:                       ctx!.org.id,
      name,
      slug,
      sport:                        typeof body.sport === 'string' && body.sport ? body.sport : DEFAULT_SPORT,
      description:                  typeof body.description === 'string' && body.description ? body.description : null,
      // A fee is 0 or more dollars; anything else is no fee (the field's min is only a hint).
      registration_fee:             typeof body.registrationFee === 'number' && Number.isFinite(body.registrationFee) && body.registrationFee >= 0 ? body.registrationFee : null,
      // ⚰ auto_generate_fees is no longer written (Club Tier Stage 9a, S1·b): stored, read by nothing — a fee reaches the
      // season's book only when it is marked received (lib/league-fee-paid.ts). The column keeps its default; its DROP
      // goes last in a release (prod release history), not here.
      auto_approve_under_capacity:  body.autoApproveUnderCapacity === true,
      auto_promote_waitlist:        body.autoPromoteWaitlist === true,
      registration_open_at:         typeof body.registrationOpenAt === 'string' && body.registrationOpenAt ? body.registrationOpenAt : null,
      registration_close_at:        typeof body.registrationCloseAt === 'string' && body.registrationCloseAt ? body.registrationCloseAt : null,
      season_start_date:            typeof body.seasonStartDate === 'string' && body.seasonStartDate ? body.seasonStartDate : null,
      season_end_date:              typeof body.seasonEndDate === 'string' && body.seasonEndDate ? body.seasonEndDate : null,
      waiver_text:                  typeof body.waiverText === 'string' && body.waiverText ? body.waiverText : null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You already have a season with this name. Give this one a different name.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Instrumentation (§13): League Starter activation signal. Gated to the free floor so the metric
  // tracks free-tier first-value, not paid League/Club season creation. Fire-and-forget.
  if (isFreeFloorLeague(ctx!.org)) {
    void writePlatformEvent({
      eventType: 'league_season_created',
      source: 'app',
      orgId: ctx!.org.id,
      actorUserId: ctx!.user?.id ?? null,
      actorEmail: ctx!.user?.email ?? null,
      metadata: { freeFloor: 'league_starter', seasonId: data.id },
    });
  }

  return NextResponse.json(data, { status: 201 });
}, { route: '/api/admin/house-league/seasons' });
