import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireDevToolPlatformAdmin } from '@/lib/platform-auth';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';

const OWNER_EMAIL  = 'owner@dev.local';
const DEV_PASSWORD = 'devpass123';

const VALID_ORG_PLANS = ['tournament', 'tournament_plus', 'league', 'club', 'club_large'] as const satisfies readonly OrgPlan[];
type DevOrgPlan = (typeof VALID_ORG_PLANS)[number];

const PLAN_SLUG: Record<DevOrgPlan, string> = {
  tournament:      'dev-tournament-org',
  tournament_plus: 'dev-tplus-org',
  league:          'dev-league-org',
  club:            'dev-club-org',
  club_large:      'dev-club-assoc-org',
};

const PLAN_NAME: Record<DevOrgPlan, string> = {
  tournament:      'Dev Tournament Org',
  tournament_plus: 'Dev Tournament+ Org',
  league:          'Dev League Org',
  club:            'Dev Club Org',
  club_large:      'Dev Club · Association Org',
};

function isValidOrgPlan(plan: unknown): plan is DevOrgPlan {
  return typeof plan === 'string' && VALID_ORG_PLANS.includes(plan as DevOrgPlan);
}

export async function POST(req: Request) {
  const auth = await requireDevToolPlatformAdmin();
  if (auth.response) return auth.response;

  // Parse optional plan param — defaults to 'club' (full access for dev)
  let plan: DevOrgPlan = 'club';
  try {
    const body = await req.json();
    if (body?.plan && isValidOrgPlan(body.plan)) plan = body.plan;
  } catch { /* no body or invalid JSON — use default */ }

  const planConfig = PLAN_CONFIG[plan];
  const devOrgSlug = PLAN_SLUG[plan];
  const devOrgName = PLAN_NAME[plan];
  const log: string[] = [];

  // Org
  let { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', devOrgSlug)
    .maybeSingle();

  if (!org) {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: devOrgName,
        slug: devOrgSlug,
        plan_id: plan,
        tournament_limit: planConfig.tournamentLimit,
        subscription_status: 'active',
        is_public: false,
        enabled_addons: [],
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    org = data;
    log.push(`Created org: ${devOrgName} (plan: ${planConfig.label})`);
  } else {
    // Update plan if caller explicitly requested one
    const { error } = await supabaseAdmin
      .from('organizations')
      .update({ plan_id: plan, tournament_limit: planConfig.tournamentLimit })
      .eq('id', org.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    log.push(`Org already exists — updated to plan: ${planConfig.label}`);
  }

  // Auth user
  const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
  let authUser = userList?.users.find(u => u.email === OWNER_EMAIL);

  if (!authUser) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: OWNER_EMAIL,
      password: DEV_PASSWORD,
      email_confirm: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    authUser = data.user;
    log.push(`Created auth user: ${OWNER_EMAIL}`);
  } else {
    log.push(`Auth user already exists: ${OWNER_EMAIL}`);
  }

  // Org member
  const { data: existing } = await supabaseAdmin
    .from('organization_members')
    .select('id')
    .eq('organization_id', org.id)
    .eq('user_id', authUser!.id)
    .maybeSingle();

  if (!existing) {
    await supabaseAdmin.from('organization_members').insert({
      organization_id: org.id,
      user_id: authUser!.id,
      role: 'owner',
      status: 'active',
      accepted_at: new Date().toISOString(),
    });
    log.push(`Linked ${OWNER_EMAIL} as owner`);
  } else {
    log.push(`Owner membership already exists`);
  }

  return NextResponse.json({ ok: true, log });
}
