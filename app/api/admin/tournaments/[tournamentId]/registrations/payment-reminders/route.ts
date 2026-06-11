import { NextRequest, NextResponse } from 'next/server';
import { paymentReminderHtml, sendEmail, resolveCoachRecipient } from '@/lib/email';
import { getAuthContextWithScope, forbidden, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { resolveTournamentContactEmail } from '@/lib/db';
import { withObservability } from '@/lib/observability';

type RouteParams = { params: Promise<{ tournamentId: string }> };

type TeamRow = {
  id: string;
  tournament_id: string;
  division_id: string;
  name: string;
  coach: string | null;
  email: string | null;
  coach_email: string | null;
  status: string | null;
  deposit_paid: number | null;
  total_paid: number | null;
};

type TournamentRow = {
  id: string;
  name: string;
  org_id: string | null;
  contact_email: string | null;
  fee_schedule_mode: string | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  total_fee_amount: number | null;
  total_fee_due_date: string | null;
};

type DivisionFeeRow = {
  id: string;
  name: string;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  total_fee_amount: number | null;
  total_fee_due_date: string | null;
};

type FeeDetails = {
  depositAmount: number | null;
  depositDueDate: string | null;
  totalFeeAmount: number | null;
  totalFeeDueDate: string | null;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function cleanInstructions(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 2000);
}

function effectiveFee(team: TeamRow, tournament: TournamentRow, divisions: Map<string, DivisionFeeRow>): FeeDetails {
  const group = divisions.get(team.division_id);
  if (tournament.fee_schedule_mode === 'division' && group?.total_fee_amount != null) {
    return {
      depositAmount: group.deposit_amount ?? null,
      depositDueDate: group.deposit_due_date ?? null,
      totalFeeAmount: group.total_fee_amount ?? null,
      totalFeeDueDate: group.total_fee_due_date ?? null,
    };
  }

  return {
    depositAmount: tournament.deposit_amount ?? null,
    depositDueDate: tournament.deposit_due_date ?? null,
    totalFeeAmount: tournament.total_fee_amount ?? null,
    totalFeeDueDate: tournament.total_fee_due_date ?? null,
  };
}

function reminderAmountDue(team: TeamRow, fee: FeeDetails) {
  const depositPaid = Number(team.deposit_paid ?? 0);
  const totalPaid = Number(team.total_paid ?? 0);

  if (!fee.totalFeeAmount || totalPaid >= Number(fee.totalFeeAmount)) return null;

  if (fee.depositAmount && depositPaid < Number(fee.depositAmount)) {
    return {
      amount: Math.max(Number(fee.depositAmount) - depositPaid, 0),
      dueDate: fee.depositDueDate,
    };
  }

  return {
    amount: Math.max(Number(fee.totalFeeAmount) - totalPaid, 0),
    dueDate: fee.totalFeeDueDate,
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);
}

async function trackReminderEvent(input: {
  orgId: string;
  userId: string;
  userEmail?: string | null;
  planId: string;
  tournamentId: string;
  selectedCount: number;
  status: 'attempted' | 'completed' | 'blocked';
  emailsSent?: number;
  skippedCount?: number;
}) {
  await writePlatformEvent({
    eventType: 'tournament_plus_feature_used',
    source: 'app',
    orgId: input.orgId,
    actorUserId: input.userId,
    actorEmail: input.userEmail,
    planId: input.planId,
    metadata: {
      feature: 'payment_readiness_tools',
      action: 'send_payment_reminders',
      tournamentId: input.tournamentId,
      selectedCount: input.selectedCount,
      status: input.status,
      emailsSent: input.emailsSent,
      skippedCount: input.skippedCount,
    },
  });
}

export const POST = withObservability(async (req: NextRequest, { params }: RouteParams) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();
  if (!hasCapability(ctx.role, ctx.capabilities, 'manage_registrations') && !hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) {
    return forbidden();
  }

  const { tournamentId } = await params;
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const body = await req.json() as { ids?: unknown; paymentInstructions?: unknown };
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  const paymentInstructions = cleanInstructions(body.paymentInstructions);

  if (ids.length === 0) return json({ error: 'Select at least one registration.' }, 400);
  if (!paymentInstructions) return json({ error: 'Add payment instructions before sending reminders.' }, 400);

  await trackReminderEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    tournamentId,
    selectedCount: ids.length,
    status: 'attempted',
  });

  if (!hasPlanFeature(ctx.org.planId, 'payment_readiness_tools')) {
    await trackReminderEvent({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      planId: ctx.org.planId,
      tournamentId,
      selectedCount: ids.length,
      status: 'blocked',
    });
    return json({ error: requiresTournamentPlusCopy('payment_readiness_tools') }, 403);
  }

  const [{ data: tournament, error: tournamentError }, { data: teams, error: teamsError }, { data: divisionRows, error: divisionError }] = await Promise.all([
    supabaseAdmin
      .from('tournaments')
      .select('id, name, org_id, contact_email, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date')
      .eq('id', tournamentId)
      .maybeSingle<TournamentRow>(),
    supabaseAdmin
      .from('teams')
      .select('id, tournament_id, division_id, name, coach, email, coach_email, status, deposit_paid, total_paid')
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

  const selectedTeams = (teams ?? []) as TeamRow[];
  if (selectedTeams.length !== ids.length || selectedTeams.some(team => team.tournament_id !== tournamentId)) {
    return json({ error: 'One or more registrations are outside this tournament.' }, 400);
  }

  const divisions = new Map((divisionRows ?? []).map(group => [group.id, group as DivisionFeeRow]));
  // Coach-facing payment reminders respect the "Communication with coaches" toggle and resolve
  // the selected contact member. Off → no contact shown. Final fallback is the acting admin.
  const reminderFallback = (await getOrgOwnerEmail(ctx.org.id)) ?? ctx.user.email ?? null;
  const contactEmail = (await resolveTournamentContactEmail(tournamentId, reminderFallback, 'coach')) ?? undefined;

  let emailsSent = 0;
  let skippedCount = 0;

  for (const team of selectedTeams) {
    const fee = effectiveFee(team, tournament, divisions);
    const due = reminderAmountDue(team, fee);
    // Recipient prefers the assigned coach (teams.coach_email), falls back to teams.email; the
    // footer keeps teams.email (the claim key, never overwritten).
    const recipient = resolveCoachRecipient(team);
    if (!recipient || team.status !== 'accepted' || !due || due.amount <= 0) {
      skippedCount++;
      continue;
    }

    const divisionName = divisions.get(team.division_id)?.name ?? 'Division';
    await sendEmail(
      recipient,
      `Payment Reminder - ${tournament.name}`,
      paymentReminderHtml({
        teamName: team.name,
        coachName: team.coach ?? '',
        divisionName,
        tournamentName: tournament.name,
        amountDue: formatCurrency(due.amount),
        dueDate: due.dueDate,
        paymentInstructions,
        contactEmail,
        registrationId: team.id,
        coachEmail: team.email ?? undefined,
      }),
    );
    emailsSent++;
  }

  await trackReminderEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    tournamentId,
    selectedCount: ids.length,
    status: 'completed',
    emailsSent,
    skippedCount,
  });

  return json({ success: true, emailsSent, skippedCount });
}, { route: '/api/admin/tournaments/[tournamentId]/registrations/payment-reminders' });
