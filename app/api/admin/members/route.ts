import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { org } = ctx;

  const { data: members, error: membersError } = await supabaseAdmin
    .from('organization_members')
    .select('id, user_id, role, capabilities, invited_at, accepted_at, status')
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
  const { data: allAssignments } = await supabaseAdmin
    .from('org_member_tournament_assignments')
    .select('org_member_id, tournament_id')
    .in('org_member_id', memberIds);

  const assignmentMap = new Map<string, string[]>();
  for (const a of allAssignments ?? []) {
    const arr = assignmentMap.get(a.org_member_id) ?? [];
    arr.push(a.tournament_id);
    assignmentMap.set(a.org_member_id, arr);
  }

  const userMap = new Map(usersData.users.map(u => [u.id, u]));

  const result = members.map(m => {
    const authUser = userMap.get(m.user_id);
    return {
      id:                   m.id,
      userId:               m.user_id,
      email:                authUser?.email ?? '(unknown)',
      role:                 m.role,
      status:               (m.status as 'invited' | 'active' | 'suspended') ?? 'active',
      capabilities:         (m.capabilities as Record<string, boolean> | null) ?? null,
      invitedAt:            m.invited_at,
      acceptedAt:           m.accepted_at ?? null,
      lastSignIn:           authUser?.last_sign_in_at ?? null,
      assignedTournamentIds: assignmentMap.get(m.id) ?? [],
    };
  });

  return NextResponse.json(result);
}
