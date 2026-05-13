import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getBootstrapAdminEmails, requireDevToolPlatformAdmin } from '@/lib/platform-auth';

export async function POST() {
  const auth = await requireDevToolPlatformAdmin();
  if (auth.response) return auth.response;

  const log: string[] = [];

  // Emails that are never wiped — these are real operator accounts
  const protectedEmails = getBootstrapAdminEmails();

  // Delete all orgs (cascades to all child tables via FK)
  const { error: orgErr } = await supabaseAdmin
    .from('organizations')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 });
  log.push('Wiped all organizations (cascaded to all child tables)');

  // Delete platform_users rows — skip protected emails
  const { data: platformRows, error: platformFetchErr } = await supabaseAdmin
    .from('platform_users')
    .select('id, email');
  if (platformFetchErr) return NextResponse.json({ error: platformFetchErr.message }, { status: 500 });

  const platformIdsToDelete = (platformRows ?? [])
    .filter(row => !protectedEmails.includes((row.email ?? '').toLowerCase()))
    .map(row => row.id);

  if (platformIdsToDelete.length > 0) {
    const { error: platformDeleteErr } = await supabaseAdmin
      .from('platform_users')
      .delete()
      .in('id', platformIdsToDelete);
    if (platformDeleteErr) return NextResponse.json({ error: platformDeleteErr.message }, { status: 500 });
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
