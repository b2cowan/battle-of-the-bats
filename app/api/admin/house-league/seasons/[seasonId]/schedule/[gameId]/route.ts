import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getLeagueSeasonById, updateLeagueGame } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  return null;
}

async function verifyGame(gameId: string, seasonId: string) {
  const { data } = await supabaseAdmin
    .from('league_games')
    .select('id, status')
    .eq('id', gameId)
    .eq('season_id', seasonId)
    .single();
  return data;
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string; gameId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId, gameId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const game = await verifyGame(gameId, seasonId);
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  const body = await req.json();
  const patch: Parameters<typeof updateLeagueGame>[1] = {};

  // Combine date + time into ISO timestamp if provided separately
  if (body.scheduledDate && body.scheduledTime) {
    patch.scheduledAt = new Date(`${body.scheduledDate}T${body.scheduledTime}`).toISOString();
  } else if ('scheduledAt' in body) {
    patch.scheduledAt = body.scheduledAt ?? null;
  }

  if ('location'  in body) patch.location  = body.location ?? null;
  if ('notes'     in body) patch.notes     = body.notes ?? null;
  if ('status'    in body) patch.status    = body.status;
  if ('homeScore' in body) patch.homeScore = body.homeScore ?? null;
  if ('awayScore' in body) patch.awayScore = body.awayScore ?? null;

  // If entering scores, auto-set status to completed
  if (patch.homeScore !== undefined && patch.awayScore !== undefined && patch.status === undefined) {
    patch.status = 'completed';
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  await updateLeagueGame(gameId, patch);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]' });

// Soft-cancel: sets status = 'cancelled', does not hard-delete
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ seasonId: string; gameId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId, gameId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const game = await verifyGame(gameId, seasonId);
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  await updateLeagueGame(gameId, { status: 'cancelled' });
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]' });
