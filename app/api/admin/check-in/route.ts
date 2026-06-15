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
import { effectiveFee, markPaidInFullPatch } from '@/lib/mark-paid';

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
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
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
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
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
    players?: Array<{ id?: string; name?: string; jerseyNumber?: string; dateOfBirth?: string; position?: string }>;
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
      // J5-026: stamp the paid-in-full AMOUNTS (deposit_paid/total_paid), not just the raw status —
      // otherwise the coach portal's resolver (paid requires total_paid >= total_fee when a fee
      // schedule exists) still shows "OWED" while this gate says "Paid". Mirrors the bulk path.
      const { data: feeTeam } = await supabaseAdmin
        .from('teams').select('division_id, deposit_paid, total_paid').eq('id', teamId).single();
      const { data: tourn } = await supabaseAdmin
        .from('tournaments').select('fee_schedule_mode, deposit_amount, total_fee_amount').eq('id', tournamentId).single();
      let divFee: { deposit_amount: number | null; total_fee_amount: number | null } | null = null;
      if (tourn?.fee_schedule_mode === 'division' && feeTeam?.division_id) {
        const { data } = await supabaseAdmin
          .from('divisions').select('deposit_amount, total_fee_amount').eq('id', feeTeam.division_id).single();
        divFee = data ?? null;
      }
      const fee = effectiveFee(feeTeam ?? { division_id: null, deposit_paid: null, total_paid: null }, tourn ?? { fee_schedule_mode: null, deposit_amount: null, total_fee_amount: null }, divFee);
      const paidPatch = markPaidInFullPatch(feeTeam ?? { division_id: null, deposit_paid: null, total_paid: null }, fee);
      await supabaseAdmin.from('teams').update({
        ...paidPatch, payment_collected_at: now,
      }).eq('id', teamId);
      break;
    }
    case 'confirm_roster': {
      await supabaseAdmin.from('teams').update({ roster_confirmed_at: now }).eq('id', teamId);
      break;
    }
    case 'save_gate_roster': {
      // J8-010: NON-destructive save. The old path deleted the team's ENTIRE roster and re-inserted
      // every row as source='gate' — wiping coach-submitted players' provenance (source / source_player_id)
      // and dropping any data not carried in the editor. The editor pre-loads the existing roster with
      // each row's `id`, so we diff instead: update rows that have an id (preserving their source),
      // insert id-less rows as gate additions, and delete ONLY the rows the volunteer explicitly removed.
      const players = (body.players ?? [])
        .map(p => ({
          id: typeof p.id === 'string' && p.id ? p.id : null,
          name: (p.name ?? '').trim(),
          jerseyNumber: (p.jerseyNumber ?? '').trim(),
          dateOfBirth: p.dateOfBirth || null,
          position: (p.position ?? '').trim(),
        }))
        .filter(p => p.name.length > 0);

      // Existing rows for this team, to bound updates/deletes to this team (IDOR-safe).
      const { data: existingRows } = await supabaseAdmin
        .from('tournament_roster_players')
        .select('id')
        .eq('team_id', teamId);
      const existingIds = new Set((existingRows ?? []).map(r => r.id as string));

      const keptIds = new Set(players.filter(p => p.id && existingIds.has(p.id)).map(p => p.id as string));

      // Delete only the rows the volunteer removed from the list (never a blanket wipe).
      const removedIds = [...existingIds].filter(id => !keptIds.has(id));
      if (removedIds.length > 0) {
        await supabaseAdmin.from('tournament_roster_players').delete().eq('team_id', teamId).in('id', removedIds);
      }

      // Update existing rows in place — preserves source + source_player_id (coach provenance).
      for (const p of players) {
        if (p.id && existingIds.has(p.id)) {
          await supabaseAdmin.from('tournament_roster_players')
            .update({ name: p.name, jersey_number: p.jerseyNumber || null, date_of_birth: p.dateOfBirth, position: p.position || null })
            .eq('team_id', teamId)
            .eq('id', p.id);
        }
      }

      // Insert genuinely-new (id-less) rows as gate additions.
      const newRows = players.filter(p => !p.id || !existingIds.has(p.id));
      if (newRows.length > 0) {
        await supabaseAdmin.from('tournament_roster_players').insert(newRows.map(p => ({
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
