import { createClient } from '@supabase/supabase-js';
import { getAuthContext, unauthorized } from '@/lib/api-auth';

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return unauthorized();

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return new Response(JSON.stringify({ error: "Environment variables missing on server." }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(url, key);
    const { action, games, tournamentId, ageGroupId } = await req.json();

    if (action === 'bulk-save') {
      if (!games || !Array.isArray(games)) {
        return new Response(JSON.stringify({ error: "Invalid games data" }), { status: 400 });
      }

      // Convert camelCase to snake_case for DB
      const rows = games.map((g: any) => ({
        tournament_id: g.tournamentId,
        age_group_id: g.ageGroupId,
        home_team_id: g.homeTeamId,
        away_team_id: g.awayTeamId,
        game_date: g.date,
        game_time: g.time,
        location: g.location,
        diamond_id: g.diamondId,
        status: g.status || 'scheduled',
        notes: g.notes
      }));

      // Insert all at once
      const { error } = await supabase.from('games').insert(rows);
      if (error) throw error;
    }

    else if (action === 'delete-division-games' && ageGroupId) {
      const { error } = await supabase.from('games').delete().eq('age_group_id', ageGroupId);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Admin Games API Error:', err);
    return new Response(JSON.stringify({ error: err.message || "Unknown server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
