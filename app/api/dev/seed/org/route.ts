import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireDevToolPlatformAdmin } from '@/lib/platform-auth';

const DEV_ORG_SLUG  = 'dev-test-org';
const DEV_ORG_NAME  = 'Dev Test Org';
const OWNER_EMAIL   = 'owner@dev.local';
const DEV_PASSWORD  = 'devpass123';

export async function POST() {
  const auth = await requireDevToolPlatformAdmin();
  if (auth.response) return auth.response;

  const log: string[] = [];

  // Org
  let { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', DEV_ORG_SLUG)
    .maybeSingle();

  if (!org) {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: DEV_ORG_NAME,
        slug: DEV_ORG_SLUG,
        plan_id: 'club',
        tournament_limit: 9999,
        subscription_status: 'active',
        is_public: false,
        enabled_addons: [],
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    org = data;
    log.push(`Created org: ${DEV_ORG_NAME}`);
  } else {
    log.push(`Org already exists: ${DEV_ORG_NAME}`);
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
