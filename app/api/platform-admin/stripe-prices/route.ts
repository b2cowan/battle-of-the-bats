import { getPlatformAuthContext } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET() {
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
}

export async function PATCH(req: Request) {
  const user = await getPlatformAuthContext();
  if (!user) return unauthorized();

  const { id, price_id }: { id: string; price_id: string | null } = await req.json();

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

  const { error } = await supabaseAdmin
    .from('stripe_prices')
    .update({
      price_id: price_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return Response.json({ ok: true });
}
