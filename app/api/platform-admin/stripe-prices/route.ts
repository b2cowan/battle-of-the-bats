import { getPlatformAuthContext, requireAnyPlatformPermission } from '@/lib/platform-auth';
import {
  recordCatalogChangeApplication,
  requireApprovedCatalogChangeRequest,
} from '@/lib/platform-catalog-approval';
import { sanitizePlatformChangeNote } from '@/lib/platform-change-note';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getStripe } from '@/lib/stripe';
import { withObservability } from '@/lib/observability';

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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
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

  const secretKey = process.env.STRIPE_SECRET_KEY ?? '';
  const keyEnvironment = secretKey.startsWith('sk_live_') ? 'live' : secretKey ? 'sandbox' : null;
  let stripeValidation: { checked: boolean; active?: boolean; product?: string | null } = { checked: false };

  if (price_id && keyEnvironment && current.environment === keyEnvironment) {
    try {
      const price = await getStripe().prices.retrieve(price_id);
      stripeValidation = {
        checked: true,
        active: price.active,
        product: typeof price.product === 'string' ? price.product : price.product?.id ?? null,
      };
      if (!price.active) {
        return new Response(JSON.stringify({ error: 'Stripe price exists but is inactive.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message || 'Stripe price validation failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
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
