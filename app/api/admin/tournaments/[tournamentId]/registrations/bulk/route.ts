import { teamPayNowLink } from '@/lib/online-payment-receipt';
import { NextRequest, NextResponse } from 'next/server';
import {
  acceptanceHtml,
  paymentConfirmationHtml,
  rejectionHtml,
  coachEmailBlock, resolveCoachRecipient, acceptanceFeeLine, coachPortalUrl,
} from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { cancelScheduledEmailForRecipient, COACH_GAME_DAY_REMINDER_EMAIL_KEY } from '@/lib/email-sender';
import { getAuthContextWithScope, forbidden, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { resolveTournamentContactEmail } from '@/lib/db';
import { notify } from '@/lib/notify';
import { withObservability } from '@/lib/observability';
import { paymentErrorResponse, payTeamDue } from '@/lib/team-payments-server';
import { LOCKED_RESULTS } from '@/lib/tournament-status-words';
import { ourTournamentTeamIds } from '@/lib/club-own-tournament-team';
import { tournamentTracksPayments } from '@/lib/tournament-payments-tracked';
import { claimNextOpenSlot } from '@/lib/slot-claim';
import { refreshTournamentChatMembership } from '@/lib/chat-service';
import { notifyTeamCoaches } from '@/lib/team-coach-notices';
import { TEAM_COACH_WORDS } from '@/lib/team-coach-notice-plan';
import { hasPlanFeature } from '@/lib/plan-features';
import { INVITE_REFUSALS } from '@/lib/invite-only-words';

type RouteParams = { params: Promise<{ tournamentId: string }> };

type BulkAction =
  | 'accept'
  | 'reject'
  | 'waitlist'
  | 'mark_deposit_paid'
  | 'mark_paid';

type TeamRow = {
  id: string;
  tournament_id: string;
  division_id: string;
  name: string;
  coach: string | null;
  email: string | null;
  coach_email: string | null;
  status: string | null;
  payment_status: string | null;
  slot_id: string | null;
  waitlist_position: number | null;
  deposit_paid: number | null;
  total_paid: number | null;
};

type TournamentRow = {
  id: string;
  name: string;
  org_id: string | null;
  fee_schedule_mode: string | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  total_fee_amount: number | null;
  total_fee_due_date: string | null;
  settings: Record<string, unknown> | null;
};

type DivisionFeeRow = {
  id: string;
  name: string;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  total_fee_amount: number | null;
  total_fee_due_date: string | null;
};

const BULK_ACTIONS = new Set<BulkAction>([
  'accept',
  'reject',
  'waitlist',
  'mark_deposit_paid',
  'mark_paid',
]);

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

async function trackBulkEvent(input: {
  orgId: string;
  userId: string;
  userEmail?: string | null;
  planId: string;
  tournamentId: string;
  action: BulkAction | string;
  selectedCount: number;
  status: 'attempted' | 'completed' | 'blocked';
}) {
  await writePlatformEvent({
    eventType: 'tournament_registration_operation_used',
    source: 'app',
    orgId: input.orgId,
    actorUserId: input.userId,
    actorEmail: input.userEmail,
    planId: input.planId,
    metadata: {
      feature: 'bulk_registration_actions',
      tournamentId: input.tournamentId,
      action: input.action,
      selectedCount: input.selectedCount,
      status: input.status,
    },
  });
}

async function getNextWaitlistPosition(divisionId: string) {
  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('waitlist_position')
    .eq('division_id', divisionId)
    .not('waitlist_position', 'is', null)
    .order('waitlist_position', { ascending: false })
    .limit(1)
    .maybeSingle<{ waitlist_position: number | null }>();
  if (error) throw error;
  return (data?.waitlist_position ?? 0) + 1;
}

async function releaseTeamSlot(team: TeamRow) {
  if (!team.slot_id) return;
  await supabaseAdmin.from('pool_slots').update({ team_id: null }).eq('id', team.slot_id);
}

async function sendStatusEmails(teams: TeamRow[], action: BulkAction, tournament: TournamentRow, divisions: Map<string, DivisionFeeRow>, orgId: string | null, paymentInstructions?: string, coachSettings?: unknown, contactEmail?: string, ourTeams: ReadonlySet<string> = new Set()) {
  if (action !== 'accept' && action !== 'reject' && action !== 'mark_paid') return;
  const tournamentName = tournament.name;

  for (const team of teams) {
    // Recipient prefers the assigned coach (teams.coach_email), falls back to teams.email; skip
    // only when neither exists. The footer keeps using teams.email (the claim key, never touched).
    const recipient = resolveCoachRecipient(team);
    if (!recipient) continue;
    const div = divisions.get(team.division_id);
    const divisionName = div?.name ?? 'Division';
    const payload = {
      teamName: team.name,
      coachName: team.coach ?? '',
      divisionName,
      tournamentName,
      teamId: team.id,
      coachEmail: team.email ?? undefined,
      // Without this, acceptance/rejection emails fall back to the platform inbox as the "contact"
      // (J5-057) — a coach's reply would never reach the organizer.
      contactEmail,
    };

    if (action === 'accept' && team.status !== 'accepted' && !coachEmailBlock(coachSettings, 'acceptance', team)) {
      // J5-063: state the amount owed (deposit-first) — skipped for an already-paid team. "Not tracked here": no
      // Payment panel at all (no amount, no how-to-pay).
      const paymentsTracked = tournamentTracksPayments(coachSettings);
      // Our own team owes no entry fee (owner 2026-10-21): no amount line either.
      const feeLine = team.payment_status === 'paid' || !paymentsTracked || ourTeams.has(team.id) ? undefined : acceptanceFeeLine({
        feeMode: tournament.fee_schedule_mode,
        tournament: { depositAmount: tournament.deposit_amount, depositDueDate: tournament.deposit_due_date, totalFeeAmount: tournament.total_fee_amount, totalFeeDueDate: tournament.total_fee_due_date },
        division: div ? { depositAmount: div.deposit_amount, depositDueDate: div.deposit_due_date, totalFeeAmount: div.total_fee_amount, totalFeeDueDate: div.total_fee_due_date } : null,
      });
      await sendTransactionalEmail({
        key: 'tournament_registration_accepted',
        to: recipient,
        vars: { coachName: payload.coachName, teamName: payload.teamName, ageGroupName: payload.divisionName, tournamentName: payload.tournamentName, profileUrl: coachPortalUrl({ registrationId: payload.teamId, email: payload.coachEmail }) },
        defaultSubject: `Your Team Has Been Accepted - ${team.name}`,
        // Club Tier Stage 12a: Pay now while the club takes payments online (absent → today's email).
        defaultHtml: acceptanceHtml({ ...payload, paymentInstructions, feeLine, paymentsTracked,
          payUrl: feeLine ? (await teamPayNowLink(team.id))?.url ?? null : null }),
      });
    }
    if (action === 'reject' && team.status !== 'rejected') {
      if (!coachEmailBlock(coachSettings, 'rejection', team)) {
        await sendTransactionalEmail({
          key: 'tournament_registration_rejected',
          to: recipient,
          vars: { coachName: payload.coachName, teamName: payload.teamName, ageGroupName: payload.divisionName, tournamentName: payload.tournamentName },
          defaultSubject: `Registration Update - ${team.name}`,
          defaultHtml: rejectionHtml(payload),
        });
      }
      // 5m: a rejected team is no longer playing — cancel any scheduled game-day reminder.
      if (orgId) await cancelScheduledEmailForRecipient(orgId, COACH_GAME_DAY_REMINDER_EMAIL_KEY, recipient);
    }
    if (action === 'mark_paid' && team.payment_status !== 'paid' && !ourTeams.has(team.id) && !coachEmailBlock(coachSettings, 'payment', team)) {
      await sendTransactionalEmail({
        key: 'tournament_payment_recorded',
        to: recipient,
        vars: { coachName: payload.coachName, teamName: payload.teamName, ageGroupName: payload.divisionName, tournamentName: payload.tournamentName },
        defaultSubject: `Payment Recorded - ${team.name}`,
        defaultHtml: paymentConfirmationHtml(payload),
      });
    }
  }
}

export const POST = withObservability(async (req: NextRequest, { params }: RouteParams) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();
  if (!hasCapability(ctx.role, ctx.capabilities, 'manage_registrations') && !hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) {
    return forbidden();
  }

  const { tournamentId } = await params;
  const body = await req.json() as { action?: unknown; ids?: unknown };
  const action = typeof body.action === 'string' ? body.action : '';
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];

  if (!BULK_ACTIONS.has(action as BulkAction)) return json({ error: 'Choose a valid bulk action.' }, 400);
  if (ids.length === 0) return json({ error: 'Select at least one registration.' }, 400);

  const bulkAction = action as BulkAction;
  // Every bulk action here is a registration or payment action: Tournament Plus (the free tournament tier, M1, B2,
  // 2026-10-16). Select many on an invite-only event offers only Move to pool, which is an ordinary team update.
  if (!hasPlanFeature(ctx.org.planId, 'bulk_registration_actions')) return json({ error: INVITE_REFUSALS.hidden }, 403);
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  await trackBulkEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    tournamentId,
    action: bulkAction,
    selectedCount: ids.length,
    status: 'attempted',
  });

  const [{ data: tournament, error: tournamentError }, { data: teams, error: teamsError }, { data: divisionRows, error: divisionError }] = await Promise.all([
    supabaseAdmin
      .from('tournaments')
      .select('id, name, org_id, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date, settings')
      .eq('id', tournamentId)
      .maybeSingle<TournamentRow>(),
    supabaseAdmin
      .from('teams')
      .select('id, tournament_id, division_id, name, coach, email, coach_email, status, payment_status, slot_id, waitlist_position, deposit_paid, total_paid')
      .in('id', ids),
    supabaseAdmin
      .from('divisions')
      .select('id, name, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date')
      .eq('tournament_id', tournamentId),
  ]);

  if (tournamentError) return json({ error: tournamentError.message }, 500);
  if (teamsError) return json({ error: teamsError.message }, 500);
  if (divisionError) return json({ error: divisionError.message }, 500);
  if (!tournament || tournament.org_id !== ctx.org.id) return forbidden();

  // A finished event takes no new payment: each press now records a dated payment and posts a ledger line.
  if (bulkAction === 'mark_paid' || bulkAction === 'mark_deposit_paid') {
    const { data: state } = await supabaseAdmin.from('tournaments').select('status').eq('id', tournamentId).maybeSingle();
    if (state?.status === 'completed') return json({ error: LOCKED_RESULTS }, 409);
  }

  const selectedTeams = (teams ?? []) as TeamRow[];
  if (selectedTeams.length !== ids.length || selectedTeams.some(team => team.tournament_id !== tournamentId)) {
    return json({ error: 'One or more registrations are outside this tournament.' }, 400);
  }

  const divisions = new Map((divisionRows ?? []).map(group => [group.id, group as DivisionFeeRow]));

  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const dueTeams: TeamRow[] = [];
  let nextWaitlistByGroup = new Map<string, number>();
  // The club's own teams owe no fee: read once for the whole press (it keeps their payments out and their accept email's fee line off).
  const ourTeams = bulkAction === 'accept' || bulkAction === 'mark_paid' || bulkAction === 'mark_deposit_paid'
    ? await ourTournamentTeamIds(tournamentId)
    : new Set<string>();

  for (const team of selectedTeams) {
    const patch: Record<string, unknown> = {};
    if (bulkAction === 'accept') {
      patch.status = 'accepted';
      patch.waitlist_position = null;
    } else if (bulkAction === 'reject') {
      patch.status = 'rejected';
      patch.waitlist_position = null;
      patch.slot_id = null;
      await releaseTeamSlot(team);
    } else if (bulkAction === 'waitlist') {
      let nextPosition = nextWaitlistByGroup.get(team.division_id);
      if (nextPosition == null) nextPosition = await getNextWaitlistPosition(team.division_id);
      patch.status = 'waitlist';
      patch.waitlist_position = nextPosition;
      patch.slot_id = null;
      nextWaitlistByGroup = new Map(nextWaitlistByGroup).set(team.division_id, nextPosition + 1);
      await releaseTeamSlot(team);
    } else if ((bulkAction === 'mark_deposit_paid' || bulkAction === 'mark_paid') && ourTeams.has(team.id)) {
      // The club's own team owes no fee (Stage 7a): a paid figure stamped on it could not be undone from the Teams
      // screen, and would block unlinking it.
      continue;
    } else if (bulkAction === 'mark_deposit_paid' || bulkAction === 'mark_paid') {
      // A payment is a recorded fact (mig 345): the rest of the deposit, or the rest of the fee, dated today — one payment
      // per team in one locked step, so a double press records once. Done below with the other writes.
      dueTeams.push(team);
    }
    if (Object.keys(patch).length > 0) updates.push({ id: team.id, patch });
  }

  for (const update of updates) {
    const { error } = await supabaseAdmin.from('teams').update(update.patch).eq('id', update.id);
    if (error) return json({ error: error.message }, 500);
  }

  // The paid totals the coach's bell names, by team.
  const paidTotals = new Map<string, number>();
  for (const team of dueTeams) {
    const paid = await payTeamDue({ teamId: team.id, actorId: ctx.user.id, scope: bulkAction === 'mark_deposit_paid' ? 'deposit' : 'all' });
    if ('error' in paid) return paymentErrorResponse(paid.error, ctx.org.id);
    if (paid.outcome.noFee && bulkAction === 'mark_paid') {
      // No fee schedule: nothing is owed, so only the status is marked (as before).
      const { error } = await supabaseAdmin.from('teams').update({ payment_status: 'paid', fee_changed_by: ctx.user.id }).eq('id', team.id);
      if (error) return json({ error: error.message }, 500);
    } else {
      paidTotals.set(team.id, paid.outcome.total);
    }
  }

  // J1-066: when a team is accepted into a slot-configured division, drop it into
  // the next open slot so it stays on the board (the board IS the slots). No-op
  // when the division has no empty slot — the team then surfaces in the always-on
  // "Unplaced" attention list rather than vanishing. Sequential so multiple
  // accepts fill consecutive slots.
  if (bulkAction === 'accept') {
    for (const team of selectedTeams) {
      if (team.slot_id) continue;
      await claimNextOpenSlot(team.id, team.division_id);
    }
  }

  const paymentInstructions = typeof tournament.settings?.payment_instructions === 'string'
    ? tournament.settings.payment_instructions
    : undefined;
  // Resolve the organizer's coach-facing contact (respects the show-to-coaches toggle + org-owner
  // fallback) so status emails point coaches at the organizer, not the platform inbox (J5-057).
  const statusFallback = tournament.org_id ? (await getOrgOwnerEmail(tournament.org_id)) ?? null : null;
  const statusContact = (await resolveTournamentContactEmail(tournamentId, statusFallback, 'coach')) ?? undefined;
  await sendStatusEmails(selectedTeams, bulkAction, tournament, divisions, tournament.org_id, paymentInstructions, tournament.settings, statusContact, ourTeams);

  // A free coach's bell (Free coach header parity, 2026-10-13): the moments the status emails mark, for
  // every coach on the team and outside the host's email switches (A5, A6). Awaited; it never throws.
  if (bulkAction === 'accept') {
    await notifyTeamCoaches({
      registrationIds: selectedTeams.filter(t => t.status !== 'accepted').map(t => t.id),
      eventType: 'team_coach_accepted', compose: TEAM_COACH_WORDS.accepted, excludeUserIds: [ctx.user.id],
    });
  } else if (bulkAction === 'reject') {
    await notifyTeamCoaches({
      registrationIds: selectedTeams.filter(t => t.status !== 'rejected').map(t => t.id),
      eventType: 'team_coach_declined', compose: TEAM_COACH_WORDS.declined, excludeUserIds: [ctx.user.id],
    });
  } else if (bulkAction === 'mark_paid' && tournamentTracksPayments(tournament.settings)) {
    // "Not tracked here" records no payment anywhere, the bell included (owner 2026-10-13).
    await notifyTeamCoaches({
      registrationIds: selectedTeams.filter(t => t.payment_status !== 'paid' && !ourTeams.has(t.id)).map(t => t.id),
      eventType: 'team_coach_payment_recorded',
      compose: c => TEAM_COACH_WORDS.paymentRecorded(c, paidTotals.get(c.registrationId)),
      excludeUserIds: [ctx.user.id],
    });
  }

  // Notify org admins of bulk status / payment changes (fire-and-forget, one notification per operation)
  const count = selectedTeams.length;
  const registrationsLink = `/${ctx.org.slug}/admin/tournaments/registrations?tournamentId=${tournamentId}`;
  if (bulkAction === 'accept') {
    notify({
      orgId: ctx.org.id, tournamentId,
      eventType: 'registration_status_changed',
      title: `${count} registration${count === 1 ? '' : 's'} accepted`,
      body: 'Bulk status update',
      link: registrationsLink,
      excludeUserIds: [ctx.user.id],
    }).catch(console.error);
  } else if (bulkAction === 'reject') {
    notify({
      orgId: ctx.org.id, tournamentId,
      eventType: 'registration_status_changed',
      title: `${count} registration${count === 1 ? '' : 's'} declined`,
      body: 'Bulk status update',
      link: registrationsLink,
      excludeUserIds: [ctx.user.id],
    }).catch(console.error);
  } else if (bulkAction === 'waitlist') {
    notify({
      orgId: ctx.org.id, tournamentId,
      eventType: 'registration_status_changed',
      title: `${count} registration${count === 1 ? '' : 's'} moved to waitlist`,
      body: 'Bulk status update',
      link: registrationsLink,
      excludeUserIds: [ctx.user.id],
    }).catch(console.error);
  } else if (bulkAction === 'mark_paid') {
    notify({
      orgId: ctx.org.id, tournamentId,
      eventType: 'payment_received',
      title: `${count} payment${count === 1 ? '' : 's'} recorded`,
      body: 'Bulk payment update',
      link: registrationsLink,
      excludeUserIds: [ctx.user.id],
    }).catch(console.error);
  }

  await trackBulkEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    tournamentId,
    action: bulkAction,
    selectedCount: ids.length,
    status: 'completed',
  });

  // F6 (owner-ratified 2026-07-29) — accepting, rejecting or waitlisting teams changes who belongs
  // in this event's chat rooms. Refresh at the write, rather than leaving membership and the
  // dashboard's "in the chat" count stale until somebody happens to open the admin chat screen.
  //
  // AWAITED, not fire-and-forget. Amplify has no waitUntil bridge wired, so a detached promise can
  // be frozen the instant the response goes out and silently never run — which would leave exactly
  // the staleness this exists to fix, with no error anywhere. `refreshTournamentChatMembership`
  // swallows its own failures by contract, so awaiting it can never fail a registration decision.
  await refreshTournamentChatMembership(tournamentId);

  return json({ success: true, count: selectedTeams.length, action: bulkAction });
}, { route: '/api/admin/tournaments/[tournamentId]/registrations/bulk' });
