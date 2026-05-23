import { NextResponse } from 'next/server';
import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  const searchParams = new URL(req.url).searchParams;
  const orgSlug = searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();

  const tournamentId = searchParams.get('tournamentId');
  const scope = searchParams.get('scope');
  if (scope === 'org') {
    let tournamentQuery = supabaseAdmin
      .from('tournaments')
      .select('id, name, year')
      .eq('org_id', ctx.org.id)
      .order('year', { ascending: false });

    if (ctx.assignedTournamentIds !== null) {
      if (ctx.assignedTournamentIds.length === 0) return NextResponse.json([]);
      tournamentQuery = tournamentQuery.in('id', ctx.assignedTournamentIds);
    }

    const { data: tournaments, error: tournamentError } = await tournamentQuery;
    if (tournamentError) return NextResponse.json({ error: tournamentError.message }, { status: 500 });

    const tournamentIds = (tournaments ?? []).map(tournament => tournament.id);
    if (tournamentIds.length === 0) return NextResponse.json([]);

    const { data, error } = await supabaseAdmin
      .from('diamonds')
      .select('id, tournament_id, name, address, notes')
      .in('tournament_id', tournamentIds)
      .order('name', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const tournamentById = new Map((tournaments ?? []).map(tournament => [
      tournament.id,
      `${tournament.name} (${tournament.year})`,
    ]));

    return NextResponse.json((data ?? []).map(row => ({
      id: row.id,
      tournamentId: row.tournament_id,
      tournamentName: tournamentById.get(row.tournament_id) ?? null,
      name: row.name,
      address: row.address,
      notes: row.notes,
    })));
  }

  if (!tournamentId) return NextResponse.json([]);

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from('diamonds')
    .select('id, tournament_id, name, address, notes')
    .eq('tournament_id', tournamentId)
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json((data ?? []).map(row => ({
    id: row.id,
    tournamentId: row.tournament_id,
    name: row.name,
    address: row.address,
    notes: row.notes,
  })));
}

export async function POST(req: Request) {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  try {
    const { action, id, data } = await req.json();

    if (action === 'save') {
      const denied = scopeGuard(ctx, data.tournamentId);
      if (denied) return denied;

      const { error } = await supabaseAdmin.from('diamonds').insert({
        tournament_id: data.tournamentId,
        name: data.name,
        address: data.address,
        notes: data.notes,
      });
      if (error) throw error;
    } else if (action === 'update' && id) {
      const { data: diamond } = await supabaseAdmin
        .from('diamonds')
        .select('tournament_id')
        .eq('id', id)
        .single();
      if (diamond) {
        const denied = scopeGuard(ctx, diamond.tournament_id);
        if (denied) return denied;
      }

      const { error } = await supabaseAdmin.from('diamonds').update({
        name: data.name,
        address: data.address,
        notes: data.notes,
      }).eq('id', id);
      if (error) throw error;
    } else if (action === 'delete' && id) {
      const { data: diamond } = await supabaseAdmin
        .from('diamonds')
        .select('tournament_id')
        .eq('id', id)
        .single();
      if (diamond) {
        const denied = scopeGuard(ctx, diamond.tournament_id);
        if (denied) return denied;
      }

      const { error } = await supabaseAdmin
        .from('diamonds')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else {
      return NextResponse.json({ error: 'Unsupported diamond action.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
