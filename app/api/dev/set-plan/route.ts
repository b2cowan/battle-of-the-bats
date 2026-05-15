import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';

function isOrgPlan(plan: unknown): plan is OrgPlan {
  return typeof plan === 'string' && plan in PLAN_CONFIG;
}

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { plan } = await req.json();
  if (!isOrgPlan(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const config = PLAN_CONFIG[plan];

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ plan_id: plan, tournament_limit: config.tournamentLimit })
    .eq('id', ctx.org.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ plan });
}
