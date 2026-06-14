import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getPlatformUsers } from '@/lib/db';
import { getBootstrapAdminEmails, requirePlatformAreaView, hasPlatformPermission } from '@/lib/platform-auth';
import CustomerUsersClient, { type CustomerUserRow } from './CustomerUsersClient';

export const metadata = { title: 'Customer Users - Platform Admin' };

const PAGE_SIZE = 50;

type MemberRow = {
  user_id: string;
  role: string;
  status: string | null;
  organizations:
    | { id: string; name: string; slug: string; plan_id: string; subscription_status: string | null }
    | { id: string; name: string; slug: string; plan_id: string; subscription_status: string | null }[]
    | null;
};

function cleanQuery(value: string | undefined) {
  return (value ?? '').trim().toLowerCase().slice(0, 120);
}

function displayNameFor(user: User) {
  return (
    (user.user_metadata?.display_name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    ''
  );
}

function authStatusFor(user: User) {
  if (user.banned_until && new Date(user.banned_until) > new Date()) return 'banned';
  if (!user.email_confirmed_at) return 'unconfirmed';
  return 'active';
}

function userMatches(user: User, query: string) {
  const email = user.email?.toLowerCase() ?? '';
  const name = displayNameFor(user).toLowerCase();
  return email.includes(query) || name.includes(query) || user.id.toLowerCase().includes(query);
}

async function getCustomerUsers(
  query: string,
  page: number,
): Promise<{ rows: CustomerUserRow[]; total: number }> {
  const [authRes, membersRes, platformUsers] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabaseAdmin
      .from('organization_members')
      .select('user_id, role, status, organizations(id, name, slug, plan_id, subscription_status)')
      .limit(3000),
    getPlatformUsers(),
  ]);

  const authUsers = authRes.data?.users ?? [];

  // Exclude FieldLogicHQ employees (platform/company users + bootstrap admins).
  // Customer Users is a customer-support surface — staff accounts don't belong here.
  const employeeEmails = new Set(
    [...getBootstrapAdminEmails(), ...platformUsers.map(u => u.email)]
      .map(email => email.toLowerCase()),
  );
  const employeeUserIds = new Set(
    authUsers
      .filter(user => user.email && employeeEmails.has(user.email.toLowerCase()))
      .map(user => user.id),
  );
  const customerAuthUsers = authUsers.filter(user => !employeeUserIds.has(user.id));

  const userMap = new Map(customerAuthUsers.map(user => [user.id, user]));
  const hasQuery = query.length >= 2;
  const matchingAuthIds = hasQuery
    ? new Set(customerAuthUsers.filter(user => userMatches(user, query)).map(user => user.id))
    : new Set(customerAuthUsers.map(user => user.id));
  const rowsByUser = new Map<string, CustomerUserRow>();

  function ensureRow(userId: string): CustomerUserRow {
    const existing = rowsByUser.get(userId);
    if (existing) return existing;

    const user = userMap.get(userId);
    const row: CustomerUserRow = {
      userId,
      email: user?.email ?? '(unknown)',
      displayName: user ? displayNameFor(user) : '',
      authStatus: user ? authStatusFor(user) : 'unknown',
      lastSignIn: user?.last_sign_in_at ?? null,
      memberships: [],
    };
    rowsByUser.set(userId, row);
    return row;
  }

  for (const member of ((membersRes.data ?? []) as unknown as MemberRow[])) {
    if (employeeUserIds.has(member.user_id)) continue;
    const org = Array.isArray(member.organizations) ? member.organizations[0] : member.organizations;
    const orgMatches = hasQuery && org
      ? `${org.name} ${org.slug}`.toLowerCase().includes(query)
      : false;

    if (!matchingAuthIds.has(member.user_id) && !orgMatches) continue;

    const row = ensureRow(member.user_id);
    if (org) {
      row.memberships.push({
        orgId: org.id,
        orgName: org.name,
        orgSlug: org.slug,
        planId: org.plan_id,
        subscriptionStatus: org.subscription_status ?? 'active',
        role: member.role,
        status: member.status ?? 'active',
      });
    }
  }

  for (const userId of matchingAuthIds) ensureRow(userId);

  const allRows = [...rowsByUser.values()].sort((a, b) =>
    a.email.localeCompare(b.email, undefined, { sensitivity: 'base' }),
  );
  const total = allRows.length;
  const start = (page - 1) * PAGE_SIZE;
  return { rows: allRows.slice(start, start + PAGE_SIZE), total };
}

export default async function CustomerUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const auth = await requirePlatformAreaView('customer_users');
  const sp = await searchParams;
  const query = cleanQuery(sp.q);
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const { rows, total } = await getCustomerUsers(query, page);

  // Write actions (reset/ban/edit/notes/etc.) need manage_support; permanent
  // delete is super_admin-only (matches the F1 API guard on the delete route).
  const canManageUsers = hasPlatformPermission(auth.role, 'manage_support');
  const canDelete = auth.role === 'super_admin';

  return (
    <CustomerUsersClient
      initialRows={rows}
      query={sp.q ?? ''}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      canManageUsers={canManageUsers}
      canDelete={canDelete}
    />
  );
}
