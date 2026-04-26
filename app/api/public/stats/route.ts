import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournament_id');
    const teamId = searchParams.get('teamId');

    if (teamId) {
      // Fetch games for a specific team
      const { data: games, error } = await supabase
        .from('games')
        .select(`
          id, 
          home_team_id, 
          away_team_id, 
          home_score, 
          away_score, 
          date, 
          time, 
          location, 
          status,
          home_team:home_team_id(name),
          away_team:away_team_id(name)
        `)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) throw error;

      return NextResponse.json({
        games: games.map(g => ({
          ...g,
          home_team_name: (g.home_team as any)?.name || 'TBD',
          away_team_name: (g.away_team as any)?.name || 'TBD'
        }))
      });
    }

    let query = supabase.from('registrations').select('age_group_id, status');
    if (tournamentId) {
      query = query.eq('tournament_id', tournamentId);
    }
    const { data, error } = await query;

    if (error) {
      console.error('Stats query error:', error);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // Count non-rejected registrations per age group
    const counts: Record<string, number> = {};
    for (const reg of data || []) {
      if (reg.status !== 'rejected') {
        counts[reg.age_group_id] = (counts[reg.age_group_id] || 0) + 1;
      }
    }

    return NextResponse.json(counts);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
