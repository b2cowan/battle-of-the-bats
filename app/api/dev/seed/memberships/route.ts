import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireDevToolUserAuth } from '@/lib/platform-auth';

export interface OrgMember {
  userId: string;
  email:  string;
  role:   string;
}

export interface OrgWithMembers {
  orgId:   string;
  slug:    string;
  name:    string;
  planId:  string;
  members: OrgMember[];
}

export interface UserWithOrgs {
  userId: string;
  email:  string;
  orgs: {
    orgId:  string;
    slug:   string;
    name:   string;
    planId: string;
    role:   string;
  }[];
}

export interface MembershipData {
  byOrg:  OrgWithMembers[];
  byUser: UserWithOrgs[];
}

export async function GET() {
  const auth = await requireDevToolUserAuth();
  if (auth.response) return auth.response;

  // 1. All active org memberships with org info
  const { data: rows, error } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, user_id, role, organizations(id, slug, name, plan_id)')
    .eq('status', 'active')
    .order('organization_id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2. All auth users — build userId → email map
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map<string, string>(
    (authData?.users ?? []).map(u => [u.id, u.email ?? u.id])
  );

  // 3. Build byOrg index
  const orgMap = new Map<string, OrgWithMembers>();
  for (const row of rows ?? []) {
    const orgRaw = row.organizations as { id?: string; slug?: string; name?: string; plan_id?: string } | null;
    if (!orgRaw?.slug) continue;

    const orgId  = orgRaw.id  ?? row.organization_id;
    const slug   = orgRaw.slug ?? '';
    const name   = orgRaw.name ?? slug;
    const planId = orgRaw.plan_id ?? 'tournament';

    if (!orgMap.has(orgId)) {
      orgMap.set(orgId, { orgId, slug, name, planId, members: [] });
    }
    orgMap.get(orgId)!.members.push({
      userId: row.user_id,
      email:  emailMap.get(row.user_id) ?? row.user_id,
      role:   row.role,
    });
  }

  // 4. Build byUser index
  const userMap = new Map<string, UserWithOrgs>();
  for (const row of rows ?? []) {
    const orgRaw = row.organizations as { id?: string; slug?: string; name?: string; plan_id?: string } | null;
    if (!orgRaw?.slug) continue;

    const userId = row.user_id;
    const email  = emailMap.get(userId) ?? userId;
    if (!userMap.has(userId)) {
      userMap.set(userId, { userId, email, orgs: [] });
    }
    userMap.get(userId)!.orgs.push({
      orgId:  orgRaw.id  ?? row.organization_id,
      slug:   orgRaw.slug ?? '',
      name:   orgRaw.name ?? orgRaw.slug ?? '',
      planId: orgRaw.plan_id ?? 'tournament',
      role:   row.role,
    });
  }

  // 5. Sort users: known seed emails first, then alphabetically
  const SEED_ORDER = [
    'owner@dev.local', 'admin@dev.local', 'staff@dev.local',
    'coach@dev.local', 'league-admin@dev.local', 'treasurer@dev.local',
    'platform@dev.local',
  ];
  const byUser = [...userMap.values()].sort((a, b) => {
    const ai = SEED_ORDER.indexOf(a.email);
    const bi = SEED_ORDER.indexOf(b.email);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.email.localeCompare(b.email);
  });

  // Sort orgs alphabetically by slug
  const byOrg = [...orgMap.values()].sort((a, b) => a.slug.localeCompare(b.slug));

  return NextResponse.json({ byOrg, byUser } satisfies MembershipData);
}
