import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLeagueSeasonById, updateDivision, deleteDivision } from '@/lib/db';
import { withObservability, captureAndJson } from '@/lib/observability';
import type { BornYears } from '@/lib/born-years';
import { bornYearsFromBody } from '@/lib/program-year-patch';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  return null;
}

/** The division's stored birth years when it belongs to the org's season, else null (the PATCH keeps a side the body leaves out). */
async function verifyDivisionBelongsToOrg(
  divisionId: string,
  seasonId: string,
  orgId: string,
): Promise<{ born: BornYears } | null> {
  const season = await getLeagueSeasonById(seasonId, orgId);
  if (!season) return null;
  const { data } = await supabaseAdmin
    .from('league_divisions')
    .select('id, born_from_year, born_to_year')
    .eq('id', divisionId)
    .eq('season_id', seasonId)
    .maybeSingle();
  if (!data) return null;
  return { born: { from: (data.born_from_year as number | null) ?? null, to: (data.born_to_year as number | null) ?? null } };
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string; divisionId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId, divisionId } = await params;
  const stored = await verifyDivisionBelongsToOrg(divisionId, seasonId, ctx!.org.id);
  if (!stored) return NextResponse.json({ error: 'Division not found' }, { status: 404 });

  const body = await req.json();
  const patch: Parameters<typeof updateDivision>[1] = {};

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name || name.length > 100) {
      return NextResponse.json({ error: 'name must be 1–100 characters' }, { status: 400 });
    }
    patch.name = name;
  }

  if ('capacity' in body) {
    patch.capacity = typeof body.capacity === 'number' && body.capacity > 0 ? body.capacity : null;
  }

  // Birth years travel as a pair; a side the body leaves out keeps what the division has (the season PATCH's rule). The
  // window always sends both, and an explicit null/empty is "no limit on that side".
  const born = bornYearsFromBody(body, stored.born, new Date().getFullYear());
  if (born && 'error' in born) return NextResponse.json({ error: born.error }, { status: 400 });
  if (born) {
    patch.bornFromYear = born.years.from;
    patch.bornToYear = born.years.to;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    await updateDivision(divisionId, patch);
  } catch (e) {
    return captureAndJson(e, { error: 'Couldn’t save your changes. Try again.' }, 500);
  }
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/divisions/[divisionId]' });

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ seasonId: string; divisionId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId, divisionId } = await params;
  const exists = await verifyDivisionBelongsToOrg(divisionId, seasonId, ctx!.org.id);
  if (!exists) return NextResponse.json({ error: 'Division not found' }, { status: 404 });

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
      { error: 'Cannot delete a division that has registrations assigned to it' },
      { status: 409 },
    );
  }

  await deleteDivision(divisionId);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/divisions/[divisionId]' });
