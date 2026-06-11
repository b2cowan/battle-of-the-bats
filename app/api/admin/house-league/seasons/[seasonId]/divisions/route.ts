import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLeagueSeasonById, getDivisionsForSeason } from '@/lib/db';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  return null;
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const divisions = await getDivisionsForSeason(seasonId);

  // Fetch active + waitlist counts per division efficiently in one query
  const { data: regCounts } = await supabaseAdmin
    .from('league_registrations')
    .select('division_id, status')
    .eq('season_id', seasonId)
    .in('status', ['active', 'waitlisted']);

  const activeByDivision   = new Map<string, number>();
  const waitlistByDivision = new Map<string, number>();
  for (const r of regCounts ?? []) {
    if (!r.division_id) continue;
    if (r.status === 'active') {
      activeByDivision.set(r.division_id, (activeByDivision.get(r.division_id) ?? 0) + 1);
    } else {
      waitlistByDivision.set(r.division_id, (waitlistByDivision.get(r.division_id) ?? 0) + 1);
    }
  }

  const divisionsWithStats = divisions.map(d => ({
    ...d,
    activeCount:   activeByDivision.get(d.id)   ?? 0,
    waitlistCount: waitlistByDivision.get(d.id) ?? 0,
  }));

  return NextResponse.json({ divisions: divisionsWithStats });
}, { route: '/api/admin/house-league/seasons/[seasonId]/divisions' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 100) {
    return NextResponse.json(
      { error: 'name is required and must be 100 characters or fewer' },
      { status: 400 },
    );
  }

  const capacity = typeof body.capacity === 'number' && body.capacity > 0 ? body.capacity : null;

  // sortOrder: place after existing divisions
  const existing = await getDivisionsForSeason(seasonId);
  const sortOrder = existing.length;

  const { data, error } = await supabaseAdmin
    .from('league_divisions')
    .insert({ season_id: seasonId, name, capacity, sort_order: sortOrder })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/divisions' });
