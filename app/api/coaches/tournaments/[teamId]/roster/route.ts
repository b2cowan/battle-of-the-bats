import { NextRequest, NextResponse } from 'next/server';
import { requireCoachRegistrationAccess } from '@/lib/coach-team-guard';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  getBasicCoachTeamPlayers,
  buildTournamentRosterSnapshot,
  type SnapshotPlayerSelection,
} from '@/lib/basic-coach-roster';
import { parseRosterRequirements } from '@/lib/roster-requirements';
import type { TournamentSettings } from '@/lib/types';
import { withObservability } from '@/lib/observability';

/**
 * Coach-side per-event roster SUBMIT API (free-tier Coaches Phase 5j) — the first coach-side WRITE
 * on the tournament surface, so the access model is strict.
 *
 *   GET  → everything the 5k submit UI needs: parsed organizer requirements, the coach's master
 *          roster, the current snapshot rows, and the submit/lock state flags.
 *   POST → copy selected master players into `tournament_roster_players` (source='coach'),
 *          stamping `roster_submitted_at`. Replaces only the coach's OWN prior submission.
 *
 * The `[teamId]` path param is a tournament REGISTRATION id (`teams.id`), NOT a basic_coach_team id,
 * so auth goes through `requireCoachRegistrationAccess` (explicit-link ownership). Every mutation
 * is scoped to that registration (IDOR). Lock semantics mirror the organizer gate: once the
 * organizer has confirmed the roster (`roster_confirmed_at`), the coach is read-only.
 */

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function authError(status: 401 | 403) {
  return status === 401
    ? json({ error: 'Sign in required.' }, 401)
    : json({ error: 'You do not have access to this team.' }, 403);
}

type RouteCtx = { params: Promise<{ teamId: string }> };

type RegistrationRow = {
  id: string;
  tournament_id: string | null;
  status: string | null;
  roster_submitted_at: string | null;
  roster_confirmed_at: string | null;
};

type TournamentRow = {
  id: string;
  org_id: string;
  status: string | null;
  settings: TournamentSettings | null;
};

/** Load the registration + its tournament (context for both verbs). Returns null if either is missing. */
async function loadContext(
  registrationId: string,
): Promise<{ team: RegistrationRow; tournament: TournamentRow } | null> {
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('id, tournament_id, status, roster_submitted_at, roster_confirmed_at')
    .eq('id', registrationId)
    .maybeSingle<RegistrationRow>();
  if (!team || !team.tournament_id) return null;

  const { data: tournament } = await supabaseAdmin
    .from('tournaments')
    .select('id, org_id, status, settings')
    .eq('id', team.tournament_id)
    .maybeSingle<TournamentRow>();
  if (!tournament) return null;

  return { team, tournament };
}

function mapSnapshotRow(row: {
  id: string;
  name: string;
  jersey_number: string | null;
  date_of_birth: string | null;
  position: string | null;
  notes: string | null;
  source: string;
  source_player_id: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    jerseyNumber: row.jersey_number,
    dateOfBirth: row.date_of_birth,
    position: row.position,
    notes: row.notes,
    source: row.source,
    sourcePlayerId: row.source_player_id,
  };
}

export const GET = withObservability(async (_req: NextRequest, { params }: RouteCtx) => {
  try {
    const { teamId } = await params;
    const guard = await requireCoachRegistrationAccess(teamId);
    if (!guard.ok) return authError(guard.status);

    const ctx = await loadContext(teamId);
    if (!ctx) return json({ error: 'Registration not found.' }, 404);
    const { team, tournament } = ctx;

    const requirements = parseRosterRequirements(tournament.settings);
    const masterPlayers = await getBasicCoachTeamPlayers(guard.basicCoachTeamId);

    const { data: snapshotRows } = await supabaseAdmin
      .from('tournament_roster_players')
      .select('id, name, jersey_number, date_of_birth, position, notes, source, source_player_id')
      .eq('team_id', teamId)
      .order('jersey_number', { ascending: true });

    const locked = !!team.roster_confirmed_at;
    const tournamentCompleted = tournament.status === 'completed';
    const accepted = team.status === 'accepted';

    return json({
      ok: true,
      requirements,
      masterPlayers,
      snapshot: (snapshotRows ?? []).map(mapSnapshotRow),
      state: {
        accepted,
        locked,
        tournamentCompleted,
        canSubmit: accepted && !locked && !tournamentCompleted,
        rosterSubmittedAt: team.roster_submitted_at,
        rosterConfirmedAt: team.roster_confirmed_at,
      },
    });
  } catch (error) {
    console.error('[coaches event-roster GET] error:', error);
    return json({ error: 'Could not load your event roster.' }, 500);
  }
}, { route: '/api/coaches/tournaments/[teamId]/roster' });

export const POST = withObservability(async (req: NextRequest, { params }: RouteCtx) => {
  try {
    const { teamId } = await params;
    const guard = await requireCoachRegistrationAccess(teamId);
    if (!guard.ok) return authError(guard.status);

    const ctx = await loadContext(teamId);
    if (!ctx) return json({ error: 'Registration not found.' }, 404);
    const { team, tournament } = ctx;

    // Lock ladder — mirror the organizer gate (app/api/admin/check-in/route.ts).
    if (tournament.status === 'completed') {
      return json({ error: 'This tournament is completed and locked. Contact the organizer to make roster changes.' }, 409);
    }
    if (team.status !== 'accepted') {
      return json({ error: 'Roster submission opens once your team is accepted into the tournament.' }, 409);
    }
    // Coach may freely re-submit while only `roster_submitted_at` is set; locked once the
    // organizer confirms (`roster_confirmed_at`) at check-in (gate confirm_roster / save_gate_roster).
    if (team.roster_confirmed_at) {
      return json({ error: 'The organizer has confirmed your roster. Contact the organizer to make changes.' }, 409);
    }

    const body = (await req.json().catch(() => ({}))) as { players?: unknown; waiverAccepted?: unknown };
    const selections: SnapshotPlayerSelection[] = Array.isArray(body.players)
      ? (body.players as SnapshotPlayerSelection[])
      : [];
    const waiverAccepted = body.waiverAccepted === true;

    const requirements = parseRosterRequirements(tournament.settings);
    const masterPlayers = await getBasicCoachTeamPlayers(guard.basicCoachTeamId);

    const { rows, error } = buildTournamentRosterSnapshot({
      masterPlayers,
      selections,
      requirements: {
        requireDob: requirements.requireDob,
        requireJersey: requirements.requireJersey,
        requireWaiver: requirements.requireWaiver,
        effectiveMinPlayers: requirements.effectiveMinPlayers,
        maxPlayers: requirements.maxPlayers,
      },
      waiverAccepted,
    });
    if (error) return json({ error }, 400);

    const now = new Date().toISOString();

    // Replace ONLY the coach's own prior submission (preserve any organizer/admin-entered rows).
    // Not atomic (mirrors the organizer gate's delete-then-insert); acceptable for a single-coach,
    // single-team submission. The new FK provenance makes a re-submit a clean full replace.
    const { error: delError } = await supabaseAdmin
      .from('tournament_roster_players')
      .delete()
      .eq('team_id', teamId)
      .eq('source', 'coach');
    if (delError) throw delError;

    if (rows.length > 0) {
      const { error: insError } = await supabaseAdmin.from('tournament_roster_players').insert(
        rows.map(r => ({
          org_id: tournament.org_id,
          tournament_id: tournament.id,
          team_id: teamId,
          name: r.name,
          jersey_number: r.jerseyNumber,
          date_of_birth: r.dateOfBirth,
          position: r.position,
          notes: r.notes,
          source: 'coach',
          source_player_id: r.sourcePlayerId,
          created_by_user_id: guard.user.id,
        })),
      );
      if (insError) throw insError;
    }

    // Coach submit stamps roster_submitted_at ONLY — the organizer confirms separately at the gate.
    // Checked (unlike the gate's bare update) so a silent stamp failure can't return a false success
    // with the snapshot written but the checklist never flipping to "Submitted".
    const { error: stampError } = await supabaseAdmin
      .from('teams')
      .update({ roster_submitted_at: now })
      .eq('id', teamId);
    if (stampError) throw stampError;

    return json({ ok: true, submittedAt: now, count: rows.length });
  } catch (error) {
    console.error('[coaches event-roster POST] error:', error);
    return json({ error: 'Could not submit your roster.' }, 500);
  }
}, { route: '/api/coaches/tournaments/[teamId]/roster' });
