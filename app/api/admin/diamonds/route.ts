import { NextResponse } from 'next/server';
import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();

  const tournamentId = new URL(req.url).searchParams.get('tournamentId');
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
  const ctx = await getAuthContextWithScope();
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
    } else {
      return NextResponse.json({ error: 'Unsupported diamond action.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
