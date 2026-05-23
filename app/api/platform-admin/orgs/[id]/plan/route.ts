import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { getEffectiveTournamentLimit, PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';

function isOrgPlan(planId: unknown): planId is OrgPlan {
  return typeof planId === 'string' && planId in PLAN_CONFIG;
}

type CurrentPlanRow = {
  plan_id: string;
  tournament_limit: number;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  subscription_period: string | null;
  current_period_end: string | null;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformPermission('manage_billing');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json() as { planId?: string; tournamentLimit?: number; reason?: string };
  const { planId, tournamentLimit, reason } = body;

  if (!isOrgPlan(planId) || typeof tournamentLimit !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  if (!reason?.trim()) {
    return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
  }

  const effectiveTournamentLimit = getEffectiveTournamentLimit(planId, tournamentLimit);

  const { data: current } = await supabaseAdmin
    .from('organizations')
    .select('plan_id, tournament_limit, subscription_status, stripe_subscription_id, subscription_period, current_period_end')
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
    subscription_status?: 'active';
    stripe_subscription_id?: null;
    subscription_period?: null;
    current_period_end?: null;
  } = {
    plan_id: planId,
    tournament_limit: effectiveTournamentLimit,
  };

  if (planId === 'tournament') {
    updatePayload.subscription_status = 'active';
    updatePayload.stripe_subscription_id = null;
    updatePayload.subscription_period = null;
    updatePayload.current_period_end = null;
  }

  const { error } = await supabaseAdmin
    .from('organizations')
    .update(updatePayload)
    .eq('id', id);

  if (error) {
    console.error('[platform-admin] org plan update error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
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
  });
}
