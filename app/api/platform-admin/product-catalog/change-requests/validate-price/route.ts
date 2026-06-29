import { NextResponse } from 'next/server';
import { requireAnyPlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateStripePriceForSlot } from '@/lib/stripe-price-validation';
import { withObservability } from '@/lib/observability';

/**
 * Read-only price validation for the approval-detail view. Re-derives the slot from the catalog
 * row (never trusts client-supplied slot data) and runs the same validator the apply path uses,
 * so an operator sees the Catalog-vs-Stripe checks (and any warnings) BEFORE approving.
 */
export const POST = withObservability(async (req: Request) => {
  const auth = await requireAnyPlatformPermission(['manage_billing', 'manage_product']);
  if (auth.response) return auth.response;

  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: 'Missing change request id' }, { status: 400 });

  const { data: cr } = await supabaseAdmin
    .from('platform_catalog_change_requests')
    .select('proposal')
    .eq('id', id)
    .maybeSingle<{ proposal: unknown }>();
  if (!cr) return NextResponse.json({ error: 'Change request not found' }, { status: 404 });

  const proposal = (cr.proposal && typeof cr.proposal === 'object') ? cr.proposal as Record<string, unknown> : null;
  if (!proposal || proposal.kind !== 'stripe_price_update') {
    return NextResponse.json({ validation: null });
  }
  const slotId = typeof proposal.stripePriceId === 'string' ? proposal.stripePriceId.trim() : '';
  const proposedPriceId = typeof proposal.proposedPriceId === 'string' ? proposal.proposedPriceId.trim() : '';
  if (!slotId || !proposedPriceId) {
    // Clearing a slot (no proposed price) has nothing to validate against Stripe.
    return NextResponse.json({ validation: null });
  }

  const { data: slot } = await supabaseAdmin
    .from('stripe_prices')
    .select('id, plan_id, billing_cycle, environment')
    .eq('id', slotId)
    .maybeSingle<{ id: string; plan_id: string; billing_cycle: string; environment: string }>();
  if (!slot) return NextResponse.json({ error: 'Stripe price slot not found' }, { status: 404 });

  const validation = await validateStripePriceForSlot(proposedPriceId, {
    slotId: slot.id,
    planId: slot.plan_id,
    billingCycle: slot.billing_cycle,
    environment: slot.environment,
  });

  return NextResponse.json({ validation });
}, { route: '/api/platform-admin/product-catalog/change-requests/validate-price' });
