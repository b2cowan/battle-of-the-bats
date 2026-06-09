import { NextRequest, NextResponse } from 'next/server';
import {
  acceptanceHtml,
  paymentConfirmationHtml,
  rejectionHtml,
  sendEmail,
  coachEmailEnabled,
} from '@/lib/email';
import { getAuthContextWithScope, forbidden, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { notify } from '@/lib/notify';

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
  total_fee_amount: number | null;
  settings: Record<string, unknown> | null;
};

type DivisionFeeRow = {
  id: string;
  name: string;
  deposit_amount: number | null;
  total_fee_amount: number | null;
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

function effectiveFee(
  team: TeamRow,
  tournament: TournamentRow,
  divisions: Map<string, DivisionFeeRow>,
) {
  const group = divisions.get(team.division_id);
  if (tournament.fee_schedule_mode === 'division' && group?.total_fee_amount != null) {
    return {
      depositAmount: group.deposit_amount ?? null,
      totalFeeAmount: group.total_fee_amount ?? null,
    };
  }
  return {
    depositAmount: tournament.deposit_amount ?? null,
    totalFeeAmount: tournament.total_fee_amount ?? null,
  };
}

async function releaseTeamSlot(team: TeamRow) {
  if (!team.slot_id) return;
  await supabaseAdmin.from('pool_slots').update({ team_id: null }).eq('id', team.slot_id);
}

async function sendStatusEmails(teams: TeamRow[], action: BulkAction, tournamentName: string, divisions: Map<string, DivisionFeeRow>, paymentInstructions?: string, coachSettings?: unknown) {
  if (action !== 'accept' && action !== 'reject' && action !== 'mark_paid') return;

  for (const team of teams) {
    if (!team.email) continue;
    const divisionName = divisions.get(team.division_id)?.name ?? 'Division';
    const payload = {
      teamName: team.name,
      coachName: team.coach ?? '',
      divisionName,
      tournamentName,
      teamId: team.id,
    };

    if (action === 'accept' && team.status !== 'accepted' && coachEmailEnabled(coachSettings, 'acceptance')) {
      await sendEmail(team.email, `Your Team Has Been Accepted - ${team.name}`, acceptanceHtml({ ...payload, paymentInstructions }));
    }
    if (action === 'reject' && team.status !== 'rejected' && coachEmailEnabled(coachSettings, 'rejection')) {
      await sendEmail(team.email, `Registration Update - ${team.name}`, rejectionHtml(payload));
    }
    if (action === 'mark_paid' && team.payment_status !== 'paid' && coachEmailEnabled(coachSettings, 'payment')) {
      await sendEmail(team.email, `Payment Recorded - ${team.name}`, paymentConfirmationHtml(payload));
    }
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
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
      .select('id, name, org_id, fee_schedule_mode, deposit_amount, total_fee_amount, settings')
      .eq('id', tournamentId)
      .maybeSingle<TournamentRow>(),
    supabaseAdmin
      .from('teams')
      .select('id, tournament_id, division_id, name, coach, email, status, payment_status, slot_id, waitlist_position, deposit_paid, total_paid')
      .in('id', ids),
    supabaseAdmin
      .from('divisions')
      .select('id, name, deposit_amount, total_fee_amount')
      .eq('tournament_id', tournamentId),
  ]);

  if (tournamentError) return json({ error: tournamentError.message }, 500);
  if (teamsError) return json({ error: teamsError.message }, 500);
  if (divisionError) return json({ error: divisionError.message }, 500);
  if (!tournament || tournament.org_id !== ctx.org.id) return forbidden();

  const selectedTeams = (teams ?? []) as TeamRow[];
  if (selectedTeams.length !== ids.length || selectedTeams.some(team => team.tournament_id !== tournamentId)) {
    return json({ error: 'One or more registrations are outside this tournament.' }, 400);
  }

  const divisions = new Map((divisionRows ?? []).map(group => [group.id, group as DivisionFeeRow]));

  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  let nextWaitlistByGroup = new Map<string, number>();

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
    } else if (bulkAction === 'mark_deposit_paid') {
      const fee = effectiveFee(team, tournament, divisions);
      if (fee.depositAmount != null) patch.deposit_paid = Math.max(Number(team.deposit_paid ?? 0), Number(fee.depositAmount));
      if (fee.totalFeeAmount && fee.depositAmount && Number(fee.depositAmount) >= Number(fee.totalFeeAmount)) {
        patch.total_paid = Math.max(Number(team.total_paid ?? 0), Number(fee.totalFeeAmount));
        patch.payment_status = 'paid';
      }
    } else if (bulkAction === 'mark_paid') {
      const fee = effectiveFee(team, tournament, divisions);
      patch.payment_status = 'paid';
      if (fee.depositAmount != null) patch.deposit_paid = Math.max(Number(team.deposit_paid ?? 0), Number(fee.depositAmount));
      if (fee.totalFeeAmount != null) patch.total_paid = Math.max(Number(team.total_paid ?? 0), Number(fee.totalFeeAmount));
    }
    if (Object.keys(patch).length > 0) updates.push({ id: team.id, patch });
  }

  for (const update of updates) {
    const { error } = await supabaseAdmin.from('teams').update(update.patch).eq('id', update.id);
    if (error) return json({ error: error.message }, 500);
  }

  const paymentInstructions = typeof tournament.settings?.payment_instructions === 'string'
    ? tournament.settings.payment_instructions
    : undefined;
  await sendStatusEmails(selectedTeams, bulkAction, tournament.name, divisions, paymentInstructions, tournament.settings);

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

  return json({ success: true, count: selectedTeams.length, action: bulkAction });
}
