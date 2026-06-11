/**
 * GET /api/admin/rep-teams/billing-preview?proposedCount=N
 *
 * Returns a pricing preview for adding a rep team on the Club plan.
 * Only relevant when proposedCount > 3 (first 3 teams are free).
 *
 * Used by the team-creation billing modal (E4) to show the prorated
 * charge billed today and the new recurring amount going forward.
 */

import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { stripe } from '@/lib/stripe';
import { getStripePriceId } from '@/lib/stripe-prices';
import { getActiveRepTeamCount } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withObservability(async (req: Request) => {
  const ctx = await getAuthContextWithRole();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  if (ctx.org.planId !== 'club') {
    return NextResponse.json({ error: 'Billing preview is only available on the Club plan.' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const proposedParam = searchParams.get('proposedCount');
  const proposedCount = proposedParam !== null ? parseInt(proposedParam, 10) : null;

  if (proposedCount === null || Number.isNaN(proposedCount) || proposedCount < 0) {
    return NextResponse.json({ error: 'proposedCount must be a non-negative integer.' }, { status: 400 });
  }

  const currentCount = await getActiveRepTeamCount(ctx.org.id);
  const currentBillable = Math.max(0, currentCount - 3);
  const newBillable = Math.max(0, proposedCount - 3);

  // No charge if still within the free-3 threshold.
  if (newBillable === 0) {
    return NextResponse.json({
      currentCount,
      newCount: proposedCount,
      currentBillable: 0,
      newBillable: 0,
      immediateCharge: 0,
      immediateChargeFormatted: '$0.00 CAD',
      newRecurring: 0,
      newRecurringFormatted: '$0.00 CAD',
      billingPeriod: ctx.org.subscriptionPeriod ?? 'monthly',
      nextRenewal: ctx.org.currentPeriodEnd ?? null,
    });
  }

  // Fetch org Stripe fields.
  const { data: orgRow } = await supabaseAdmin
    .from('organizations')
    .select('stripe_customer_id, stripe_subscription_id, subscription_period, rep_team_subscription_item_id')
    .eq('id', ctx.org.id)
    .maybeSingle();

  if (!orgRow?.stripe_subscription_id || !orgRow?.stripe_customer_id) {
    return NextResponse.json({ error: 'No active subscription found.' }, { status: 400 });
  }

  const billingCycle = (orgRow.subscription_period as 'monthly' | 'annual') ?? 'monthly';
  const itemId = orgRow.rep_team_subscription_item_id as string | null;

  // Look up the rep_team price to get the unit amount.
  const priceId = await getStripePriceId('rep_team', billingCycle);
  if (!priceId) {
    return NextResponse.json(
      { error: 'Rep team add-on price not configured. Contact support.' },
      { status: 500 },
    );
  }

  const price = await stripe.prices.retrieve(priceId);
  const unitAmountCents = price.unit_amount ?? 0;
  const newRecurring = (unitAmountCents / 100) * newBillable;

  // Build the subscription_details payload for the preview.
  // If the item already exists we update its quantity; otherwise we add it.
  const subscriptionDetailsItems: {
    id?: string;
    price?: string;
    quantity: number;
  }[] = itemId
    ? [{ id: itemId, quantity: newBillable }]
    : [{ price: priceId, quantity: newBillable }];

  // Also include a no-op for the base plan item to avoid Stripe removing it
  // from the preview when we only specify add-on items.
  const subscription = await stripe.subscriptions.retrieve(
    orgRow.stripe_subscription_id as string,
    { expand: ['items'] },
  );
  const baseItem = subscription.items.data.find(si => si.id !== itemId);
  if (baseItem) {
    subscriptionDetailsItems.unshift({ id: baseItem.id, quantity: baseItem.quantity ?? 1 });
  }

  const preview = await stripe.invoices.createPreview({
    customer: orgRow.stripe_customer_id as string,
    subscription: orgRow.stripe_subscription_id as string,
    subscription_details: { items: subscriptionDetailsItems },
  });

  // Sum proration line items to get the charge billed today.
  const prorationCents = (preview.lines.data as { proration?: boolean; amount: number }[])
    .filter(line => line.proration)
    .reduce((sum, line) => sum + line.amount, 0);

  const immediateCharge = Math.max(0, prorationCents / 100);

  function formatCAD(amount: number): string {
    return `$${amount.toFixed(2)} CAD`;
  }

  return NextResponse.json({
    currentCount,
    newCount: proposedCount,
    currentBillable,
    newBillable,
    immediateCharge,
    immediateChargeFormatted: formatCAD(immediateCharge),
    newRecurring,
    newRecurringFormatted: formatCAD(newRecurring),
    billingPeriod: billingCycle,
    nextRenewal: ctx.org.currentPeriodEnd ?? null,
  });
}, { route: '/api/admin/rep-teams/billing-preview' });
