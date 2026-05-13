import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST() {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const log: string[] = [];

  // Emails that are never wiped — these are real operator accounts
  const protectedEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  // Delete all orgs (cascades to all child tables via FK)
  const { error: orgErr } = await supabaseAdmin
    .from('organizations')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 });
  log.push('Wiped all organizations (cascaded to all child tables)');

  // Delete platform_users rows — skip protected emails
  if (protectedEmails.length > 0) {
    await supabaseAdmin
      .from('platform_users')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .not('email', 'in', `(${protectedEmails.join(',')})`);
  } else {
    await supabaseAdmin
      .from('platform_users')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
  }
  log.push('Wiped platform_users (protected accounts preserved)');

  // Delete all auth users except protected emails
  const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
  const users    = userList?.users ?? [];
  const toDelete = users.filter(u => !protectedEmails.includes((u.email ?? '').toLowerCase()));
  await Promise.all(toDelete.map(u => supabaseAdmin.auth.admin.deleteUser(u.id)));

  if (protectedEmails.length > 0 && users.length !== toDelete.length) {
    const skipped = users.length - toDelete.length;
    log.push(`Deleted ${toDelete.length} auth users — preserved ${skipped} protected account${skipped !== 1 ? 's' : ''}: ${protectedEmails.join(', ')}`);
  } else {
    log.push(`Deleted ${toDelete.length} auth users`);
  }

  return NextResponse.json({ ok: true, log });
}
