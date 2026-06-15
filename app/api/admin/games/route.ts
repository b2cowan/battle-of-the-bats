import { createClient } from '@supabase/supabase-js';
import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard, requireTournamentInOrg } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasPlanFeature, requiresTournamentPlusCopy, type PlanFeature } from '@/lib/plan-features';
import { notify } from '@/lib/notify';
import { captureError, withObservability } from '@/lib/observability';
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
  submitForfeit,
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

export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
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
    durationMinutes: g.duration_minutes ?? null,
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
}, { route: '/api/admin/games' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
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
    const { action, games, tournamentId, divisionId, gameIds, autoScheduled } = await req.json();

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

      // Three-state gate:
      //  • playoff games placed/scheduled BY HAND → 'playoff_manual' (free on all tournament plans)
      //  • playoff games produced by the auto-schedule optimizer → 'playoff_generator' (Plus)
      //  • round-robin games (auto-generator) → 'auto_schedule' (Plus)
      // `autoScheduled` is a client-asserted UI-integrity flag (the optimizer ships
      // to every browser, like the round-robin generator) — it gates the honest
      // default path, not a cryptographic boundary.
      const hasPlayoff = games.some((g: any) => g.isPlayoff);
      const requiredFeature: PlanFeature = hasPlayoff
        ? (autoScheduled === true ? 'playoff_generator' : 'playoff_manual')
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
          duration_minutes: typeof g.durationMinutes === 'number' ? g.durationMinutes : null,
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
          // The lane label lives on schedule_facility_lanes (resolved via the id);
          // there is no schedule_facility_lane_label column on games.
          row.schedule_facility_lane_id = g.scheduleFacilityLaneId || null;
        }
        if (g.generatorLocked !== undefined) {
          row.generator_locked = Boolean(g.generatorLocked);
        }
        return row;
      });

      const { error } = await supabase.from('games').insert(rows);
      if (error) throw error;
    }

    // Manual single (or few) game add — FREE for org members. The Plus value is the
    // auto-generator/optimizer, not manual entry; so unlike `bulk-save` this carries
    // no `auto_schedule`/`playoff_generator` gate. (Client writes can't go direct:
    // the `authenticated` role has no INSERT grant on `games`.)
    else if (action === 'create') {
      if (!games || !Array.isArray(games) || games.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid game data' }), { status: 400 });
      }
      const batchTournamentIds = Array.from(new Set(games.map((g: any) => g.tournamentId).filter(Boolean)));
      for (const tid of batchTournamentIds) {
        const denied = scopeGuard(ctx, tid);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, tid);
        if (wrongOrg) return wrongOrg;
        if (await isTournamentLocked(tid)) return tournamentLockedResponse();
      }
      const rows = games.map((g: any) => ({
        tournament_id:    g.tournamentId,
        division_id:      g.divisionId,
        home_team_id:     g.homeTeamId || null,
        away_team_id:     g.awayTeamId || null,
        game_date:        g.date || null,
        game_time:        g.time || null,
        duration_minutes: typeof g.durationMinutes === 'number' ? g.durationMinutes : null,
        location:         g.location ?? null,
        diamond_id:       g.venueId || null,
        venue_facility_id: g.venueFacilityId || null,
        status:           g.status || 'scheduled',
        is_playoff:       g.isPlayoff || false,
        bracket_id:       g.bracketId || null,
        bracket_code:     g.bracketCode || null,
        home_placeholder: g.homePlaceholder || null,
        away_placeholder: g.awayPlaceholder || null,
        home_slot_id:     g.homeSlotId || null,
        away_slot_id:     g.awaySlotId || null,
        notes:            g.notes || null,
      }));
      const { error } = await supabase.from('games').insert(rows);
      if (error) throw error;
    }

    // Delete a single game (any type) — FREE for org members. Used by the row /
    // bracket-view delete and the cascade-clear delete.
    else if (action === 'delete-game') {
      const ids = sanitizeGameIds(gameIds);
      if (!ids || ids.length === 0) {
        return new Response(JSON.stringify({ error: 'Game IDs are required' }), { status: 400 });
      }
      const { data: rows, error: lookupError } = await supabaseAdmin
        .from('games')
        .select('id, tournament_id')
        .in('id', ids);
      if (lookupError) throw lookupError;
      if ((rows?.length ?? 0) !== ids.length) {
        return new Response(JSON.stringify({ error: 'One or more games were not found' }), { status: 404 });
      }
      const tournamentIds = Array.from(new Set((rows ?? []).map(r => r.tournament_id).filter(Boolean)));
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

    // Save a manually-edited bracket as a DIFF — FREE (playoff_manual). Games with a
    // sourceGameId are UPDATED in place (preserving status + scores of played games);
    // games without are INSERTED; existing division playoff games absent from the
    // submission are DELETED only if still replaceable (scheduled + not generator-locked),
    // so a completed/locked game is never silently dropped.
    else if (action === 'save-bracket' && divisionId) {
      if (!games || !Array.isArray(games)) {
        return new Response(JSON.stringify({ error: 'Invalid games data' }), { status: 400 });
      }
      if (!hasPlanFeature(ctx.org.planId, 'playoff_manual')) {
        return planFeatureForbidden('playoff_manual');
      }
      const { data: divRow } = await supabaseAdmin.from('divisions').select('tournament_id').eq('id', divisionId).single();
      if (!divRow) return new Response(JSON.stringify({ error: 'Division not found' }), { status: 404 });
      const denied = scopeGuard(ctx, divRow.tournament_id);
      if (denied) return denied;
      const wrongOrg = await requireTournamentInOrg(ctx, divRow.tournament_id);
      if (wrongOrg) return wrongOrg;
      if (await isTournamentLocked(divRow.tournament_id)) return tournamentLockedResponse();

      const { data: existing, error: exErr } = await supabaseAdmin
        .from('games').select('*').eq('division_id', divisionId).eq('is_playoff', true);
      if (exErr) throw exErr;
      const existingById = new Map((existing ?? []).map(e => [e.id, e]));
      const submittedIds = new Set(games.map((g: any) => g.sourceGameId).filter(Boolean));

      const inserts: Record<string, unknown>[] = [];
      for (const g of games as any[]) {
        // Schedule + structure fields, shared by update + insert. Team ids and
        // duration are NOT in `common`: a played game's resolved teams + scores
        // must be preserved, and per-game duration (e.g. a longer final) isn't
        // canvas-editable so it must not be clobbered on existing games.
        const common: Record<string, unknown> = {
          game_date:        g.date || null,
          game_time:        g.time || null,
          location:         g.location ?? null,
          diamond_id:       g.venueId || null,
          venue_facility_id: g.venueFacilityId || null,
          bracket_id:       g.bracketId || null,
          bracket_code:     g.bracketCode || null,
          home_placeholder: g.homePlaceholder || null,
          away_placeholder: g.awayPlaceholder || null,
        };
        if (g.sourceGameId) {
          // A sourceGameId that no longer exists (deleted/raced, or wrong division)
          // would silently become a phantom insert — reject instead.
          const existingRow = existingById.get(g.sourceGameId);
          if (!existingRow) {
            return new Response(JSON.stringify({ error: 'A game being edited no longer exists. Reload and try again.' }), { status: 409 });
          }
          // Re-wiring a SCHEDULED game (placeholder changed) must clear the old
          // resolved team id, or the bracket would show the stale team until the new
          // feeder completes. Played games keep their teams (handled by not nulling
          // when status !== 'scheduled').
          if (existingRow.status === 'scheduled') {
            if ((existingRow.home_placeholder || null) !== (g.homePlaceholder || null)) common.home_team_id = null;
            if ((existingRow.away_placeholder || null) !== (g.awayPlaceholder || null)) common.away_team_id = null;
          }
          const { error } = await supabase.from('games').update(common).eq('id', g.sourceGameId);
          if (error) throw error;
        } else {
          inserts.push({
            ...common,
            tournament_id:    divRow.tournament_id,
            division_id:      divisionId,
            home_team_id:     g.homeTeamId || null,
            away_team_id:     g.awayTeamId || null,
            duration_minutes: typeof g.durationMinutes === 'number' ? g.durationMinutes : null,
            is_playoff:       true,
            status:           'scheduled',
          });
        }
      }
      if (inserts.length) {
        const { error } = await supabase.from('games').insert(inserts);
        if (error) throw error;
      }
      // Remove games dropped from the canvas — only if still removable (scheduled or
      // cancelled, never generator-locked). A scored game (submitted/completed) is
      // never silently deleted.
      const removableIds = (existing ?? [])
        .filter(e => !submittedIds.has(e.id) && (e.status === 'scheduled' || e.status === 'cancelled') && !e.generator_locked)
        .map(e => e.id);
      if (removableIds.length) {
        const { error } = await supabase.from('games').delete().in('id', removableIds);
        if (error) throw error;
      }
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

      // Replacing a manually-built bracket is part of the free manual-bracket
      // workflow, so this is gated on 'playoff_manual' (not 'playoff_generator').
      if (!hasPlanFeature(ctx.org.planId, 'playoff_manual')) {
        return planFeatureForbidden('playoff_manual');
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

      if (!hasPlanFeature(ctx.org.planId, 'playoff_manual')) {
        return planFeatureForbidden('playoff_manual');
      }

      const { error } = await supabase.from('games').delete().eq('division_id', divisionId).eq('is_playoff', true);
      if (error) throw error;
    }

    else if (action === 'delete-tournament-games' && tournamentId) {
      // Clears the entire schedule for a tournament. Used when switching the
      // tournament format (round robin ↔ bracket-only). Scope + org are already
      // checked above; only allowed while the tournament is in Draft.
      if (await isTournamentLocked(tournamentId)) return tournamentLockedResponse();

      const { data: trow, error: statusErr } = await supabaseAdmin
        .from('tournaments')
        .select('status')
        .eq('id', tournamentId)
        .single();
      if (statusErr) throw statusErr;
      if (trow?.status !== 'draft') {
        return new Response(JSON.stringify({ error: 'The schedule can only be cleared while the tournament is in Draft.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabase.from('games').delete().eq('tournament_id', tournamentId);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Admin Games API Error:', err);
    void captureError(err, { ctx, route: '/api/admin/games', method: 'POST', statusCode: 500 });
    return new Response(JSON.stringify({ error: err.message || 'Unknown server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}, { route: '/api/admin/games' });

export const PATCH = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
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
      if (body.durationMinutes  !== undefined) {
        const n = Number(body.durationMinutes);
        updates.duration_minutes = Number.isInteger(n) && n > 0 && n <= 600 ? n : null;
      }
      if (body.location         !== undefined) updates.location           = body.location;
      if (body.venueId          !== undefined) updates.diamond_id         = body.venueId;
      if (body.venueFacilityId  !== undefined) updates.venue_facility_id  = body.venueFacilityId || null;
      if (body.scheduleFacilityLaneId !== undefined) updates.schedule_facility_lane_id = body.scheduleFacilityLaneId || null;
      if (body.notes            !== undefined) updates.notes              = body.notes;
      if (body.homeTeamId       !== undefined) updates.home_team_id       = body.homeTeamId || null;
      if (body.awayTeamId       !== undefined) updates.away_team_id       = body.awayTeamId || null;
      // Playoff matchup placeholders (Seed #N / Winner <code> / Loser <code>) —
      // mutually exclusive with a real team id on the same side.
      if (body.homePlaceholder  !== undefined) updates.home_placeholder   = body.homePlaceholder || null;
      if (body.awayPlaceholder  !== undefined) updates.away_placeholder   = body.awayPlaceholder || null;
      if (body.bracketCode      !== undefined) updates.bracket_code       = body.bracketCode || null;
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

    // ── forfeit (no-show → present team wins) ────────────────────────────────
    // Rides the SAME submit→finalize approval rule as a score (submitForfeit):
    // a field volunteer's forfeit in an org that requires finalization lands as
    // PENDING (status 'submitted', source 'forfeit') and does NOT advance the
    // bracket until an owner/admin approves it via 'finalize'; an admin's forfeit
    // — or any forfeit where the org doesn't require finalization — is final
    // immediately (status 'forfeit'). 'submit_scores' is enough to PROPOSE; the
    // approval gate is 'finalize' (seal_tournaments). Forfeits count W/L but are
    // excluded from RF/RA/RD in the tie-breaker engine (J1-091).
    else if (action === 'forfeit') {
      if (!hasCapability(ctx.role, ctx.capabilities, 'submit_scores')) return forbidden();
      const winningSide = body.winningSide;
      if (winningSide !== 'home' && winningSide !== 'away') {
        return new Response(JSON.stringify({ error: "winningSide must be 'home' or 'away'" }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const { pending } = await submitForfeit({
        gameId: id,
        game: gameRow,
        winningSide,
        actor: {
          userId: ctx.user.id,
          email: ctx.user.email ?? null,
          role: ctx.role,
          orgRequireScoreFinalization: ctx.org.requireScoreFinalization,
        },
      });
      notify({
        orgId: ctx.org.id,
        tournamentId: gameRow.tournamentId,
        eventType: 'score_submitted',
        title: pending ? 'Forfeit pending approval' : 'Game forfeited',
        body: pending
          ? `${ctx.user.email ?? 'A scorekeeper'} marked a forfeit (${winningSide} team) — needs admin approval`
          : `Marked forfeit by ${ctx.user.email ?? 'an admin'} (${winningSide} team advances)`,
        link: `/${ctx.org.slug}/admin/tournaments/schedule?tournamentId=${gameRow.tournamentId}`,
        excludeUserIds: [ctx.user.id],
      }).catch(console.error);
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
    void captureError(err, { ctx, route: '/api/admin/games', method: 'PATCH', statusCode: 500 });
    return new Response(JSON.stringify({ error: err.message || 'Unknown server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}, { route: '/api/admin/games' });
