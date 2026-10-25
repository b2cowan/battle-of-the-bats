import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLeagueSeasonById, updateDivision, deleteDivision } from '@/lib/db';
import { withObservability, captureAndJson } from '@/lib/observability';
import { bornFitsDate, cutoffFor, type BornYears } from '@/lib/born-years';
import { bornYearsFromBody } from '@/lib/program-year-patch';
import type { LeagueSeason } from '@/lib/types';
import { earlyPriceRefusal, priceFromBody } from '@/lib/league-price';

/** The division's stored birth years (and its season) when it belongs to the org's season, else null (the PATCH keeps a side the body leaves out). */
async function verifyDivisionBelongsToOrg(
  divisionId: string,
  seasonId: string,
  orgId: string,
): Promise<{ born: BornYears; season: LeagueSeason; price: number | null; earlyPrice: number | null } | null> {
  const season = await getLeagueSeasonById(seasonId, orgId);
  if (!season) return null;
  const { data } = await supabaseAdmin
    .from('league_divisions')
    .select('id, born_from_year, born_to_year, price, early_price')
    .eq('id', divisionId)
    .eq('season_id', seasonId)
    .maybeSingle();
  if (!data) return null;
  return {
    season,
    born: { from: (data.born_from_year as number | null) ?? null, to: (data.born_to_year as number | null) ?? null },
    price: data.price != null ? Number(data.price) : null,
    earlyPrice: data.early_price != null ? Number(data.early_price) : null,
  };
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string; divisionId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;

  const { seasonId, divisionId } = await params;
  const stored = await verifyDivisionBelongsToOrg(divisionId, seasonId, ctx!.org.id);
  if (!stored) return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', stored.season);
  if (refused) return refused;

  const body = await req.json();
  const patch: Parameters<typeof updateDivision>[1] = {};

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: 'Give the division a name.' }, { status: 400 });
    if (name.length > 100) return NextResponse.json({ error: 'A division’s name is 100 characters or fewer.' }, { status: 400 });
    // A family picks a division by name, so two in one season never share one (case ignored).
    const { data: same } = await supabaseAdmin.from('league_divisions').select('id, name').eq('season_id', seasonId).neq('id', divisionId);
    if ((same ?? []).some(d => String(d.name).trim().toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: 'Another division in this season has this name.' }, { status: 409 });
    }
    patch.name = name;
  }

  if ('capacity' in body) {
    const capacity = body.capacity;
    if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity < 1) {
      return NextResponse.json({ error: 'Give the division its number of spots.' }, { status: 400 });
    }
    if (capacity > 100000) return NextResponse.json({ error: 'Spots can’t be more than 100,000.' }, { status: 400 });
    patch.capacity = capacity;
  }

  // Birth years travel as a pair; a side the body leaves out keeps what the division has (the season PATCH's rule). The
  // window always sends both, and an explicit null/empty is "no limit on that side".
  const born = bornYearsFromBody(body, stored.born, new Date().getFullYear());
  if (born && 'error' in born) return NextResponse.json({ error: born.error }, { status: 400 });
  if (born) {
    patch.bornFromYear = born.years.from;
    patch.bornToYear = born.years.to;
  }

  // Price and early amount (9b-1): a change applies to new sign-ups only — each registration keeps the price it recorded.
  const price = priceFromBody(body.price), earlyPrice = priceFromBody(body.earlyPrice);
  if (price && 'error' in price) return NextResponse.json({ error: price.error }, { status: 400 });
  if (earlyPrice && 'error' in earlyPrice) return NextResponse.json({ error: earlyPrice.error }, { status: 400 });
  const early = earlyPriceRefusal(price ? price.value : stored.price, earlyPrice ? earlyPrice.value : stored.earlyPrice);
  if (early) return NextResponse.json({ error: early }, { status: 400 });
  if (price) patch.price = price.value;
  if (earlyPrice) patch.earlyPrice = earlyPrice.value;
  if ('note' in body) patch.note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 120) : null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    await updateDivision(divisionId, patch);
  } catch (e) {
    return captureAndJson(e, { error: 'Couldn’t save your changes. Try again.' }, 500);
  }
  // New birth years never move a registered child; the record warns how many no longer fit (copy §4 record.born.warn).
  let noLongerFit = 0;
  if (born) {
    const cutoff = cutoffFor(ctx!.org.birthdayCutoffs, stored.season.sport);
    const { data: kids } = await supabaseAdmin.from('league_registrations').select('player_date_of_birth')
      .eq('division_id', divisionId).in('status', ['active', 'pending_review', 'waitlisted']).not('player_date_of_birth', 'is', null);
    noLongerFit = (kids ?? []).filter(k => !bornFitsDate(born.years, cutoff, String(k.player_date_of_birth))).length;
  }
  return NextResponse.json({ ok: true, noLongerFit });
}, { route: '/api/admin/house-league/seasons/[seasonId]/divisions/[divisionId]' });

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ seasonId: string; divisionId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;

  const { seasonId, divisionId } = await params;
  const exists = await verifyDivisionBelongsToOrg(divisionId, seasonId, ctx!.org.id);
  if (!exists) return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', exists.season);
  if (refused) return refused;

  // Guard: refuse if any registrations are assigned to this division
  const { count, error: countErr } = await supabaseAdmin
    .from('league_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('division_id', divisionId);

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'This division has registrations, so it can’t be removed.' },
      { status: 409 },
    );
  }

  await deleteDivision(divisionId);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/divisions/[divisionId]' });
