import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthContext, unauthorized } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return unauthorized();

  try {
    // Get all tournament IDs belonging to this org
    const { data: orgTournaments } = await supabaseAdmin
      .from('tournaments')
      .select('id')
      .eq('organization_id', auth.org.id);

    const tournamentIds = (orgTournaments ?? []).map((t: { id: string }) => t.id);

    if (tournamentIds.length === 0) {
      return NextResponse.json([]);
    }

    const [teamsRes, groupsRes, tournsRes] = await Promise.all([
      supabaseAdmin
        .from('teams')
        .select('*')
        .in('tournament_id', tournamentIds)
        .order('registered_at', { ascending: false }),
      supabaseAdmin.from('age_groups').select('id, name'),
      supabaseAdmin.from('tournaments').select('id, name'),
    ]);

    if (teamsRes.error) throw teamsRes.error;

    const groupsMap = new Map((groupsRes.data || []).map((g: { id: string; name: string }) => [g.id, g.name]));
    const tournsMap = new Map((tournsRes.data || []).map((t: { id: string; name: string }) => [t.id, t.name]));

    const flattened = teamsRes.data?.map((r: any) => ({
      ...r,
      team_name: r.name,
      coach_name: r.coach,
      age_group_name: groupsMap.get(r.age_group_id) || 'Unknown Division',
      tournament_name: tournsMap.get(r.tournament_id) || 'Unknown Tournament',
    }));

    return NextResponse.json(flattened);
  } catch (err: any) {
    console.error('Registrations Route Error:', err);
    return NextResponse.json({ error: 'Server error', message: err?.message }, { status: 500 });
  }
}
