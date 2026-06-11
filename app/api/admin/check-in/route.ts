/**
 * Gate / team check-in API (Phase 2).
 *
 * GET  ?orgSlug=&tournamentId=  → board data: accepted teams + their rosters.
 * POST ?orgSlug=&tournamentId=  → actions: check_in | no_show | undo | mark_paid
 *                                 | confirm_roster | save_gate_roster.
 *
 * Capability: manage_registrations. Writes blocked when the tournament is completed.
 */

import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard, requireTournamentInOrg, type AuthContextWithScope } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { notify } from '@/lib/notify';
import { withObservability } from '@/lib/observability';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Organizers (manage_registrations) and gate volunteers (check_in_teams) can both run check-in. */
function canCheckIn(ctx: AuthContextWithScope): boolean {
  return hasCapability(ctx.role, ctx.capabilities, 'manage_registrations')
    || hasCapability(ctx.role, ctx.capabilities, 'check_in_teams');
}

function lockedResponse() {
  return json({ error: 'This tournament is completed and locked. Set it back to Active in Event Settings to make changes.' }, 409);
}

async function isTournamentLocked(tournamentId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('tournaments').select('status').eq('id', tournamentId).single();
  return data?.status === 'completed';
}

function mapRoster(row: any) {
  return {
    id: row.id,
    teamId: row.team_id,
    tournamentId: row.tournament_id,
    orgId: row.org_id,
    name: row.name,
    jerseyNumber: row.jersey_number ?? null,
    dateOfBirth: row.date_of_birth ?? null,
    position: row.position ?? null,
    notes: row.notes ?? null,
    source: row.source,
  };
}

export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();
  if (!canCheckIn(ctx)) return forbidden();

  const tournamentId = url.searchParams.get('tournamentId');
  if (!tournamentId) {
    // Tournament list for the gate-volunteer picker (org's non-archived, scope-respecting).
    const { data } = await supabaseAdmin
      .from('tournaments')
      .select('id, name, status, start_date, end_date')
      .eq('org_id', ctx.org.id)
      .neq('status', 'archived')
      .order('start_date', { ascending: false, nullsFirst: false });
    let list = data ?? [];
    if (ctx.assignedTournamentIds) list = list.filter(t => ctx.assignedTournamentIds!.includes(t.id));
    return json({ tournaments: list.map(t => ({ id: t.id, name: t.name, status: t.status, startDate: t.start_date, endDate: t.end_date })) });
  }

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;
  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

  const { data: teamRows, error } = await supabaseAdmin
    .from('teams')
    .select('id, name, division_id, status, payment_status, check_in_status, checked_in_at, checked_in_by_name, roster_submitted_at, roster_confirmed_at, payment_collected_at, check_in_notes')
    .eq('tournament_id', tournamentId)
    .eq('status', 'accepted')
    .order('name', { ascending: true });
  if (error) return json({ error: error.message }, 500);

  const teamIds = (teamRows ?? []).map(t => t.id);
  const rosterByTeam = new Map<string, any[]>();
  if (teamIds.length > 0) {
    const { data: rosterRows } = await supabaseAdmin
      .from('tournament_roster_players')
      .select('*')
      .in('team_id', teamIds)
      .order('jersey_number', { ascending: true });
    for (const r of rosterRows ?? []) {
      const list = rosterByTeam.get(r.team_id) ?? [];
      list.push(mapRoster(r));
      rosterByTeam.set(r.team_id, list);
    }
  }

  const teams = (teamRows ?? []).map(t => ({
    id: t.id,
    name: t.name,
    divisionId: t.division_id,
    status: t.status,
    paymentStatus: t.payment_status || 'pending',
    checkInStatus: t.check_in_status || 'not_arrived',
    checkedInAt: t.checked_in_at,
    checkedInByName: t.checked_in_by_name,
    rosterSubmittedAt: t.roster_submitted_at,
    rosterConfirmedAt: t.roster_confirmed_at,
    paymentCollectedAt: t.payment_collected_at,
    checkInNotes: t.check_in_notes,
    roster: rosterByTeam.get(t.id) ?? [],
  }));

  return json({ teams });
}, { route: '/api/admin/check-in' });

export const POST = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();

  const tournamentId = url.searchParams.get('tournamentId');
  if (!tournamentId) return json({ error: 'Missing tournamentId' }, 400);

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;
  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;
  if (!canCheckIn(ctx)) return forbidden();
  if (await isTournamentLocked(tournamentId)) return lockedResponse();

  const body = await req.json().catch(() => ({})) as {
    action?: string;
    teamId?: string;
    notes?: string;
    players?: Array<{ name?: string; jerseyNumber?: string; dateOfBirth?: string; position?: string }>;
  };
  const { action, teamId } = body;
  if (!action || !teamId) return json({ error: 'Missing action or teamId' }, 400);

  // Confirm the team belongs to this tournament (defence in depth).
  const { data: team } = await supabaseAdmin
    .from('teams').select('id, tournament_id, name').eq('id', teamId).single();
  if (!team || team.tournament_id !== tournamentId) return json({ error: 'Team not found in tournament' }, 404);

  const actorName = (ctx.user.user_metadata?.full_name as string | undefined) || ctx.user.email || 'Staff';
  const now = new Date().toISOString();

  switch (action) {
    case 'check_in': {
      await supabaseAdmin.from('teams').update({
        check_in_status: 'checked_in', checked_in_at: now,
        checked_in_by_user_id: ctx.user.id, checked_in_by_name: actorName,
      }).eq('id', teamId);
      break;
    }
    case 'no_show': {
      await supabaseAdmin.from('teams').update({
        check_in_status: 'no_show', checked_in_at: null,
        checked_in_by_user_id: ctx.user.id, checked_in_by_name: actorName,
      }).eq('id', teamId);
      // Notify the org — a no-show is actionable (forfeit / reschedule).
      void notify({
        orgId: ctx.org.id,
        tournamentId,
        eventType: 'team_no_show',
        title: 'Team marked no-show',
        body: `${team.name ?? 'A team'} was marked as a no-show at check-in.`,
        link: `/${ctx.org.slug}/admin/tournaments/check-in`,
        excludeUserIds: [ctx.user.id],
      });
      break;
    }
    case 'undo': {
      await supabaseAdmin.from('teams').update({
        check_in_status: 'not_arrived', checked_in_at: null,
        checked_in_by_user_id: null, checked_in_by_name: null,
      }).eq('id', teamId);
      break;
    }
    case 'mark_paid': {
      await supabaseAdmin.from('teams').update({
        payment_status: 'paid', payment_collected_at: now,
      }).eq('id', teamId);
      break;
    }
    case 'confirm_roster': {
      await supabaseAdmin.from('teams').update({ roster_confirmed_at: now }).eq('id', teamId);
      break;
    }
    case 'save_gate_roster': {
      const players = (body.players ?? [])
        .map(p => ({ name: (p.name ?? '').trim(), jerseyNumber: (p.jerseyNumber ?? '').trim(), dateOfBirth: p.dateOfBirth || null, position: (p.position ?? '').trim() }))
        .filter(p => p.name.length > 0);
      // Replace the team's roster with the gate-captured list.
      await supabaseAdmin.from('tournament_roster_players').delete().eq('team_id', teamId);
      if (players.length > 0) {
        await supabaseAdmin.from('tournament_roster_players').insert(players.map(p => ({
          org_id: ctx.org.id,
          tournament_id: tournamentId,
          team_id: teamId,
          name: p.name,
          jersey_number: p.jerseyNumber || null,
          date_of_birth: p.dateOfBirth,
          position: p.position || null,
          source: 'gate',
          created_by_user_id: ctx.user.id,
        })));
      }
      await supabaseAdmin.from('teams').update({
        roster_submitted_at: now, roster_confirmed_at: now,
      }).eq('id', teamId);
      break;
    }
    case 'save_notes': {
      await supabaseAdmin.from('teams').update({ check_in_notes: (body.notes ?? '').trim() || null }).eq('id', teamId);
      break;
    }
    default:
      return json({ error: `Unknown action: ${action}` }, 400);
  }

  return json({ ok: true });
}, { route: '/api/admin/check-in' });
