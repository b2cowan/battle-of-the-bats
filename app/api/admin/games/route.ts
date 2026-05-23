import { createClient } from '@supabase/supabase-js';
import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasPlanFeature, requiresTournamentPlusCopy, type PlanFeature } from '@/lib/plan-features';
import {
  finalizeTournamentScore,
  loadTournamentScoreGame,
  revertTournamentScore,
  submitTournamentScore,
  TournamentScoringError,
} from '@/lib/tournament-scoring-service';

function planFeatureForbidden(feature: PlanFeature) {
  return new Response(JSON.stringify({ error: requiresTournamentPlusCopy(feature) }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

function scoringErrorResponse(error: TournamentScoringError) {
  return new Response(JSON.stringify({ error: error.message }), {
    status: error.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();

  const tournamentId = url.searchParams.get('tournamentId');
  if (!tournamentId) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from('games')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('game_date', { ascending: true })
    .order('game_time', { ascending: true });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const games = (data ?? []).map((g: any) => ({
    id: g.id,
    tournamentId: g.tournament_id,
    ageGroupId: g.age_group_id,
    homeTeamId: g.home_team_id,
    awayTeamId: g.away_team_id,
    date: g.game_date,
    time: g.game_time,
    location: g.location,
    diamondId: g.diamond_id,
    homeScore: g.home_score,
    awayScore: g.away_score,
    status: g.status,
    isPlayoff: g.is_playoff,
    bracketId: g.bracket_id,
    bracketCode: g.bracket_code,
    homePlaceholder: g.home_placeholder,
    awayPlaceholder: g.away_placeholder,
    scoreSubmittedByUserId: g.score_submitted_by_user_id,
    scoreSubmittedByEmail: g.score_submitted_by_email,
    scoreSubmittedAt: g.score_submitted_at,
    scoreSubmissionSource: g.score_submission_source,
    notes: g.notes,
  }));

  return new Response(JSON.stringify(games), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req: Request) {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
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

      const requiredFeature: PlanFeature = games.some((g: any) => g.isPlayoff)
        ? 'playoff_generator'
        : 'auto_schedule';
      if (!hasPlanFeature(ctx.org.planId, requiredFeature)) {
        return planFeatureForbidden(requiredFeature);
      }

      // Verify every game in the batch belongs to a tournament in scope
      for (const g of games) {
        if (g.tournamentId) {
          const denied = scopeGuard(ctx, g.tournamentId);
          if (denied) return denied;
        }
      }

      const rows = games.map((g: any) => ({
        tournament_id:    g.tournamentId,
        age_group_id:     g.ageGroupId,
        home_team_id:     g.homeTeamId   || null,
        away_team_id:     g.awayTeamId   || null,
        game_date:        g.date,
        game_time:        g.time,
        location:         g.location,
        diamond_id:       g.diamondId    || null,
        status:           g.status       || 'scheduled',
        is_playoff:       g.isPlayoff    || false,
        bracket_id:       g.bracketId    || null,
        bracket_code:     g.bracketCode  || null,
        home_placeholder: g.homePlaceholder || null,
        away_placeholder: g.awayPlaceholder || null,
        home_slot_id:     g.homeSlotId   || null,
        away_slot_id:     g.awaySlotId   || null,
        notes:            g.notes        || null,
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

      if (!hasPlanFeature(ctx.org.planId, 'auto_schedule')) {
        return planFeatureForbidden('auto_schedule');
      }

      const { error } = await supabase.from('games').delete().eq('age_group_id', ageGroupId);
      if (error) throw error;
    }

    else if (action === 'delete-division-playoff-games' && ageGroupId) {
      const { data: ag } = await supabaseAdmin
        .from('age_groups')
        .select('tournament_id')
        .eq('id', ageGroupId)
        .single();

      if (ag) {
        const denied = scopeGuard(ctx, ag.tournament_id);
        if (denied) return denied;
      }

      if (!hasPlanFeature(ctx.org.planId, 'playoff_generator')) {
        return planFeatureForbidden('playoff_generator');
      }

      const { error } = await supabase.from('games').delete().eq('age_group_id', ageGroupId).eq('is_playoff', true);
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
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
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

    const gameRow = await loadTournamentScoreGame(id);

    const denied = scopeGuard(ctx, gameRow.tournamentId);
    if (denied) return denied;

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
      await submitTournamentScore({
        gameId: id,
        game: gameRow,
        homeScore: body.homeScore,
        awayScore: body.awayScore,
        actor: {
          userId: ctx.user.id,
          email: ctx.user.email ?? null,
          role: ctx.role,
          orgRequireScoreFinalization: ctx.org.requireScoreFinalization,
        },
        source: 'admin_results',
        allowFinalizedEdit: true,
      });
    }

    // ── finalize (submitted → completed, owner/admin only) ───────────────────
    else if (action === 'finalize') {
      if (!hasCapability(ctx.role, ctx.capabilities, 'seal_tournaments')) return forbidden();
      await finalizeTournamentScore(id, gameRow);
    }

    // Revert a scored game back to scheduled and clear the recorded result.
    else if (action === 'revert-score') {
      if (!hasCapability(ctx.role, ctx.capabilities, 'submit_scores')) return forbidden();
      await revertTournamentScore(id);
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
    if (err instanceof TournamentScoringError) return scoringErrorResponse(err);
    console.error('Admin Games PATCH Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Unknown server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
