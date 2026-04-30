import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Missing environment variables");
    }

    const supabaseAdmin = createClient(url, key);
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournament_id');
    const teamId = searchParams.get('teamId');

    if (teamId) {
      // Fetch games for a specific team
      const { data: games, error } = await supabaseAdmin
        .from('games')
        .select(`
          id, 
          home_team_id, 
          away_team_id, 
          home_score, 
          away_score, 
          game_date, 
          game_time, 
          location, 
          status,
          home_team:teams!games_home_team_id_fkey (name),
          away_team:teams!games_away_team_id_fkey (name)
        `)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order('game_date', { ascending: true })
        .order('game_time', { ascending: true });

      if (error) throw error;

      return NextResponse.json({
        games: games.map(g => ({
          ...g,
          date: g.game_date,
          time: g.game_time,
          home_team_name: (g.home_team as any)?.name || 'TBD',
          away_team_name: (g.away_team as any)?.name || 'TBD'
        }))
      });
    }

    let query = supabaseAdmin.from('teams').select('age_group_id, status');
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
    console.error('Public Stats API Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
