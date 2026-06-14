import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getLeagueSeasonById, createLeagueGame } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

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

  // Combine date + time into ISO timestamp if both provided
  let scheduledAt: string | null = null;
  if (body.scheduledDate && body.scheduledTime) {
    scheduledAt = new Date(`${body.scheduledDate}T${body.scheduledTime}`).toISOString();
  } else if (body.scheduledAt) {
    scheduledAt = body.scheduledAt;
  }

  const game = await createLeagueGame({
    orgId: ctx!.org.id,
    seasonId,
    divisionId,
    homeTeamId,
    awayTeamId,
    scheduledAt,
    location: body.location ?? null,
    notes:    body.notes ?? null,
  });

  return NextResponse.json({ game }, { status: 201 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule' });
