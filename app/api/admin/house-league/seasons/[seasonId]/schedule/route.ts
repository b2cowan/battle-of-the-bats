import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getLeagueSeasonById, createLeagueGame } from '@/lib/db';
import { resolveLeagueVenueSelection, checkLeagueBookings, resolveEndInstant } from '@/lib/league-venue';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { zonedWallClockToUtc } from '@/lib/timezone';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  return null;
}

function mapGame(row: any) {
  return {
    id:          row.id,
    seasonId:    row.season_id,
    divisionId:  row.division_id,
    homeTeamId:  row.home_team_id,
    awayTeamId:  row.away_team_id,
    scheduledAt: row.scheduled_at ?? null,
    endsAt:      row.ends_at ?? null,
    orgVenueId:         row.org_venue_id ?? null,
    orgVenueFacilityId: row.org_venue_facility_id ?? null,
    location:    row.location ?? null,
    homeScore:   row.home_score ?? null,
    awayScore:   row.away_score ?? null,
    status:      row.status,
    notes:       row.notes ?? null,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const divisionId = url.searchParams.get('divisionId');
  const weekOf     = url.searchParams.get('weekOf'); // YYYY-MM-DD (Monday of week)

  let q = supabaseAdmin
    .from('league_games')
    .select('*')
    .eq('season_id', seasonId)
    .order('scheduled_at', { ascending: true });

  if (divisionId) q = q.eq('division_id', divisionId);

  if (weekOf) {
    const start = new Date(weekOf);
    const end   = new Date(weekOf);
    end.setDate(end.getDate() + 7);
    q = q.gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString());
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ games: (data ?? []).map(mapGame) });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const body = await req.json();
  const { divisionId, homeTeamId, awayTeamId } = body;

  if (!divisionId || !homeTeamId || !awayTeamId) {
    return NextResponse.json({ error: 'divisionId, homeTeamId, and awayTeamId required' }, { status: 400 });
  }
  if (homeTeamId === awayTeamId) {
    return NextResponse.json({ error: 'Home and away teams must be different' }, { status: 400 });
  }

  // Ownership: the division and both teams must live in THIS org's season. Body ids were
  // previously trusted, which both mis-filed rows against foreign orgs and — once conflict
  // messages started naming teams — would have echoed another org's team name back.
  const [{ data: division }, { data: teamRows }] = await Promise.all([
    supabaseAdmin.from('league_divisions').select('id').eq('id', divisionId).eq('season_id', seasonId).single(),
    supabaseAdmin.from('league_teams').select('id, name').in('id', [homeTeamId, awayTeamId]).eq('season_id', seasonId),
  ]);
  if (!division) return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  if ((teamRows ?? []).length !== 2) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  // Combine date + time into ISO timestamp if both provided.
  // J3-047: org-zone wall-clock → UTC (matches the PATCH route; the naive `new Date()`
  // construction here was the last league writer still using the server's zone).
  let scheduledAt: string | null = null;
  if (body.scheduledDate && body.scheduledTime) {
    scheduledAt = zonedWallClockToUtc(body.scheduledDate, body.scheduledTime)
      ?? new Date(`${body.scheduledDate}T${body.scheduledTime}`).toISOString();
  } else if (body.scheduledAt) {
    scheduledAt = body.scheduledAt;
  } else if (body.scheduledDate || body.scheduledTime) {
    // Half a schedule is a silent no-op waiting to happen — refuse it out loud.
    return NextResponse.json({ error: 'Date and time must be set together' }, { status: 400 });
  }
  const endsAt = resolveEndInstant(scheduledAt, body.scheduledDate, body.endTime);

  // Venue comes from the org library; the display string is DERIVED server-side so
  // `location` can never disagree with the reference. Free text only when nothing picked.
  const selection = await resolveLeagueVenueSelection({
    orgId: ctx!.org.id,
    orgVenueId: body.orgVenueId ?? null,
    orgVenueFacilityId: body.orgVenueFacilityId ?? null,
    locationText: body.location ?? null,
  });
  if (!selection.ok) return NextResponse.json({ error: selection.error }, { status: 400 });

  // One booking pool, org-wide: a practice on this surface blocks this game too.
  const names = new Map((teamRows ?? []).map(t => [t.id, t.name]));
  const check = await checkLeagueBookings({
    orgId: ctx!.org.id,
    proposed: [{
      id: 'new-game', kind: 'game',
      startsAt: scheduledAt, endsAt,
      orgVenueId: selection.value.orgVenueId,
      orgVenueFacilityId: selection.value.orgVenueFacilityId,
      location: selection.value.location,
      label: `${names.get(homeTeamId) ?? 'Home'} vs ${names.get(awayTeamId) ?? 'Away'}`,
    }],
  });
  if (check.blocking.length) {
    return NextResponse.json(
      { error: check.blocking[0].message, conflicts: check.blocking },
      { status: 409 },
    );
  }

  const game = await createLeagueGame({
    orgId: ctx!.org.id,
    seasonId,
    divisionId,
    homeTeamId,
    awayTeamId,
    scheduledAt,
    endsAt,
    orgVenueId:         selection.value.orgVenueId,
    orgVenueFacilityId: selection.value.orgVenueFacilityId,
    location: selection.value.location,
    notes:    body.notes ?? null,
  });

  return NextResponse.json(
    { game, warnings: check.warnings.map(w => w.message) },
    { status: 201 },
  );
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule' });
