import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { OrgPlan, SubscriptionStatus } from '@/lib/types';

// This route only exists in dev. In production STRIPE_SECRET_KEY will be set,
// so reaching this endpoint means someone is calling it directly — reject it.
export async function POST(req: Request) {
  if (process.env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Not available in production' }), {
      status: 403,
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

  const subId = plan === 'starter' ? null : `mock_sub_${plan}_${Date.now()}`;

  await supabaseAdmin
    .from('organizations')
    .update({
      plan_id: plan,
      tournament_limit: cfg.tournamentLimit,
      subscription_status: status,
      stripe_subscription_id: subId,
    })
    .eq('id', auth.org.id);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
