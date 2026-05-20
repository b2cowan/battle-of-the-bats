import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { isBillingMockEnabled } from '@/lib/billing-mock';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { OrgPlan, SubscriptionStatus } from '@/lib/types';

export async function POST(req: Request) {
  if (!isBillingMockEnabled()) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const auth = await getAuthContext();
  if (!auth) return unauthorized();

  const { plan, status }: { plan: OrgPlan; status: SubscriptionStatus } = await req.json();
  const cfg = PLAN_CONFIG[plan];
  if (!cfg) {
    return new Response(JSON.stringify({ error: 'Invalid plan' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const normalizedStatus = plan === 'tournament' && status === 'trialing' ? 'active' : status;
  const subId = plan === 'tournament' ? null : `mock_sub_${plan}_${Date.now()}`;

  await supabaseAdmin
    .from('organizations')
    .update({
      plan_id: plan,
      tournament_limit: cfg.tournamentLimit,
      subscription_status: normalizedStatus,
      stripe_subscription_id: subId,
      ...(plan === 'tournament' ? { subscription_period: null, current_period_end: null } : {}),
    })
    .eq('id', auth.org.id);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
