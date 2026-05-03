import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { org } = ctx;

  // Fetch all members for this org
  const { data: members, error: membersError } = await supabaseAdmin
    .from('organization_members')
    .select('id, user_id, role, invited_at, accepted_at')
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

  const userMap = new Map(usersData.users.map(u => [u.id, u]));

  const result = members.map(m => {
    const authUser = userMap.get(m.user_id);
    return {
      id: m.id,
      userId: m.user_id,
      email: authUser?.email ?? '(unknown)',
      role: m.role,
      invitedAt: m.invited_at,
      acceptedAt: m.accepted_at ?? null,
      lastSignIn: authUser?.last_sign_in_at ?? null,
    };
  });

  return NextResponse.json(result);
}
