import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLeagueSeasonById, getDivisionsForSeason } from '@/lib/db';
import { houseLeagueDivisionCap, leagueCapHit } from '@/lib/free-floor';
import { writePlatformEvent } from '@/lib/platform-events';
import { withObservability } from '@/lib/observability';
import { bornColumns, checkBornBody } from '@/lib/born-years';
import { earlyPriceRefusal, priceFromBody } from '@/lib/league-price';

type NewDivision = { name: string; capacity: number; born: { from: number | null; to: number | null }; price: number | null; earlyPrice: number | null; note: string | null };

/** One division from the body, or why not. Names are unique within the season (case ignored): a family picks by name. */
function readDivision(raw: Record<string, unknown>, thisYear: number): NewDivision | { error: string } {
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return { error: 'Give the division a name.' };
  if (name.length > 100) return { error: 'A division’s name is 100 characters or fewer.' };
  // Spots are required: a division with no number can't tick the season's checklist.
  const capacity = raw.capacity;
  if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity < 1) return { error: `Give ${name} its number of players.` };
  if (capacity > 100000) return { error: 'Spots can’t be more than 100,000.' };
  // Birth years (Club Tier Stage 4c-2): two years, an empty box is no limit on that side.
  const born = checkBornBody(raw.bornFromYear, raw.bornToYear, thisYear);
  if (!born.ok) return { error: born.held };
  const price = priceFromBody(raw.price), earlyPrice = priceFromBody(raw.earlyPrice);
  if (price && 'error' in price) return { error: price.error };
  if (earlyPrice && 'error' in earlyPrice) return { error: earlyPrice.error };
  const p = price?.value ?? null, e = earlyPrice?.value ?? null;
  const early = earlyPriceRefusal(p, e);
  if (early) return { error: early };
  const note = typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim().slice(0, 120) : null;
  return { name, capacity, born: born.years, price: p, earlyPrice: e, note };
}

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

  // One division (`{ name, capacity, … }`) or several at once (`{ divisions: [...] }`, Add age groups): all or none.
  const body = await req.json().catch(() => null);
  const raws: Record<string, unknown>[] = Array.isArray(body?.divisions) ? body.divisions : body && typeof body === 'object' ? [body] : [];
  if (raws.length === 0 || raws.length > 30) return NextResponse.json({ error: 'Add between 1 and 30 divisions at a time.' }, { status: 400 });
  const thisYear = new Date().getFullYear();
  const adds: NewDivision[] = [];
  for (const raw of raws) {
    const d = readDivision(raw && typeof raw === 'object' ? raw : {}, thisYear);
    if ('error' in d) return NextResponse.json({ error: d.error }, { status: 400 });
    adds.push(d);
  }

  // sortOrder: place after existing divisions
  const existing = await getDivisionsForSeason(seasonId);
  const taken = new Set(existing.map(d => d.name.trim().toLowerCase()));
  for (const d of adds) {
    if (taken.has(d.name.toLowerCase())) {
      return NextResponse.json({ error: `Another division in this season is named ${d.name}.` }, { status: 409 });
    }
    taken.add(d.name.toLowerCase());
  }

  // Free-floor (League Starter) cap: one division per season. Paid plans are uncapped (this branch
  // is only reachable for a free-floor org, since the cap is Infinity otherwise).
  if (existing.length + adds.length > houseLeagueDivisionCap(ctx!.org)) {
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

  const { data, error } = await supabaseAdmin
    .from('league_divisions')
    .insert(adds.map((d, i) => ({
      season_id: seasonId, name: d.name, capacity: d.capacity, sort_order: existing.length + i, ...bornColumns(d.born),
      price: d.price, early_price: d.earlyPrice, note: d.note,
    })))
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // A single add answers with the division, as it always has; several answer with the list.
  return NextResponse.json(Array.isArray(body?.divisions) ? { divisions: data } : data![0], { status: 201 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/divisions' });
