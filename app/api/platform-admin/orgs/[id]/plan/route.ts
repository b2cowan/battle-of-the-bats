import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { getEffectiveTournamentLimit, PLAN_CONFIG } from '@/lib/plan-config';
import { archiveOverCapTournamentsForPlanChange, isLowerPlan } from '@/lib/billing-retention';
import { isClubPlan } from '@/lib/module-entitlements';
import { applyPlanChangeSideEffects, hadSubscriptionBefore, hasLiveSubscription } from '@/lib/plan-move';
import { getPlanConfigOverride } from '@/lib/plan-config-db';
import { restoreAfterReactivation } from '@/lib/billing-reactivation';
import type { OrgPlan } from '@/lib/types';
import { withObservability } from '@/lib/observability';

function isOrgPlan(planId: unknown): planId is OrgPlan {
  return typeof planId === 'string' && planId in PLAN_CONFIG;
}

type CurrentPlanRow = {
  plan_id: string;
  tournament_limit: number;
  team_limit: number | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_period: string | null;
  current_period_end: string | null;
};

export const PATCH = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPermission('manage_billing');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json() as { planId?: string; tournamentLimit?: number; teamLimit?: number | null; reason?: string };
  const { planId, tournamentLimit, teamLimit, reason } = body;

  if (!isOrgPlan(planId) || typeof tournamentLimit !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  if (!reason?.trim()) {
    return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
  }
  // Sanity ceiling on the custom team-cap override — well above any real association
  // (largest custom deals are tens of teams), guards against a runaway/typo value.
  if (typeof teamLimit === 'number' && teamLimit > 1000) {
    return NextResponse.json({ error: 'Team limit override is too large (max 1000).' }, { status: 400 });
  }

  const effectiveTournamentLimit = getEffectiveTournamentLimit(planId, tournamentLimit);
  // Per-org rep-team capacity override (Club Repackaging). Stores the RAW value (a value
  // RAISES the band for "custom above 30" Club · Association deals). IMPORTANT: only written
  // when the caller EXPLICITLY includes teamLimit — an unrelated plan/limit save (which omits
  // teamLimit) must NOT wipe an existing custom cap. A provided 0/null clears the override.
  const teamLimitProvided = teamLimit !== undefined;
  const normalizedTeamLimit = (typeof teamLimit === 'number' && teamLimit > 0) ? Math.floor(teamLimit) : null;

  const { data: current } = await supabaseAdmin
    .from('organizations')
    .select('plan_id, tournament_limit, team_limit, subscription_status, stripe_customer_id, stripe_subscription_id, subscription_period, current_period_end')
    .eq('id', id)
    .single<CurrentPlanRow>();

  const currentEffectiveLimit = current
    ? getEffectiveTournamentLimit(current.plan_id as OrgPlan, current.tournament_limit)
    : null;
  const { count: nonArchivedTournamentCount } = await supabaseAdmin
    .from('tournaments')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', id)
    .neq('status', 'archived');

  const updatePayload: {
    plan_id: OrgPlan;
    tournament_limit: number;
    team_limit?: number | null;
    subscription_status?: 'active' | 'trialing';
    stripe_subscription_id?: null;
    subscription_period?: null;
    current_period_end?: string | null;
  } = {
    plan_id: planId,
    tournament_limit: effectiveTournamentLimit,
  };
  // Only touch the team cap when the caller explicitly sent it — never wipe a custom cap on
  // an unrelated plan/limit save.
  if (teamLimitProvided) updatePayload.team_limit = normalizedTeamLimit;

  if (planId === 'tournament') {
    updatePayload.subscription_status = 'active';
    updatePayload.stripe_subscription_id = null;
    updatePayload.subscription_period = null;
    updatePayload.current_period_end = null;
  }

  // ── Onto a Club band (Club Tier Stage 1b) ─────────────────────────────────────────────────
  // H02: the Club trial. An organization moved onto Club by an operator starts the same 90-day trial
  // a Club purchase starts (the plan's own trial length, platform overrides included) — unless it is
  // already paying on a live Stripe subscription, already on a Club band, or has had a trial before —
  // one an operator granted (the audit log) OR one it took itself through checkout (its Stripe
  // history: Ask 4, no second trial). The trial's end is the period end the billing page shows.
  // Parts of a plan change that fail AFTER the plan is saved: reported to the operator, never
  // swallowed into a plain success (the same rule as the over-cap archive's warning below).
  const planChangeWarnings: string[] = [];
  let clubTrialDays = 0;
  if (isClubPlan(planId) && current && !isClubPlan(current.plan_id)) {
    const payingLive = hasLiveSubscription({
      id,
      planId: current.plan_id as OrgPlan,
      stripeSubscriptionId: current.stripe_subscription_id,
      subscriptionStatus: current.subscription_status,
    });
    const { count: priorTrials } = await supabaseAdmin
      .from('platform_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', id)
      .eq('action', 'update_plan')
      .eq('field', 'club_trial');
    let subscribedBefore = false;
    const customerId = current.stripe_customer_id;
    if (!payingLive && (priorTrials ?? 0) === 0 && customerId && !customerId.startsWith('mock_')) {
      try {
        subscribedBefore = await hadSubscriptionBefore(customerId);
      } catch (stripeErr) {
        // Unknown history is not "no history": no trial, and the operator is told why.
        console.error('[platform-admin] subscription history read failed:', stripeErr);
        subscribedBefore = true;
        planChangeWarnings.push('Plan saved without a Club trial — the payment provider could not be reached to check whether this organization has had one.');
      }
    }
    if (!payingLive && (priorTrials ?? 0) === 0 && !subscribedBefore) {
      clubTrialDays = (await getPlanConfigOverride(planId)).trialDays;
      if (clubTrialDays > 0) {
        updatePayload.subscription_status = 'trialing';
        updatePayload.current_period_end = new Date(Date.now() + clubTrialDays * 86_400_000).toISOString();
      }
    }
  }

  const { error } = await supabaseAdmin
    .from('organizations')
    .update(updatePayload)
    .eq('id', id);

  if (error) {
    console.error('[platform-admin] org plan update error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  // The database half of any plan change — the same one a Stripe move and the webhook run: a custom
  // team limit set for the OLD plan is cleared (it would read as the new band's cap) unless this
  // request sets one, and ⚖ D6 a move onto Club revokes the Founding Season comp.
  let sideEffects = { clearedTeamLimit: false, revokedComps: 0 };
  try {
    sideEffects = await applyPlanChangeSideEffects({
      orgId: id,
      fromPlan: current?.plan_id ?? null,
      toPlan: planId,
      actor: auth.user.email ?? 'platform-admin',
      keepTeamLimit: teamLimitProvided,
    });
  } catch (sideEffectErr) {
    console.error('[platform-admin] plan-change side effects failed:', sideEffectErr);
    planChangeWarnings.push('Plan saved, but clearing the old custom team limit or ending the Founding Season offer failed — check both by hand.');
  }
  // A07: an operator bringing a CANCELLED organization back restores what the cancellation took.
  const reactivated = current?.subscription_status === 'canceled'
    && (updatePayload.subscription_status === 'active' || updatePayload.subscription_status === 'trialing');
  if (reactivated) {
    try {
      await restoreAfterReactivation(id, effectiveTournamentLimit);
    } catch (restoreErr) {
      console.error('[platform-admin] reactivation restore failed:', restoreErr);
      planChangeWarnings.push('Plan saved, but restoring what the cancellation took (the public site, the tournaments) failed — the organization may still be suspended.');
    }
  }

  // Apply the new cap to the tournaments that ALREADY exist (audit 2026-08-06). Before this, the
  // route counted them into the audit log and left them running — the cap is only enforced at
  // creation, so a Club dropped to a one-slot plan kept every live tournament forever. The
  // customer's own downgrade has always archived the excess; this is the operator path catching up.
  // Nothing is destroyed — the rows are retained and restored on re-upgrade.
  let archivedTournaments: { id: string; name: string }[] = [];
  let archiveWarning: string | undefined;
  if (current && isLowerPlan(current.plan_id as OrgPlan, planId)) {
    try {
      const archived = await archiveOverCapTournamentsForPlanChange({
        orgId: id,
        fromPlan: current.plan_id as OrgPlan,
        targetPlan: planId,
        actorEmail: auth.user.email ?? null,
        reason: reason.trim(),
      });
      archivedTournaments = archived.map(t => ({ id: t.id, name: t.name }));
      if (archivedTournaments.length > 0) {
        await writePlatformAuditLog(auth.user.email!, id, 'update_plan', 'archived_over_cap_tournaments',
          null, { count: archivedTournaments.length, tournaments: archivedTournaments });
      }
    } catch (archiveErr) {
      // The plan change itself already succeeded and must not be reported as a failure. Surface
      // the shortfall to the operator instead of swallowing it — an org sitting over its cap is
      // exactly the silent state this whole audit was about.
      //
      // ⚠ Set a warning and FALL THROUGH rather than returning here: an early return would skip
      // the plan-change audit logs below, so the one case where a human most needs the trail —
      // a half-applied downgrade — would be the one case that left none.
      console.error('[platform-admin] over-cap tournament archive failed:', archiveErr);
      archiveWarning = 'Plan saved, but the over-cap tournaments could not be archived. '
        + 'This org is now over its tournament limit — archive them manually.';
    }
  }

  await writePlatformAuditLog(auth.user.email!, id, 'update_org_plan_and_limit', 'plan_and_limit',
    current
      ? {
          plan_id: current.plan_id,
          tournament_limit: currentEffectiveLimit,
          subscription_status: current.subscription_status,
          stripe_subscription_id: current.stripe_subscription_id,
          subscription_period: current.subscription_period,
          current_period_end: current.current_period_end,
        }
      : null,
    {
      plan_id: planId,
      tournament_limit: effectiveTournamentLimit,
      non_archived_tournaments: nonArchivedTournamentCount ?? 0,
      reason: reason.trim(),
      free_plan_billing_reset: planId === 'tournament',
    });
  if (current?.tournament_limit !== effectiveTournamentLimit) {
    await writePlatformAuditLog(auth.user.email!, id, 'update_plan', 'tournament_limit',
      current?.tournament_limit, effectiveTournamentLimit);
  }
  if (sideEffects.clearedTeamLimit) {
    await writePlatformAuditLog(auth.user.email!, id, 'update_plan', 'team_limit',
      current?.team_limit ?? null, null);
  }
  if (clubTrialDays > 0) {
    await writePlatformAuditLog(auth.user.email!, id, 'update_plan', 'club_trial',
      null, { days: clubTrialDays, endsAt: updatePayload.current_period_end });
  }
  if (sideEffects.revokedComps > 0) {
    await writePlatformAuditLog(auth.user.email!, id, 'update_plan', 'founding_comp_revoked',
      null, { rows: sideEffects.revokedComps });
  }
  if (teamLimitProvided && (current?.team_limit ?? null) !== normalizedTeamLimit) {
    await writePlatformAuditLog(auth.user.email!, id, 'update_plan', 'team_limit',
      current?.team_limit ?? null, normalizedTeamLimit);
  }
  if (planId === 'tournament') {
    if (current?.subscription_status !== 'active') {
      await writePlatformAuditLog(auth.user.email!, id, 'update_plan', 'subscription_status',
        current?.subscription_status, 'active');
    }
    if (current?.stripe_subscription_id) {
      await writePlatformAuditLog(auth.user.email!, id, 'update_plan', 'stripe_subscription_id',
        current?.stripe_subscription_id, null);
    }
    if (current?.subscription_period) {
      await writePlatformAuditLog(auth.user.email!, id, 'update_plan', 'subscription_period',
        current?.subscription_period, null);
    }
    if (current?.current_period_end) {
      await writePlatformAuditLog(auth.user.email!, id, 'update_plan', 'current_period_end',
        current?.current_period_end, null);
    }
  }

  return NextResponse.json({
    ok: true,
    planId,
    tournamentLimit: effectiveTournamentLimit,
    teamLimit: teamLimitProvided
      ? normalizedTeamLimit
      : (sideEffects.clearedTeamLimit ? null : (current?.team_limit ?? null)),
    archivedTournaments,
    ...(archiveWarning ? { archiveWarning } : {}),
    // Added 2026-09-25 (Club Tier Stage 1b), additively:
    clubTrialDays,
    foundingCompRevoked: sideEffects.revokedComps > 0,
    teamLimitCleared: sideEffects.clearedTeamLimit,
    ...(planChangeWarnings.length > 0 ? { planChangeWarning: planChangeWarnings.join(' ') } : {}),
  });
}, { route: '/api/platform-admin/orgs/[id]/plan' });
