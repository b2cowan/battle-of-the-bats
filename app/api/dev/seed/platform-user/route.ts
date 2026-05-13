import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireDevToolPlatformAdmin } from '@/lib/platform-auth';

const PLATFORM_EMAIL = 'platform@dev.local';
const DEV_PASSWORD   = 'devpass123';

export async function POST() {
  const auth = await requireDevToolPlatformAdmin();
  if (auth.response) return auth.response;

  const log: string[] = [];

  // Auth user
  const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
  let authUser = userList?.users.find(u => u.email === PLATFORM_EMAIL);

  if (!authUser) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: PLATFORM_EMAIL,
      password: DEV_PASSWORD,
      email_confirm: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    authUser = data.user;
    log.push(`Created auth user: ${PLATFORM_EMAIL}`);
  } else {
    log.push(`Auth user already exists: ${PLATFORM_EMAIL}`);
  }

  // platform_users row
  const { data: existing } = await supabaseAdmin
    .from('platform_users')
    .select('id')
    .eq('email', PLATFORM_EMAIL)
    .maybeSingle();

  if (!existing) {
    await supabaseAdmin.from('platform_users').insert({
      email: PLATFORM_EMAIL,
      display_name: 'Dev Platform Admin',
      role: 'admin',
      is_active: true,
    });
    log.push(`Created platform_users record`);
  } else {
    log.push(`platform_users record already exists`);
  }

  return NextResponse.json({ ok: true, log });
}
