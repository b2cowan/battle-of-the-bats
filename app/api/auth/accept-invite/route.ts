import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { userBelongsToOtherRealOrg } from '@/lib/org-membership-policy';
import { withObservability } from '@/lib/observability';

async function getAuthenticatedUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function orgSlugFromRelation(organizations: unknown) {
  if (Array.isArray(organizations)) {
    return (organizations[0] as { slug?: string } | undefined)?.slug ?? null;
  }

  return (organizations as { slug?: string } | null)?.slug ?? null;
}

export const GET = withObservability(async () => {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('role, status, organizations(slug)')
    .eq('user_id', user.id)
    .in('status', ['invited', 'active'])
    .order('status', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    orgSlug: orgSlugFromRelation(member?.organizations ?? null),
    role: member?.role ?? null,
    status: member?.status ?? null,
  });
}, { route: '/api/auth/accept-invite' });

export const POST = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim().slice(0, 60) : '';
  const lastName  = typeof body.lastName  === 'string' ? body.lastName.trim().slice(0, 60)  : '';
  const fullName  = `${firstName} ${lastName}`.trim();
  const displayName: string | null = fullName || null;

  // Name parity with org + coach signup: persist the real name on the auth user so
  // platform-admin support views (display_name / full_name) and email greetings
  // (first_name) aren't blank for invited members.
  if (firstName || lastName) {
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { first_name: firstName, last_name: lastName, full_name: fullName, display_name: fullName },
    });
  }

  // Find the pending member row for this user.
  // Use supabaseAdmin to bypass RLS — the user's session may not yet have
  // org-level read access before accepted_at is set.
  // A user can momentarily hold more than one pending 'invited' row (e.g. invited to a club and
  // to their own Coaches Portal stub). Accept the oldest deterministically — `.limit(1)` keeps
  // `.maybeSingle()` from erroring on >1 row. The single-org accept guard below then prevents a
  // second REAL-org join. (The /home pending-invites card accepts multiple invites individually.)
  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('id, role, organization_id, organizations(slug)')
    .eq('user_id', user.id)
    .eq('status', 'invited')
    .order('invited_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!member) {
    // Already accepted or not an invited member — not an error, just a no-op.
    // Try to return their existing accepted membership for redirect purposes.
    const { data: existing } = await supabaseAdmin
      .from('organization_members')
      .select('role, organizations(slug)')
      .eq('user_id', user.id)
      .order('accepted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const orgSlug = orgSlugFromRelation(existing?.organizations ?? null);
    const role = existing?.role ?? null;
    return NextResponse.json({ ok: true, orgSlug, role, alreadyAccepted: true });
  }

  // Single-org by default (decision 2026-06-19): don't let an accept create membership in a
  // SECOND real org. The user's own Coaches Portal is exempt (so a standalone coach can accept a
  // club invite with one login). Closes the long-open "cross-org accept guard".
  if (await userBelongsToOtherRealOrg(user.id, member.organization_id)) {
    return NextResponse.json(
      { error: 'Your account already belongs to another organization. Ask an admin to remove you there before joining this one.' },
      { status: 409 }
    );
  }

  const memberUpdate: Record<string, unknown> = {
    accepted_at: new Date().toISOString(),
    status: 'active',
  };
  if (displayName) memberUpdate.display_name = displayName;

  const { error } = await supabaseAdmin
    .from('organization_members')
    .update(memberUpdate)
    .eq('id', member.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orgSlug = orgSlugFromRelation(member.organizations);
  return NextResponse.json({ ok: true, orgSlug, role: member.role });
}, { route: '/api/auth/accept-invite' });
