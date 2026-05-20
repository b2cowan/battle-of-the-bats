import { NextRequest, NextResponse } from 'next/server';
import { getPlatformAuthContext } from '@/lib/platform-auth';
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
  const user = await getPlatformAuthContext();
  if (!user) return new NextResponse('Forbidden', { status: 403 });

  const { id } = await params;
  const body = await req.json() as { planId?: string; tournamentLimit?: number };
  const { planId, tournamentLimit } = body;

  if (!isOrgPlan(planId) || typeof tournamentLimit !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const effectiveTournamentLimit = getEffectiveTournamentLimit(planId, tournamentLimit);

  const { data: current } = await supabaseAdmin
    .from('organizations')
    .select('plan_id, tournament_limit, subscription_status, stripe_subscription_id, subscription_period, current_period_end')
    .eq('id', id)
    .single<CurrentPlanRow>();

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

  await writePlatformAuditLog(user.email!, id, 'update_plan', 'plan_id',
    current?.plan_id, planId);
  if (current?.tournament_limit !== effectiveTournamentLimit) {
    await writePlatformAuditLog(user.email!, id, 'update_plan', 'tournament_limit',
      current?.tournament_limit, effectiveTournamentLimit);
  }
  if (planId === 'tournament') {
    if (current?.subscription_status !== 'active') {
      await writePlatformAuditLog(user.email!, id, 'update_plan', 'subscription_status',
        current?.subscription_status, 'active');
    }
    if (current?.stripe_subscription_id) {
      await writePlatformAuditLog(user.email!, id, 'update_plan', 'stripe_subscription_id',
        current?.stripe_subscription_id, null);
    }
    if (current?.subscription_period) {
      await writePlatformAuditLog(user.email!, id, 'update_plan', 'subscription_period',
        current?.subscription_period, null);
    }
    if (current?.current_period_end) {
      await writePlatformAuditLog(user.email!, id, 'update_plan', 'current_period_end',
        current?.current_period_end, null);
    }
  }

  return NextResponse.json({ ok: true });
}
