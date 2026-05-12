import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST() {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const log: string[] = [];

  // Delete all orgs (cascades to all child tables via FK)
  const { error: orgErr } = await supabaseAdmin
    .from('organizations')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 });
  log.push('Wiped all organizations (cascaded to all child tables)');

  // Delete platform users
  await supabaseAdmin
    .from('platform_users')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  log.push('Wiped platform_users');

  // Delete all auth users
  const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
  const users = userList?.users ?? [];
  await Promise.all(users.map(u => supabaseAdmin.auth.admin.deleteUser(u.id)));
  log.push(`Deleted ${users.length} auth users`);

  return NextResponse.json({ ok: true, log });
}
