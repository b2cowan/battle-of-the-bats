import { teamPayNowLink } from '@/lib/online-payment-receipt';
import { NextRequest, NextResponse } from 'next/server';
import { paymentReminderHtml, sendEmail, resolveCoachRecipient } from '@/lib/email';
import { getAuthContextWithScope, forbidden, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { resolveTournamentContactEmail } from '@/lib/db';
import { withObservability, captureAndJson } from '@/lib/observability';
import { tournamentTracksPayments } from '@/lib/tournament-payments-tracked';
import { formatStoredDate } from '@/lib/timezone';
import { notifyTeamCoaches } from '@/lib/team-coach-notices';
import { TEAM_COACH_WORDS } from '@/lib/team-coach-notice-plan';
import { registrationAmountDue, registrationFee } from '@/lib/registration-amount-due';
import { ourTournamentTeamIds } from '@/lib/club-own-tournament-team';

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
  settings: unknown;
};

type DivisionFeeRow = {
  id: string;
  name: string;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  total_fee_amount: number | null;
  total_fee_due_date: string | null;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function cleanInstructions(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 2000);
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
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
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
      .select('id, name, org_id, contact_email, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date, settings')
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

  if (tournamentError) return captureAndJson(tournamentError, { error: tournamentError.message }, 500);
  if (teamsError) return captureAndJson(teamsError, { error: teamsError.message }, 500);
  if (divisionError) return captureAndJson(divisionError, { error: divisionError.message }, 500);
  if (!tournament || tournament.org_id !== ctx.org.id) return forbidden();
  // "Not tracked here": nothing is owed on the platform, so no reminder goes — whatever amount was typed before.
  if (!tournamentTracksPayments(tournament.settings)) {
    return json({ error: 'Payments aren’t tracked for this tournament, so there’s nothing to remind teams about.' }, 400);
  }

  const selectedTeams = (teams ?? []) as TeamRow[];
  if (selectedTeams.length !== ids.length || selectedTeams.some(team => team.tournament_id !== tournamentId)) {
    return json({ error: 'One or more registrations are outside this tournament.' }, 400);
  }

  const divisions = new Map((divisionRows ?? []).map(group => [group.id, group as DivisionFeeRow]));
  // Coach-facing payment reminders respect the "Communication with coaches" toggle and resolve
  // the selected contact member. Off → no contact shown. Final fallback is the acting admin.
  const reminderFallback = (await getOrgOwnerEmail(ctx.org.id)) ?? ctx.user.email ?? null;
  const contactEmail = (await resolveTournamentContactEmail(tournamentId, reminderFallback, 'coach')) ?? undefined;

  const ourTeams = await ourTournamentTeamIds(tournamentId);
  let emailsSent = 0;
  let skippedCount = 0;
  let skippedNoEmailCount = 0;
  // A free coach's bell (Free coach header parity, 2026-10-13): each reminder that went also waits under
  // Needs attention until the coach marks it Done (owner B4) — "$450.00 is due Jun 1 for …".
  const bellDue = new Map<string, string>();

  for (const team of selectedTeams) {
    const fee = registrationFee(team, tournament, divisions);
    const due = registrationAmountDue(team, fee);
    // Recipient prefers the assigned coach (teams.coach_email), falls back to teams.email; the
    // footer keeps teams.email (the claim key, never overwritten).
    const recipient = resolveCoachRecipient(team);
    // Our own team owes no entry fee (owner 2026-10-21), whatever the tournament charges.
    // A team that owes money but has no email on file is its own reason: "no payment is due" would be
    // untrue for it, and the admin's fix (add an address) is different from "nothing to do".
    const owes = team.status === 'accepted' && !!due && due.amount > 0 && !ourTeams.has(team.id);
    if (owes && !recipient) {
      skippedNoEmailCount++;
      skippedCount++;
      continue;
    }
    if (!recipient || !owes) {
      skippedCount++;
      continue;
    }

    const divisionName = divisions.get(team.division_id)?.name ?? 'Division';
    // Club Tier Stage 12a: Pay the balance (or Pay now) while the club takes payments online; absent → today's email.
    const pay = await teamPayNowLink(team.id);
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
        payUrl: pay?.url ?? null,
        paidSome: pay?.paidSome ?? false,
      }),
    );
    emailsSent++;
    bellDue.set(
      team.id,
      due.dueDate
        ? `${formatCurrency(due.amount)} is due ${formatStoredDate(due.dueDate, { withYear: false })}`
        : `${formatCurrency(due.amount)} is due`,
    );
  }
  await notifyTeamCoaches({
    registrationIds: [...bellDue.keys()],
    eventType: 'team_coach_payment_reminder',
    compose: c => TEAM_COACH_WORDS.paymentReminder(c, bellDue.get(c.registrationId) ?? 'A payment is due'),
    excludeUserIds: [ctx.user.id],
  });

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

  return json({ success: true, emailsSent, skippedCount, skippedNoEmailCount });
}, { route: '/api/admin/tournaments/[tournamentId]/registrations/payment-reminders' });
