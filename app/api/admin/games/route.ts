import { createClient } from '@supabase/supabase-js';
import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'manage_schedule_structure')) return forbidden();

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return new Response(JSON.stringify({ error: 'Environment variables missing on server.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(url, key);
    const { action, games, tournamentId, ageGroupId } = await req.json();

    // Scope check: scoped users may only write to their assigned tournaments
    if (tournamentId) {
      const denied = scopeGuard(ctx, tournamentId);
      if (denied) return denied;
    }

    if (action === 'bulk-save') {
      if (!games || !Array.isArray(games)) {
        return new Response(JSON.stringify({ error: 'Invalid games data' }), { status: 400 });
      }

      // Verify every game in the batch belongs to a tournament in scope
      for (const g of games) {
        if (g.tournamentId) {
          const denied = scopeGuard(ctx, g.tournamentId);
          if (denied) return denied;
        }
      }

      const rows = games.map((g: any) => ({
        tournament_id: g.tournamentId,
        age_group_id:  g.ageGroupId,
        home_team_id:  g.homeTeamId,
        away_team_id:  g.awayTeamId,
        game_date:     g.date,
        game_time:     g.time,
        location:      g.location,
        diamond_id:    g.diamondId,
        status:        g.status || 'scheduled',
        notes:         g.notes,
      }));

      const { error } = await supabase.from('games').insert(rows);
      if (error) throw error;
    }

    else if (action === 'delete-division-games' && ageGroupId) {
      // Look up the age_group's tournament to scope-check before deleting
      const { data: ag } = await supabaseAdmin
        .from('age_groups')
        .select('tournament_id')
        .eq('id', ageGroupId)
        .single();

      if (ag) {
        const denied = scopeGuard(ctx, ag.tournament_id);
        if (denied) return denied;
      }

      const { error } = await supabase.from('games').delete().eq('age_group_id', ageGroupId);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Admin Games API Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Unknown server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function PATCH(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return new Response(JSON.stringify({ error: 'Environment variables missing on server.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(url, key);
    const body = await req.json();
    const { action, id } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Game id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Look up the game's tournament once for scope enforcement on all action branches
    const { data: gameRow } = await supabaseAdmin
      .from('games')
      .select('tournament_id')
      .eq('id', id)
      .single();

    if (gameRow) {
      const denied = scopeGuard(ctx, gameRow.tournament_id);
      if (denied) return denied;
    }

    // ── update (time / diamond / location) ───────────────────────────────────
    if (action === 'update') {
      if (!hasCapability(ctx.role, ctx.capabilities, 'update_schedule')) return forbidden();

      const updates: Record<string, unknown> = {};
      if (body.date      !== undefined) updates.game_date  = body.date;
      if (body.time      !== undefined) updates.game_time  = body.time;
      if (body.location  !== undefined) updates.location   = body.location;
      if (body.diamondId !== undefined) updates.diamond_id = body.diamondId;
      if (body.notes     !== undefined) updates.notes      = body.notes;

      const { error } = await supabase.from('games').update(updates).eq('id', id);
      if (error) throw error;
    }

    // ── submit-score ─────────────────────────────────────────────────────────
    else if (action === 'submit-score') {
      if (!hasCapability(ctx.role, ctx.capabilities, 'submit_scores')) return forbidden();

      const homeScore = body.homeScore;
      const awayScore = body.awayScore;

      if (homeScore === undefined || homeScore === null || awayScore === undefined || awayScore === null) {
        return new Response(JSON.stringify({ error: 'homeScore and awayScore are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // When finalization is required, official/staff submissions go to 'submitted';
      // owner/admin go straight to 'completed'.
      const requiresFinalization = ctx.org.requireScoreFinalization ?? false;
      const finalStatus =
        requiresFinalization && (ctx.role === 'official' || ctx.role === 'staff')
          ? 'submitted'
          : 'completed';

      const { error } = await supabase
        .from('games')
        .update({ home_score: homeScore, away_score: awayScore, status: finalStatus })
        .eq('id', id);

      if (error) throw error;
    }

    // ── finalize (submitted → completed, owner/admin only) ───────────────────
    else if (action === 'finalize') {
      if (!hasCapability(ctx.role, ctx.capabilities, 'seal_tournaments')) return forbidden();

      // Only promote games that are actually in 'submitted' state
      const { error } = await supabase
        .from('games')
        .update({ status: 'completed' })
        .eq('id', id)
        .eq('status', 'submitted');

      if (error) throw error;
    }

    else {
      return new Response(JSON.stringify({ error: 'Unknown action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Admin Games PATCH Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Unknown server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
