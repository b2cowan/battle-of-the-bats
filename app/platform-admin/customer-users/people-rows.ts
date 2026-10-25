/**
 * People's rows, read on the server (Support console Stage 2, owner ruling A8): every customer account, paged in the
 * database through the sign-in lookup (migration 365) — no 1,000 cap — with each person's clubs. Shared by the page's first
 * render and the list's search route, so both draw the same row.
 */
import { supabaseAdmin } from '@/lib/supabase-admin';
import { personAuthStatus, searchPeople, type PersonAuthStatus } from '@/lib/platform-people-lookup';

export const PEOPLE_PAGE_SIZE = 50;

export type PeopleRow = {
  userId: string;
  email: string;
  displayName: string;
  authStatus: PersonAuthStatus;
  lastSignIn: string | null;
  /** Watch-only safeguard: # of LIVE Premium Coaches Portals this account owns (>1 = flagged). */
  livePortalCount: number;
  memberships: {
    orgId: string;
    orgName: string;
    orgSlug: string;
    planId: string;
    subscriptionStatus: string;
    role: string;
    status: string;
  }[];
};

type MemberRow = {
  user_id: string;
  role: string;
  status: string | null;
  organizations: { id: string; name: string; slug: string; plan_id: string; subscription_status: string | null } | null;
};

export const PEOPLE_STATUSES: readonly PersonAuthStatus[] = ['active', 'unconfirmed', 'banned'];

export function cleanPeopleQuery(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 120) : '';
}

export async function readPeoplePage(opts: { query: string; status: PersonAuthStatus | null; page: number }): Promise<{ rows: PeopleRow[]; total: number }> {
  const page = Math.max(1, Math.floor(opts.page) || 1);
  const { rows: people, total } = await searchPeople({
    query: opts.query.length >= 2 ? opts.query : '',
    status: opts.status,
    offset: (page - 1) * PEOPLE_PAGE_SIZE,
    limit: PEOPLE_PAGE_SIZE,
    matchClubs: true,
  });
  const ids = people.map(p => p.id);
  const [membersRes, portalsRes] = ids.length === 0
    ? [{ data: [] }, { data: [] }]
    : await Promise.all([
      supabaseAdmin
        .from('organization_members')
        .select('user_id, role, status, organizations(id, name, slug, plan_id, subscription_status)')
        .in('user_id', ids)
        .limit(2000),
      // Watch-only one-portal safeguard (detect, NEVER block): each owner's LIVE Premium Coaches Portals.
      supabaseAdmin
        .from('team_workspaces')
        .select('primary_owner_user_id')
        .in('subscription_status', ['active', 'trialing', 'past_due'])
        .in('primary_owner_user_id', ids)
        .limit(2000),
    ]);

  const memberships = new Map<string, PeopleRow['memberships']>();
  for (const m of (membersRes.data ?? []) as unknown as MemberRow[]) {
    const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
    if (!org) continue;
    const list = memberships.get(m.user_id) ?? [];
    list.push({
      orgId: org.id,
      orgName: org.name,
      orgSlug: org.slug,
      planId: org.plan_id,
      subscriptionStatus: org.subscription_status ?? 'active',
      role: m.role,
      status: m.status ?? 'active',
    });
    memberships.set(m.user_id, list);
  }
  const portals = new Map<string, number>();
  for (const w of (portalsRes.data ?? []) as Array<{ primary_owner_user_id: string | null }>) {
    if (w.primary_owner_user_id) portals.set(w.primary_owner_user_id, (portals.get(w.primary_owner_user_id) ?? 0) + 1);
  }

  return {
    total,
    rows: people.map(p => ({
      userId: p.id,
      email: p.email,
      displayName: p.displayName ?? '',
      authStatus: personAuthStatus(p),
      lastSignIn: p.lastSignInAt,
      livePortalCount: portals.get(p.id) ?? 0,
      memberships: memberships.get(p.id) ?? [],
    })),
  };
}
