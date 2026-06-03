import { createClient } from '@supabase/supabase-js';
import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard, requireTournamentInOrg } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasPlanFeature, requiresTournamentPlusCopy, type PlanFeature } from '@/lib/plan-features';
import { notify } from '@/lib/notify';
import {
  applyDivisionRoundRobinDeleteScope,
  sanitizeGameIds,
  validateReplaceablePlayoffRows,
  validateReplaceableRoundRobinRows,
} from '@/lib/game-delete-policy';
import {
  finalizeTournamentScore,
  loadTournamentScoreGame,
  revertTournamentScore,
  submitTournamentScore,
  TournamentScoringError,
} from '@/lib/tournament-scoring-service';

function tournamentLockedResponse() {
  return new Response(
    JSON.stringify({ error: 'This tournament is completed and locked. Set the status to Active in Event Settings to make changes.' }),
    { status: 409, headers: { 'Content-Type': 'application/json' } },
  );
}

async function isTournamentLocked(tournamentId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('tournaments')
    .select('status')
    .eq('id', tournamentId)
    .single();
  return data?.status === 'completed';
}

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

  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

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
    divisionId: g.division_id,
    homeTeamId: g.home_team_id,
    awayTeamId: g.away_team_id,
    date: g.game_date,
    time: g.game_time,
    location: g.location,
    venueId: g.diamond_id,
    venueFacilityId: g.venue_facility_id ?? null,
    scheduleFacilityLaneId: g.schedule_facility_lane_id ?? null,
    scheduleFacilityLaneLabel: g.schedule_facility_lane_label ?? null,
    homeScore: g.home_score,
    awayScore: g.away_score,
    status: g.status,
    isPlayoff: g.is_playoff,
    generatorLocked: g.generator_locked ?? false,
    bracketId: g.bracket_id,
    bracketCode: g.bracket_code,
    homePlaceholder: g.home_placeholder,
    awayPlaceholder: g.away_placeholder,
    homeSlotId: g.home_slot_id,
    awaySlotId: g.away_slot_id,
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
    const { action, games, tournamentId, divisionId, gameIds } = await req.json();

    // Scope check: scoped users may only write to their assigned tournaments
    if (tournamentId) {
      const denied = scopeGuard(ctx, tournamentId);
      if (denied) return denied;
      const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
      if (wrongOrg) return wrongOrg;
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

      // Deduplicate tournament checks — all games in a batch typically share one tournament.
      const batchTournamentIds = Array.from(new Set(
        games.map((g: any) => g.tournamentId).filter(Boolean)
      ));
      for (const tid of batchTournamentIds) {
        const denied = scopeGuard(ctx, tid);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, tid);
        if (wrongOrg) return wrongOrg;
        if (await isTournamentLocked(tid)) return tournamentLockedResponse();
      }

      const usesFacilityLanes = games.some((g: any) => g.scheduleFacilityLaneId !== undefined);
      const rows = games.map((g: any) => {
        const row: Record<string, unknown> = {
          tournament_id:    g.tournamentId,
          division_id:     g.divisionId,
          home_team_id:     g.homeTeamId   || null,
          away_team_id:     g.awayTeamId   || null,
          game_date:        g.date,
          game_time:        g.time,
          location:         g.location,
          diamond_id:       g.venueId      || null,
          venue_facility_id: g.venueFacilityId || null,
          status:           g.status       || 'scheduled',
          is_playoff:       g.isPlayoff    || false,
          bracket_id:       g.bracketId    || null,
          bracket_code:     g.bracketCode  || null,
          home_placeholder: g.homePlaceholder || null,
          away_placeholder: g.awayPlaceholder || null,
          home_slot_id:     g.homeSlotId   || null,
          away_slot_id:     g.awaySlotId   || null,
          notes:            g.notes        || null,
        };
        if (usesFacilityLanes) {
          row.schedule_facility_lane_id = g.scheduleFacilityLaneId || null;
          row.schedule_facility_lane_label = g.scheduleFacilityLaneLabel || null;
        }
        if (g.generatorLocked !== undefined) {
          row.generator_locked = Boolean(g.generatorLocked);
        }
        return row;
      });

      const { error } = await supabase.from('games').insert(rows);
      if (error) throw error;
    }

    else if (action === 'delete-division-games' && divisionId) {
      // Look up the division's tournament to scope-check before deleting
      const { data: ag } = await supabaseAdmin
        .from('divisions')
        .select('tournament_id')
        .eq('id', divisionId)
        .single();

      if (ag) {
        const denied = scopeGuard(ctx, ag.tournament_id);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, ag.tournament_id);
        if (wrongOrg) return wrongOrg;
        if (await isTournamentLocked(ag.tournament_id)) return tournamentLockedResponse();
      }

      if (!hasPlanFeature(ctx.org.planId, 'auto_schedule')) {
        return planFeatureForbidden('auto_schedule');
      }

      const { error } = await applyDivisionRoundRobinDeleteScope(supabase.from('games').delete(), divisionId);
      if (error) throw error;
    }

    else if (action === 'delete-games') {
      const ids = sanitizeGameIds(gameIds);
      if (!ids) {
        return new Response(JSON.stringify({ error: 'Game IDs are required' }), { status: 400 });
      }

      if (ids.length === 0) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!hasPlanFeature(ctx.org.planId, 'auto_schedule')) {
        return planFeatureForbidden('auto_schedule');
      }

      const { data: rows, error: lookupError } = await supabaseAdmin
        .from('games')
        .select('*')
        .in('id', ids);

      if (lookupError) throw lookupError;
      if ((rows?.length ?? 0) !== ids.length) {
        return new Response(JSON.stringify({ error: 'One or more games were not found' }), { status: 404 });
      }

      const validationError = validateReplaceableRoundRobinRows(rows ?? []);
      if (validationError) {
        return new Response(JSON.stringify({ error: validationError }), { status: 400 });
      }

      if (tournamentId && (rows ?? []).some(row => row.tournament_id !== tournamentId)) {
        return new Response(JSON.stringify({ error: 'Game IDs must belong to the selected tournament' }), { status: 400 });
      }

      const tournamentIds = Array.from(new Set((rows ?? []).map(row => row.tournament_id).filter(Boolean)));
      for (const id of tournamentIds) {
        const denied = scopeGuard(ctx, id);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, id);
        if (wrongOrg) return wrongOrg;
        if (await isTournamentLocked(id)) return tournamentLockedResponse();
      }

      const { error } = await supabase.from('games').delete().in('id', ids);
      if (error) throw error;
    }

    else if (action === 'delete-playoff-games') {
      const ids = sanitizeGameIds(gameIds);
      if (!ids) {
        return new Response(JSON.stringify({ error: 'Game IDs are required' }), { status: 400 });
      }

      if (ids.length === 0) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!hasPlanFeature(ctx.org.planId, 'playoff_generator')) {
        return planFeatureForbidden('playoff_generator');
      }

      const { data: rows, error: lookupError } = await supabaseAdmin
        .from('games')
        .select('*')
        .in('id', ids);

      if (lookupError) throw lookupError;
      if ((rows?.length ?? 0) !== ids.length) {
        return new Response(JSON.stringify({ error: 'One or more playoff games were not found' }), { status: 404 });
      }

      const validationError = validateReplaceablePlayoffRows(rows ?? []);
      if (validationError) {
        return new Response(JSON.stringify({ error: validationError }), { status: 400 });
      }

      if (tournamentId && (rows ?? []).some(row => row.tournament_id !== tournamentId)) {
        return new Response(JSON.stringify({ error: 'Game IDs must belong to the selected tournament' }), { status: 400 });
      }

      const tournamentIds = Array.from(new Set((rows ?? []).map(row => row.tournament_id).filter(Boolean)));
      for (const id of tournamentIds) {
        const denied = scopeGuard(ctx, id);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, id);
        if (wrongOrg) return wrongOrg;
        if (await isTournamentLocked(id)) return tournamentLockedResponse();
      }

      const { error } = await supabase.from('games').delete().in('id', ids);
      if (error) throw error;
    }

    else if (action === 'delete-division-playoff-games' && divisionId) {
      const { data: ag } = await supabaseAdmin
        .from('divisions')
        .select('tournament_id')
        .eq('id', divisionId)
        .single();

      if (ag) {
        const denied = scopeGuard(ctx, ag.tournament_id);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, ag.tournament_id);
        if (wrongOrg) return wrongOrg;
        if (await isTournamentLocked(ag.tournament_id)) return tournamentLockedResponse();
      }

      if (!hasPlanFeature(ctx.org.planId, 'playoff_generator')) {
        return planFeatureForbidden('playoff_generator');
      }

      const { error } = await supabase.from('games').delete().eq('division_id', divisionId).eq('is_playoff', true);
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

    const wrongOrg = await requireTournamentInOrg(ctx, gameRow.tournamentId);
    if (wrongOrg) return wrongOrg;

    if (await isTournamentLocked(gameRow.tournamentId)) return tournamentLockedResponse();

    // ── update (time / diamond / location) ───────────────────────────────────
    if (action === 'update') {
      if (!hasCapability(ctx.role, ctx.capabilities, 'update_schedule')) return forbidden();

      const updates: Record<string, unknown> = {};
      if (body.date             !== undefined) updates.game_date          = body.date;
      if (body.time             !== undefined) updates.game_time          = body.time;
      if (body.location         !== undefined) updates.location           = body.location;
      if (body.venueId          !== undefined) updates.diamond_id         = body.venueId;
      if (body.venueFacilityId  !== undefined) updates.venue_facility_id  = body.venueFacilityId || null;
      if (body.scheduleFacilityLaneId !== undefined) updates.schedule_facility_lane_id = body.scheduleFacilityLaneId || null;
      if (body.notes            !== undefined) updates.notes              = body.notes;
      if (body.homeTeamId       !== undefined) updates.home_team_id       = body.homeTeamId || null;
      if (body.awayTeamId       !== undefined) updates.away_team_id       = body.awayTeamId || null;
      if (body.generatorLocked  !== undefined) updates.generator_locked   = Boolean(body.generatorLocked);

      const { error } = await supabase.from('games').update(updates).eq('id', id);
      if (error) throw error;
    }

    // ── cancel (scheduled → cancelled) ───────────────────────────────────────
    else if (action === 'cancel') {
      if (!hasCapability(ctx.role, ctx.capabilities, 'update_schedule')) return forbidden();
      const { error } = await supabase.from('games').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
    }

    // ── revert-to-scheduled (cancelled → scheduled) ──────────────────────────
    else if (action === 'revert-to-scheduled') {
      if (!hasCapability(ctx.role, ctx.capabilities, 'update_schedule')) return forbidden();
      const { error } = await supabase.from('games').update({ status: 'scheduled' }).eq('id', id);
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
      // Notify org admins of submitted score (fire-and-forget)
      notify({
        orgId: ctx.org.id,
        tournamentId: gameRow.tournamentId,
        eventType: 'score_submitted',
        title: 'Score submitted',
        body: `Submitted by ${ctx.user.email ?? 'an admin'}`,
        link: `/${ctx.org.slug}/admin/tournaments/schedule?tournamentId=${gameRow.tournamentId}`,
        excludeUserIds: [ctx.user.id],
      }).catch(console.error);
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
