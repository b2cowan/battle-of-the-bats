/**
 * Gate / team check-in API (Phase 2).
 *
 * GET  ?orgSlug=&tournamentId=  → board data: accepted teams + their rosters, what each still owes, and whether the
 *                                 event tracks payments at all ("Not tracked here" → the board shows none).
 * POST ?orgSlug=&tournamentId=  → actions: check_in | no_show | undo | mark_paid
 *                                 | confirm_roster | save_gate_roster.
 *
 * Capability: manage_registrations. Writes blocked when the tournament is completed.
 */

import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard, requireTournamentInOrg, type AuthContextWithScope } from '@/lib/api-auth';
import { canGate } from '@/lib/volunteer-jobs';
import { hasPlanFeature } from '@/lib/plan-features';
import { volunteerShut } from '@/lib/invite-only-event';
import { INVITE_REFUSALS } from '@/lib/invite-only-words';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { notify } from '@/lib/notify';
import { checkInUserIds } from '@/lib/notify-recipients';
import { clearSettled } from '@/lib/needs-attention';
import { withObservability } from '@/lib/observability';
import { effectiveFee } from '@/lib/mark-paid';
import { paymentErrorResponse, payTeamDue, removeTeamPayment } from '@/lib/team-payments-server';
import { isOurTournamentTeam, ourTournamentTeamIds } from '@/lib/club-own-tournament-team';
import { tournamentTracksPayments } from '@/lib/tournament-payments-tracked';
import { LOCKED_RESULTS } from '@/lib/tournament-status-words';
import { closeTeamPayPages } from '@/lib/online-pay-pages';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Organizers (manage_registrations) and gate volunteers (check_in_teams) can both run check-in. */
function canCheckIn(ctx: AuthContextWithScope): boolean {
  // The gate's one rule — the same question the gate's wall and every volunteer landing ask.
  return canGate(ctx.role, ctx.capabilities);
}

function lockedResponse() {
  return json({ error: LOCKED_RESULTS }, 409);
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
  if (volunteerShut(ctx.org.planId, ctx.role)) return json({ error: INVITE_REFUSALS.hidden }, 403);

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

  const [{ data: teamRows, error }, { data: tourn, error: tournError }, { data: divFees, error: divError }] = await Promise.all([
    supabaseAdmin
      .from('teams')
      .select('id, name, division_id, status, payment_status, deposit_paid, total_paid, entry_lowered, check_in_status, checked_in_at, checked_in_by_name, roster_submitted_at, roster_confirmed_at, payment_collected_at, check_in_notes')
      .eq('tournament_id', tournamentId)
      .eq('status', 'accepted')
      .order('name', { ascending: true }),
    supabaseAdmin
      .from('tournaments').select('settings, fee_schedule_mode, deposit_amount, total_fee_amount').eq('id', tournamentId).single(),
    supabaseAdmin
      .from('divisions').select('id, deposit_amount, total_fee_amount').eq('tournament_id', tournamentId),
  ]);
  if (error) return json({ error: error.message }, 500);
  if (tournError) return json({ error: tournError.message }, 500);
  if (divError) return json({ error: divError.message }, 500);

  // What a team still owes is the Teams screen's figure: its fee (the division's in division mode, else the
  // event's) less what it has paid — null with no fee. An event that doesn't track payments owes nothing and
  // shows nothing (owner 2026-10-13), whatever amount was typed before the switch.
  const tracksPayments = tournamentTracksPayments(tourn?.settings);
  const divFeeById = new Map((divFees ?? []).map(d => [d.id, d]));
  const owedOf = (t: { division_id: string | null; deposit_paid: number | null; total_paid: number | null; entry_lowered?: number | null }): number | null => {
    if (!tracksPayments || !tourn) return null;
    const fee = effectiveFee(t, tourn, t.division_id ? divFeeById.get(t.division_id) : null);
    if (!fee.totalFeeAmount) return null;
    return Math.max(fee.totalFeeAmount - Number(t.total_paid ?? 0), 0);
  };

  const ourTeams = await ourTournamentTeamIds(tournamentId);
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
    depositPaid: t.deposit_paid ?? null,
    totalPaid: t.total_paid ?? null,
    checkInStatus: t.check_in_status || 'not_arrived',
    checkedInAt: t.checked_in_at,
    checkedInByName: t.checked_in_by_name,
    rosterSubmittedAt: t.roster_submitted_at,
    rosterConfirmedAt: t.roster_confirmed_at,
    paymentCollectedAt: t.payment_collected_at,
    checkInNotes: t.check_in_notes,
    // Our own team owes no entry fee (owner 2026-10-21): nothing owed, and the board says so.
    owed: ourTeams.has(t.id) ? 0 : owedOf(t),
    ...(ourTeams.has(t.id) ? { ourTeam: true } : {}),
    roster: rosterByTeam.get(t.id) ?? [],
  }));

  return json({ teams, tracksPayments });
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
  // Check-in is Tournament Plus (the free tournament tier, R5, B2): the server holds what the screens hide.
  if (!hasPlanFeature(ctx.org.planId, 'team_check_in')) return json({ error: INVITE_REFUSALS.hidden }, 403);
  if (await isTournamentLocked(tournamentId)) return lockedResponse();

  const body = await req.json().catch(() => ({})) as {
    action?: string;
    teamId?: string;
    notes?: string;
    players?: Array<{ id?: string; name?: string; jerseyNumber?: string; dateOfBirth?: string; position?: string }>;
    prior?: { paymentStatus?: string; paymentCollectedAt?: string | null };
    paymentIds?: unknown;
  };
  const { action, teamId } = body;
  if (!action || !teamId) return json({ error: 'Missing action or teamId' }, 400);

  // Confirm the team belongs to this tournament (defence in depth).
  const { data: team } = await supabaseAdmin
    .from('teams').select('id, tournament_id, name').eq('id', teamId).single();
  if (!team || team.tournament_id !== tournamentId) return json({ error: 'Team not found in tournament' }, 404);

  const actorName = (ctx.user.user_metadata?.full_name as string | undefined) || ctx.user.email || 'Staff';
  const now = new Date().toISOString();
  /** The payment a gate "Mark paid" recorded, handed back so the board's undo removes exactly it. */
  let paymentIds: string[] | undefined;

  switch (action) {
    case 'check_in': {
      await supabaseAdmin.from('teams').update({
        check_in_status: 'checked_in', checked_in_at: now,
        checked_in_by_user_id: ctx.user.id, checked_in_by_name: actorName,
      }).eq('id', teamId);
      // A no-show notice for this team leaves Needs attention for everyone (Needs attention clears itself).
      await clearSettled({ orgIds: [ctx.org.id], kinds: ['team_no_show'] });
      break;
    }
    case 'no_show': {
      await supabaseAdmin.from('teams').update({
        check_in_status: 'no_show', checked_in_at: null,
        checked_in_by_user_id: ctx.user.id, checked_in_by_name: actorName,
      }).eq('id', teamId);
      // Tell the people running check-in — a no-show is theirs to act on (forfeit / reschedule). It records its team,
      // so it clears itself when the team checks in after all, the no-show is undone, or the tournament ends (Needs
      // attention clears itself, owner 2026-10-16: with no list it reached every member, coaches included). An empty
      // list must never reach notify(), which would read it as every member.
      const runners = (await checkInUserIds(ctx.org.id, tournamentId).catch(() => [] as string[])).filter(id => id !== ctx.user.id);
      if (runners.length) {
        void notify({
          orgId: ctx.org.id,
          tournamentId,
          eventType: 'team_no_show',
          title: 'Team marked no-show',
          body: `${team.name ?? 'A team'} was marked as a no-show at check-in.`,
          link: `/${ctx.org.slug}/admin/tournaments/check-in`,
          userIds: runners,
          metadata: { teamId, tournamentId },
        });
      }
      break;
    }
    case 'undo': {
      await supabaseAdmin.from('teams').update({
        check_in_status: 'not_arrived', checked_in_at: null,
        checked_in_by_user_id: null, checked_in_by_name: null,
      }).eq('id', teamId);
      await clearSettled({ orgIds: [ctx.org.id], kinds: ['team_no_show'] });
      break;
    }
    case 'mark_paid': {
      // The club's own team owes no fee (Stage 7a); a paid figure on it could not be undone from the Teams screen.
      if (await isOurTournamentTeam(ctx.org.id, teamId)) return json({ error: 'Our team has no entry fee.' }, 409);
      // J5-026: "Mark paid" is the rest of the fee recorded as a payment (dated today, one locked step), so the coach
      // portal's resolver and this gate agree on "Paid" and the ledger gets its one line (mig 345). A team with no fee
      // schedule has nothing to pay: only its status is marked. The gate sends no email or bell (the quiet path, 7a).
      const paid = await payTeamDue({ teamId, actorId: ctx.user.id, scope: 'all' });
      if ('error' in paid) return paymentErrorResponse(paid.error, ctx.org.id);
      // 12d-1 (ask 12): recorded by hand, so any pay page still open closes (no notice on this screen; the drawn three warn).
      if (paid.outcome.recorded) await closeTeamPayPages([teamId], 'check-in');
      if (paid.outcome.noFee) {
        const { error: paidError } = await supabaseAdmin.from('teams').update({
          payment_status: 'paid', payment_collected_at: now, fee_changed_by: ctx.user.id,
        }).eq('id', teamId);
        if (paidError) return json({ error: 'Couldn’t mark that paid. Try again.' }, 409);
      } else if (paid.outcome.recorded && paid.outcome.paymentId) {
        // The board keeps this id so an undo removes exactly this payment (J8-016).
        paymentIds = [paid.outcome.paymentId];
      }
      break;
    }
    case 'unmark_paid': {
      // J8-016: reverse a gate "Mark paid" misclick. The board kept the id of the payment its own press recorded; the undo
      // removes exactly that (its ledger line is voided, who and when kept). A volunteer with check-in rights alone can
      // remove only a payment they recorded themselves on THIS team — never an arbitrary one.
      // The undo is for a misclick on the same shift: payments this person recorded on this team in the last 12 hours. The board
      // sends the ids its own press made; a re-opened sheet has none, and then it is every such payment (never anyone else's).
      const ids = Array.isArray(body.paymentIds) ? body.paymentIds.filter((v): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)).slice(0, 5) : [];
      const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      let mineQuery = supabaseAdmin.from('tournament_team_payments').select('id')
        .eq('team_id', teamId).eq('tournament_id', tournamentId).eq('status', 'posted').eq('created_by', ctx.user.id).gte('created_at', since);
      if (ids.length > 0) mineQuery = mineQuery.in('id', ids);
      const { data: mine } = await mineQuery;
      if (mine && mine.length > 0) {
        for (const row of mine) {
          const removed = await removeTeamPayment({ paymentId: row.id as string, actorId: ctx.user.id });
          if ('error' in removed) return paymentErrorResponse(removed.error, ctx.org.id);
        }
      } else {
        // Nothing of this person's to undo. A team with no payments and a paid STATUS (a team with no fee, marked paid at the
        // gate) goes back to unpaid; the status is never set to paid from here, and no time comes from the browser.
        const { data: nowPaid } = await supabaseAdmin.from('teams').select('total_paid, payment_status').eq('id', teamId).single();
        if (Number(nowPaid?.total_paid ?? 0) > 0) return json({ error: 'There is no payment from this screen to undo.' }, 409);
        const { error: unpaidError } = await supabaseAdmin.from('teams').update({
          payment_status: 'pending', payment_collected_at: null, fee_changed_by: ctx.user.id,
        }).eq('id', teamId);
        if (unpaidError) return json({ error: 'Couldn’t undo that. Try again.' }, 409);
      }
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

  return json(paymentIds ? { ok: true, paymentIds } : { ok: true });
}, { route: '/api/admin/check-in' });
