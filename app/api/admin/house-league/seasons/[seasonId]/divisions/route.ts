import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLeagueSeasonById, getDivisionsForSeason } from '@/lib/db';
import { houseLeagueDivisionCap, leagueCapHit } from '@/lib/free-floor';
import { writePlatformEvent } from '@/lib/platform-events';
import { withObservability } from '@/lib/observability';
import { bornColumns, checkBornBody } from '@/lib/born-years';

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
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
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;

  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 100) {
    return NextResponse.json(
      { error: 'name is required and must be 100 characters or fewer' },
      { status: 400 },
    );
  }

  // Spots are required: a division with no number can't tick the season's checklist.
  const capacity = body.capacity;
  if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity < 1) {
    return NextResponse.json({ error: 'Give the division its number of spots.' }, { status: 400 });
  }
  if (capacity > 100000) return NextResponse.json({ error: 'Spots can’t be more than 100,000.' }, { status: 400 });

  // Birth years (Club Tier Stage 4c-2): two years, an empty box is no limit on that side. Held with its reason (A15–A17) when
  // not four digits, after this year, or the earlier one is second. The stricter date rule off January 1 is the window's.
  const born = checkBornBody(body.bornFromYear, body.bornToYear, new Date().getFullYear());
  if (!born.ok) return NextResponse.json({ error: born.held }, { status: 400 });

  // sortOrder: place after existing divisions
  const existing = await getDivisionsForSeason(seasonId);

  // Free-floor (League Starter) cap: one division per season. Paid plans are uncapped (this branch
  // is only reachable for a free-floor org, since the cap is Infinity otherwise).
  if (existing.length >= houseLeagueDivisionCap(ctx!.org)) {
    await writePlatformEvent({
      eventType: 'scope_wall_hit',
      source: 'app',
      orgId: ctx!.org.id,
      actorUserId: ctx!.user?.id ?? null,
      actorEmail: ctx!.user?.email ?? null,
      metadata: { freeFloor: 'league_starter', capHit: 'league_division', seasonId },
    });
    return NextResponse.json(leagueCapHit('league_division'), { status: 403 });
  }

  const sortOrder = existing.length;

  const { data, error } = await supabaseAdmin
    .from('league_divisions')
    .insert({ season_id: seasonId, name, capacity, sort_order: sortOrder, ...bornColumns(born.years) })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/divisions' });
