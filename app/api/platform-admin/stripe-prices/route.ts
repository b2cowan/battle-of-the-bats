import { getPlatformAuthContext, requireAnyPlatformPermission } from '@/lib/platform-auth';
import {
  recordCatalogChangeApplication,
  requireApprovedCatalogChangeRequest,
} from '@/lib/platform-catalog-approval';
import { sanitizePlatformChangeNote } from '@/lib/platform-change-note';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  validateStripePriceForSlot,
  hardBlockMessage,
  type PriceValidationResult,
} from '@/lib/stripe-price-validation';
import { withObservability, captureAndJson } from '@/lib/observability';

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET = withObservability(async () => {
  const user = await getPlatformAuthContext();
  if (!user) return unauthorized();

  const { data, error } = await supabaseAdmin
    .from('stripe_prices')
    .select('*')
    .order('environment')
    .order('plan_id')
    .order('billing_cycle');

  if (error) {
    return captureAndJson(error, { error: error.message }, 500);
  }

  return Response.json(data);
}, { route: '/api/platform-admin/stripe-prices' });

export const PATCH = withObservability(async (req: Request) => {
  const auth = await requireAnyPlatformPermission(['manage_billing', 'manage_product']);
  if (auth.response) return auth.response;

  const {
    id,
    price_id,
    change_note,
    approved_change_request_id,
  }: { id: string; price_id: string | null; change_note?: string | null; approved_change_request_id?: string | null } = await req.json();
  const changeNote = sanitizePlatformChangeNote(change_note);

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate price_id format: must be empty/null or start with 'price_'
  if (price_id && !price_id.startsWith('price_')) {
    return new Response(JSON.stringify({ error: 'price_id must start with price_' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const approval = await requireApprovedCatalogChangeRequest(approved_change_request_id, 'stripe_price');
  if (!approval.ok) return approval.response;

  const { data: current } = await supabaseAdmin
    .from('stripe_prices')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!current) {
    return new Response(JSON.stringify({ error: 'Stripe price slot not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate the price against the slot before applying (same rules as the change-request flow):
  // hard-block anything never-valid, record warnings for an explicit confirm in the UI, and skip
  // the Stripe lookup when the slot's environment can't be checked in this environment.
  let stripeValidation: PriceValidationResult | { checked: boolean } = { checked: false };

  if (price_id) {
    const validation = await validateStripePriceForSlot(price_id, {
      slotId: id,
      planId: current.plan_id,
      billingCycle: current.billing_cycle,
      environment: current.environment,
    });
    stripeValidation = validation;
    if (validation.hardBlock) {
      return new Response(
        JSON.stringify({ error: `Stripe price validation failed — ${hardBlockMessage(validation)}`, validation }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  const updatedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('stripe_prices')
    .update({
      price_id: price_id || null,
      updated_at: updatedAt,
      updated_by_email: auth.user.email,
      last_change_note: changeNote,
    })
    .eq('id', id);

  if (error) {
    return captureAndJson(error, { error: error.message }, 500);
  }

  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'update_stripe_price_id',
    'price_id',
    current
      ? {
          id,
          plan_id: current.plan_id,
          billing_cycle: current.billing_cycle,
          environment: current.environment,
          price_id: current.price_id,
          change_note: current.last_change_note ?? null,
        }
      : null,
    {
      id,
      plan_id: current?.plan_id ?? null,
      billing_cycle: current?.billing_cycle ?? null,
      environment: current?.environment ?? null,
      price_id: price_id || null,
      change_note: changeNote,
      stripe_validation: stripeValidation,
      approved_change_request_id: approval.changeRequest.id,
    },
  );

  await recordCatalogChangeApplication(
    approval.changeRequest.id,
    'stripe_price',
    id,
    auth.user.email!,
    {
      id,
      plan_id: current?.plan_id ?? null,
      billing_cycle: current?.billing_cycle ?? null,
      environment: current?.environment ?? null,
      price_id: price_id || null,
      change_note: changeNote,
      stripe_validation: stripeValidation,
    },
  );

  return Response.json({
    ok: true,
    updated_at: updatedAt,
    updated_by_email: auth.user.email,
    last_change_note: changeNote,
    stripe_validation: stripeValidation,
    approved_change_request_id: approval.changeRequest.id,
  });
}, { route: '/api/platform-admin/stripe-prices' });
