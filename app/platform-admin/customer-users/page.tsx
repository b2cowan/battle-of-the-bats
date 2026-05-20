import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import CustomerUsersClient, { type CustomerUserRow } from './CustomerUsersClient';

export const metadata = { title: 'Customer Users - Platform Admin' };

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

async function getCustomerUsers(query: string): Promise<CustomerUserRow[]> {
  if (query.length < 2) return [];

  const [authRes, membersRes] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabaseAdmin
      .from('organization_members')
      .select('user_id, role, status, organizations(id, name, slug, plan_id, subscription_status)')
      .limit(3000),
  ]);

  const authUsers = authRes.data?.users ?? [];
  const userMap = new Map(authUsers.map(user => [user.id, user]));
  const matchingAuthIds = new Set(authUsers.filter(user => userMatches(user, query)).map(user => user.id));
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
    const org = Array.isArray(member.organizations) ? member.organizations[0] : member.organizations;
    const orgMatches = org
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

  return [...rowsByUser.values()].sort((a, b) =>
    a.email.localeCompare(b.email, undefined, { sensitivity: 'base' })
  );
}

export default async function CustomerUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const query = cleanQuery(sp.q);
  const rows = await getCustomerUsers(query);

  return (
    <CustomerUsersClient
      initialRows={rows}
      query={sp.q ?? ''}
      searched={query.length >= 2}
    />
  );
}
