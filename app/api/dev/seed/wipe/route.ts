import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getBootstrapAdminEmails, requireDevToolPlatformAdmin } from '@/lib/platform-auth';
import type { User } from '@supabase/supabase-js';

/**
 * Returns UAT account emails from env vars so they are never deleted by a wipe.
 * Reads the same UAT_* vars that the /uat slash command uses — no extra config needed.
 */
function getUATProtectedEmails(): string[] {
  const keys = [
    'UAT_PLATFORM_ADMIN_EMAIL',
    'UAT_ORG_OWNER_EMAIL',
    'UAT_ORG_ADMIN_EMAIL',
    'UAT_COACH_EMAIL',
    'UAT_SCOREKEEPER_EMAIL',
    'UAT_PLUS_SCOREKEEPER_EMAIL',
  ] as const;
  return keys
    .map(k => (process.env[k] ?? '').trim().toLowerCase())
    .filter(Boolean);
}

// ── Single-org wipe ──────────────────────────────────────────────────────────
async function wipeSingleOrg(
  orgId: string,
  allAuthUsers: User[],
  protectedEmails: string[],
): Promise<NextResponse> {
  const log: string[] = [];

  // Safety: fetch the org and check UAT protection
  const { data: org, error: fetchErr } = await supabaseAdmin
    .from('organizations')
    .select('id, slug, internal_notes')
    .eq('id', orgId)
    .maybeSingle();

  if (fetchErr || !org) {
    return NextResponse.json({ error: 'Org not found' }, { status: 404 });
  }
  if (String(org.internal_notes ?? '').includes('[UAT_PROTECTED]')) {
    return NextResponse.json({ error: 'Cannot wipe a UAT-protected org' }, { status: 403 });
  }

  // Capture member user_ids before the cascade removes the rows
  const { data: members } = await supabaseAdmin
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId);
  const memberUserIds = (members ?? []).map(m => m.user_id as string);

  // Delete org — cascades to all child tables
  const { error: deleteErr } = await supabaseAdmin
    .from('organizations')
    .delete()
    .eq('id', orgId);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  log.push(`Deleted org: ${org.slug}`);

  // Clean up @dev.local auth users that now have no org memberships
  let deletedUsers = 0;
  for (const userId of memberUserIds) {
    const user = allAuthUsers.find(u => u.id === userId);
    if (!user?.email?.endsWith('@dev.local')) continue;
    if (protectedEmails.includes(user.email.toLowerCase())) continue;

    // Check whether the user still has any memberships (other orgs)
    const { count } = await supabaseAdmin
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if ((count ?? 0) > 0) continue;

    await supabaseAdmin.auth.admin.deleteUser(userId);
    deletedUsers++;

    // Also clean up the platform_users row if it exists
    await supabaseAdmin
      .from('platform_users')
      .delete()
      .eq('email', user.email.toLowerCase());
  }

  if (deletedUsers > 0) {
    log.push(`Deleted ${deletedUsers} orphaned @dev.local auth user(s)`);
  }

  return NextResponse.json({ ok: true, log });
}

// ── Wipe-all ─────────────────────────────────────────────────────────────────
async function wipeAll(
  allAuthUsers: User[],
  protectedEmails: string[],
): Promise<NextResponse> {
  const log: string[] = [];

  // Orgs: delete everything EXCEPT UAT-protected orgs
  const { data: allOrgs, error: orgFetchErr } = await supabaseAdmin
    .from('organizations')
    .select('id, slug, internal_notes')
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (orgFetchErr) return NextResponse.json({ error: orgFetchErr.message }, { status: 500 });

  const orgIdsToDelete = (allOrgs ?? [])
    .filter(org => !String(org.internal_notes ?? '').includes('[UAT_PROTECTED]'))
    .map(org => org.id);

  const uatOrgs = (allOrgs ?? [])
    .filter(org => String(org.internal_notes ?? '').includes('[UAT_PROTECTED]'))
    .map(org => org.slug);

  if (orgIdsToDelete.length > 0) {
    const { error: orgDeleteErr } = await supabaseAdmin
      .from('organizations')
      .delete()
      .in('id', orgIdsToDelete);
    if (orgDeleteErr) return NextResponse.json({ error: orgDeleteErr.message }, { status: 500 });
  }

  if (uatOrgs.length > 0) {
    log.push(
      `Wiped ${orgIdsToDelete.length} org(s) (cascaded to all child tables) — ` +
      `preserved ${uatOrgs.length} UAT org(s): ${uatOrgs.join(', ')}`
    );
  } else {
    log.push(`Wiped ${orgIdsToDelete.length} org(s) (cascaded to all child tables)`);
  }

  // Platform users: skip protected emails
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

  // Auth users: skip protected emails
  const toDelete = allAuthUsers.filter(u => !protectedEmails.includes((u.email ?? '').toLowerCase()));
  await Promise.all(toDelete.map(u => supabaseAdmin.auth.admin.deleteUser(u.id)));

  const skipped = allAuthUsers.length - toDelete.length;
  if (skipped > 0) {
    log.push(
      `Deleted ${toDelete.length} auth user(s) — preserved ${skipped} protected account(s): ` +
      protectedEmails.join(', ')
    );
  } else {
    log.push(`Deleted ${toDelete.length} auth user(s)`);
  }

  return NextResponse.json({ ok: true, log });
}

// ── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const auth = await requireDevToolPlatformAdmin();
  if (auth.response) return auth.response;

  const protectedEmails = Array.from(new Set([
    ...getBootstrapAdminEmails(),
    auth.user.email?.toLowerCase(),
    ...getUATProtectedEmails(),
  ].filter(Boolean) as string[]));

  // Fetch auth users once — used by both paths
  const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
  const allAuthUsers = userList?.users ?? [];

  // Parse optional orgId for single-org wipe
  let orgId: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.orgId === 'string' && body.orgId) orgId = body.orgId;
  } catch { /* no body or invalid JSON — wipe all */ }

  if (orgId) {
    return wipeSingleOrg(orgId, allAuthUsers, protectedEmails);
  }

  return wipeAll(allAuthUsers, protectedEmails);
}
