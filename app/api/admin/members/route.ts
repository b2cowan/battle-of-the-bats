import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, requireCapability } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContext({ orgSlug });
  if (!ctx) return unauthorized();

  // The roster exposes every member's email, capability map, and last sign-in — that is
  // members-management data, so gate it like the page does. Without this, any non-suspended
  // member (scorekeeper, staff, even a still-invited member) could read it (audit J10-002).
  const capErr = await requireCapability(ctx, 'module_members');
  if (capErr) return capErr;

  const { org } = ctx;

  const { data: members, error: membersError } = await supabaseAdmin
    .from('organization_members')
    .select('id, user_id, role, capabilities, invited_at, accepted_at, status, display_name, title')
    .eq('organization_id', org.id);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  if (!members || members.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch user details from auth.admin — cannot JOIN auth.users via postgrest
  const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  });

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  // Batch-fetch tournament assignments for all members
  const memberIds = members.map(m => m.id);
  const [{ data: allAssignments }, { data: allRepGroupScopes }] = await Promise.all([
    supabaseAdmin
      .from('org_member_tournament_assignments')
      .select('org_member_id, tournament_id')
      .in('org_member_id', memberIds),
    supabaseAdmin
      .from('org_member_rep_group_scopes')
      .select('member_id, group_id')
      .in('member_id', memberIds),
  ]);

  const assignmentMap = new Map<string, string[]>();
  for (const a of allAssignments ?? []) {
    const arr = assignmentMap.get(a.org_member_id) ?? [];
    arr.push(a.tournament_id);
    assignmentMap.set(a.org_member_id, arr);
  }

  const repGroupScopeMap = new Map<string, string[]>();
  for (const s of allRepGroupScopes ?? []) {
    const arr = repGroupScopeMap.get(s.member_id) ?? [];
    arr.push(s.group_id);
    repGroupScopeMap.set(s.member_id, arr);
  }

  const userMap = new Map(usersData.users.map(u => [u.id, u]));

  const result = members.map(m => {
    const authUser = userMap.get(m.user_id);
    return {
      id:                    m.id,
      userId:                m.user_id,
      email:                 authUser?.email ?? '(unknown)',
      displayName:           (m as any).display_name ?? null,
      title:                 (m as any).title ?? null,
      role:                  m.role,
      status:                (m.status as 'invited' | 'active' | 'suspended') ?? 'active',
      capabilities:          (m.capabilities as Record<string, boolean> | null) ?? null,
      invitedAt:             m.invited_at,
      acceptedAt:            m.accepted_at ?? null,
      lastSignIn:            authUser?.last_sign_in_at ?? null,
      assignedTournamentIds: assignmentMap.get(m.id) ?? [],
      repGroupIds:           repGroupScopeMap.get(m.id) ?? [],
    };
  });

  return NextResponse.json(result);
}, { route: '/api/admin/members' });
