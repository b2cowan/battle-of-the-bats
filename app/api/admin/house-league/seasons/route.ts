import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLeagueSeasons, getLeagueSeasonSummary } from '@/lib/db';
import { houseLeagueSeasonCap, isFreeFloorLeague, leagueCapHit } from '@/lib/free-floor';
import { writePlatformEvent } from '@/lib/platform-events';
import { withObservability } from '@/lib/observability';
import { DEFAULT_SPORT } from '@/lib/sports';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  return null;
}

export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const seasons = await getLeagueSeasons(ctx!.org.id);
  const summaries = await Promise.all(seasons.map(s => getLeagueSeasonSummary(s)));
  return NextResponse.json({ seasons: summaries });
}, { route: '/api/admin/house-league/seasons' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const body = await req.json();

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';

  if (!name || name.length > 120) {
    return NextResponse.json(
      { error: 'name is required and must be 120 characters or fewer' },
      { status: 400 },
    );
  }
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: 'slug must contain only lowercase letters, numbers, and hyphens' },
      { status: 400 },
    );
  }

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
      division:                    typeof body.division === 'string' && body.division ? body.division : null,
      description:                  typeof body.description === 'string' && body.description ? body.description : null,
      registration_fee:             typeof body.registrationFee === 'number' ? body.registrationFee : null,
      // Manual fee tracking only on the free floor: never auto-create accounting-ledger
      // entries (the accounting module is a paid/Club differentiator the floor doesn't own).
      auto_generate_fees:           body.autoGenerateFees === true && !isFreeFloorLeague(ctx!.org),
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
      return NextResponse.json({ error: 'A season with this slug already exists' }, { status: 409 });
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
