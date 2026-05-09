import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLeagueSeasonById, updateDivision, deleteDivision } from '@/lib/db';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  return null;
}

async function verifyDivisionBelongsToOrg(
  divisionId: string,
  seasonId: string,
  orgId: string,
): Promise<boolean> {
  const season = await getLeagueSeasonById(seasonId, orgId);
  if (!season) return false;
  const { data } = await supabaseAdmin
    .from('league_divisions')
    .select('id')
    .eq('id', divisionId)
    .eq('season_id', seasonId)
    .maybeSingle();
  return !!data;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ seasonId: string; divisionId: string }> },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId, divisionId } = await params;
  const exists = await verifyDivisionBelongsToOrg(divisionId, seasonId, ctx!.org.id);
  if (!exists) return NextResponse.json({ error: 'Division not found' }, { status: 404 });

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

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  await updateDivision(divisionId, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ seasonId: string; divisionId: string }> },
) {
  const ctx = await getAuthContextWithRole();
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
}
