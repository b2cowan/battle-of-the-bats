import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getLeagueSeasonById, updateLeagueTeam, deleteLeagueTeam } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  return null;
}

async function verifyTeam(teamId: string, seasonId: string) {
  const { data } = await supabaseAdmin
    .from('league_teams')
    .select('id')
    .eq('id', teamId)
    .eq('season_id', seasonId)
    .single();
  return data;
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string; teamId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId, teamId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  if (!await verifyTeam(teamId, seasonId)) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const body = await req.json();
  const patch: { name?: string; color?: string | null; coachName?: string | null } = {};
  if (typeof body.name === 'string') patch.name = body.name.trim();
  if ('color'     in body)          patch.color     = body.color ?? null;
  if ('coachName' in body)          patch.coachName = body.coachName ?? null;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  await updateLeagueTeam(teamId, patch);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/teams/[teamId]' });

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ seasonId: string; teamId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId, teamId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  if (!await verifyTeam(teamId, seasonId)) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const { count } = await supabaseAdmin
    .from('league_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('status', 'active');

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Remove all players from this team before deleting it.' },
      { status: 409 },
    );
  }

  await deleteLeagueTeam(teamId);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/teams/[teamId]' });
