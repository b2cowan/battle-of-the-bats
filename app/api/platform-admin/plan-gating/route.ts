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
    .from('plan_gating')
    .select('*')
    .order('plan_key');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return Response.json(data);
}

export async function POST(req: Request) {
  const user = await getPlatformAuthContext();
  if (!user) return unauthorized();

  const { planKey, gatingStatus }: { planKey: string; gatingStatus: string } = await req.json();

  const validKeys = ['tournament', 'tournament_plus', 'league', 'club'];
  const validStatuses = ['live', 'early_access'];
  if (!validKeys.includes(planKey) || !validStatuses.includes(gatingStatus)) {
    return new Response(JSON.stringify({ error: 'Invalid planKey or gatingStatus' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error } = await supabaseAdmin
    .from('plan_gating')
    .update({
      gating_status: gatingStatus,
      updated_at: new Date().toISOString(),
      updated_by_email: user.email,
    })
    .eq('plan_key', planKey);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return Response.json({ ok: true, planKey, gatingStatus });
}
