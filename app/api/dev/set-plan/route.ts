import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

const PLAN_LIMITS: Record<string, number> = {
  starter: 1,
  pro:     5,
  elite:   999,
};

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { plan } = await req.json();
  if (!PLAN_LIMITS[plan]) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ plan_id: plan, tournament_limit: PLAN_LIMITS[plan] })
    .eq('id', ctx.org.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ plan });
}
