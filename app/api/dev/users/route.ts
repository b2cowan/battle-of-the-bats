import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getBootstrapAdminEmails, requireDevToolUserAuth } from '@/lib/platform-auth';

export interface DevUser {
  userId: string;
  email: string;
  ownedOrgs: { orgId: string; slug: string; planId: string }[];
  otherMemberships: { orgId: string; slug: string; role: string }[];
}

function getProtectedEmails(currentUserEmail: string | undefined): string[] {
  const uatKeys = [
    'UAT_PLATFORM_ADMIN_EMAIL', 'UAT_ORG_OWNER_EMAIL', 'UAT_ORG_ADMIN_EMAIL',
    'UAT_COACH_EMAIL', 'UAT_SCOREKEEPER_EMAIL', 'UAT_PLUS_SCOREKEEPER_EMAIL',
  ] as const;
  const uatEmails = uatKeys
    .map(k => (process.env[k] ?? '').trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([
    ...getBootstrapAdminEmails(),
    ...(currentUserEmail ? [currentUserEmail.toLowerCase()] : []),
    ...uatEmails,
  ].filter(Boolean)));
}

export async function GET() {
  const auth = await requireDevToolUserAuth();
  if (auth.response) return auth.response;

  const protectedEmails = getProtectedEmails(auth.user.email);

  const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const allUsers = (authData?.users ?? []).filter(
    u => !protectedEmails.includes((u.email ?? '').toLowerCase()),
  );

  const { data: memberRows } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, user_id, role, organizations(id, slug, plan_id)')
    .eq('status', 'active');

  const membershipMap = new Map<string, { orgId: string; slug: string; planId: string; role: string }[]>();
  for (const row of memberRows ?? []) {
    const org = row.organizations as { id?: string; slug?: string; plan_id?: string } | null;
    if (!org?.slug) continue;
    if (!membershipMap.has(row.user_id)) membershipMap.set(row.user_id, []);
    membershipMap.get(row.user_id)!.push({
      orgId:  org.id ?? row.organization_id,
      slug:   org.slug,
      planId: org.plan_id ?? 'tournament',
      role:   row.role,
    });
  }

  const users: DevUser[] = allUsers.map(u => {
    const memberships = membershipMap.get(u.id) ?? [];
    return {
      userId: u.id,
      email:  u.email ?? u.id,
      ownedOrgs: memberships
        .filter(m => m.role === 'owner')
        .map(m => ({ orgId: m.orgId, slug: m.slug, planId: m.planId })),
      otherMemberships: memberships
        .filter(m => m.role !== 'owner')
        .map(m => ({ orgId: m.orgId, slug: m.slug, role: m.role })),
    };
  }).sort((a, b) => a.email.localeCompare(b.email));

  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const auth = await requireDevToolUserAuth();
  if (auth.response) return auth.response;

  const protectedEmails = getProtectedEmails(auth.user.email);

  let userId: string;
  try {
    const body = await req.json() as { userId?: unknown };
    if (typeof body?.userId !== 'string' || !body.userId) throw new Error();
    userId = body.userId;
  } catch {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (!userData?.user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const email = userData.user.email ?? '';
  if (protectedEmails.includes(email.toLowerCase())) {
    return NextResponse.json({ error: 'Cannot delete a protected account' }, { status: 403 });
  }

  const log: string[] = [];

  // Delete owned orgs — cascade handles all child data
  const { data: ownedRows } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, organizations(slug)')
    .eq('user_id', userId)
    .eq('role', 'owner');

  const orgIds = (ownedRows ?? []).map(r => r.organization_id as string);
  if (orgIds.length > 0) {
    const slugs = (ownedRows ?? []).map(r => {
      const org = r.organizations as { slug?: string } | null;
      return org?.slug ?? r.organization_id;
    });
    const { error: orgErr } = await supabaseAdmin
      .from('organizations')
      .delete()
      .in('id', orgIds);
    if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 });
    log.push(`Deleted ${orgIds.length} owned org(s): ${slugs.join(', ')}`);
  }

  // Clean up platform_users row if present
  if (email) {
    await supabaseAdmin.from('platform_users').delete().eq('email', email.toLowerCase());
  }

  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });
  log.push(`Deleted auth user: ${email || userId}`);

  return NextResponse.json({ ok: true, log });
}
