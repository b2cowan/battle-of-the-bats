import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { OrgPlan } from '@/lib/types';

const DEV_MODE = !process.env.STRIPE_SECRET_KEY;

function appendSuccess(url: string) {
  return `${url}${url.includes('?') ? '&' : '?'}success=1`;
}

function isMissingStartupTasksColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === '42703' || error.code === 'PGRST204' || message.includes('startup_tasks');
}

async function resetStartupTasksIfAvailable(orgId: string) {
  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ startup_tasks: {} })
    .eq('id', orgId);

  if (error && !isMissingStartupTasksColumn(error)) throw error;
}

async function resetStartupTasksForEditableOnboarding(orgId: string, enabled: boolean) {
  if (!enabled) return;

  const { count, error } = await supabaseAdmin
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .neq('status', 'archived');

  if (error) throw error;
  if ((count ?? 0) > 0) return;

  await resetStartupTasksIfAvailable(orgId);
}

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return unauthorized();

  const { planKey, returnTo }: { planKey: 'tournament_plus' | 'league' | 'club'; returnTo?: string } = await req.json();
  const plan = PLAN_CONFIG[planKey as OrgPlan];
  if (!plan) {
    return new Response(JSON.stringify({ error: 'Invalid plan' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const fallbackReturnTo = `/${auth.org.slug}/admin/org/billing`;
  const safeReturnTo = returnTo?.startsWith(`/${auth.org.slug}/admin/`)
    ? returnTo
    : fallbackReturnTo;
  const isOnboardingPlanSelection = safeReturnTo.includes('/admin/onboarding');

  // ── Dev mock: no Stripe, write directly to DB ──────────────────────────────
  if (DEV_MODE) {
    await supabaseAdmin
      .from('organizations')
      .update({
        plan_id: planKey,
        tournament_limit: plan.tournamentLimit,
        subscription_status: 'trialing',
        stripe_subscription_id: `mock_sub_${planKey}_${Date.now()}`,
      })
      .eq('id', auth.org.id);
    await resetStartupTasksForEditableOnboarding(auth.org.id, isOnboardingPlanSelection);

    return new Response(
      JSON.stringify({ url: appendSuccess(`${appUrl}${safeReturnTo}`), applied: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Production: real Stripe checkout ──────────────────────────────────────
  if (!plan.priceId) {
    return new Response(JSON.stringify({ error: 'No price configured for this plan' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { stripe } = await import('@/lib/stripe');

  let customerId = auth.org.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: auth.user.email,
      metadata: { orgId: auth.org.id },
    });
    customerId = customer.id;
    await supabaseAdmin
      .from('organizations')
      .update({ stripe_customer_id: customerId })
      .eq('id', auth.org.id);
  }

  await resetStartupTasksForEditableOnboarding(auth.org.id, isOnboardingPlanSelection);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: appendSuccess(`${appUrl}${safeReturnTo}`),
    cancel_url: `${appUrl}${safeReturnTo}`,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
