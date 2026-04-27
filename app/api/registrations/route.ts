import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Fetch all needed data separately since foreign key relationships might not be defined
    const [teamsRes, groupsRes, tournsRes] = await Promise.all([
      supabase.from('teams').select('*').order('registered_at', { ascending: false }),
      supabase.from('age_groups').select('id, name'),
      supabase.from('tournaments').select('id, name')
    ]);

    if (teamsRes.error) throw teamsRes.error;
    
    const groupsMap = new Map((groupsRes.data || []).map(g => [g.id, g.name]));
    const tournsMap = new Map((tournsRes.data || []).map(t => [t.id, t.name]));

    // Flatten names for the frontend
    const flattened = teamsRes.data?.map((r: any) => ({
      ...r,
      team_name: r.name,
      coach_name: r.coach,
      age_group_name: groupsMap.get(r.age_group_id) || 'Unknown Division',
      tournament_name: tournsMap.get(r.tournament_id) || 'Unknown Tournament'
    }));

    return NextResponse.json(flattened);
  } catch (err: any) {
    console.error('Registrations Route Catch:', err);
    return NextResponse.json({ 
      error: 'Exception thrown', 
      message: err?.message,
      stack: err?.stack 
    }, { status: 500 });
  }
}
