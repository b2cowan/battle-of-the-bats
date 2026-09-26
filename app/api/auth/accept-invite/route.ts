import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkCrossOrgJoin, crossOrgJoinRefusalForInvitee } from '@/lib/org-membership-policy';
import { roleLabel, roleOpensSentence } from '@/lib/member-access';
import { invitationSender } from '@/lib/member-names';
import { destinationAfterAccept } from '@/lib/invite-acceptance';
import { withObservability, captureAndJson } from '@/lib/observability';

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
  return orgFromRelation(organizations)?.slug ?? null;
}

function orgFromRelation(organizations: unknown): { slug?: string; name?: string } | null {
  if (Array.isArray(organizations)) {
    return (organizations[0] as { slug?: string; name?: string } | undefined) ?? null;
  }
  return (organizations as { slug?: string; name?: string } | null) ?? null;
}

export const GET = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // The link names its club (J10-010). When the person holds invitations to more than one, read
  // THAT club's — otherwise the page would title itself with whichever row sorted first.
  const linkOrg = new URL(req.url).searchParams.get('org');
  let query = supabaseAdmin
    .from('organization_members')
    .select('role, status, organization_id, organizations!inner(slug, name)')
    .eq('user_id', user.id)
    .in('status', ['invited', 'active']);
  if (linkOrg) query = query.eq('organizations.slug', linkOrg);
  const { data: member } = await query
    .order('status', { ascending: false })
    .limit(1)
    .maybeSingle();

  const org = orgFromRelation(member?.organizations ?? null);
  // ── Added 2026-09-25 (Club Tier Stage 1, specimen 6), additively: the club's NAME, the role's
  // label and sentence, and who sent the invitation — so the page says who is asking and what the
  // role opens. `orgSlug`, `role` and `status` are unchanged.
  const sender = member?.status === 'invited' && member.organization_id
    ? await invitationSender(member.organization_id as string, user.id)
    : null;
  return NextResponse.json({
    ok: true,
    orgSlug: org?.slug ?? null,
    role: member?.role ?? null,
    status: member?.status ?? null,
    orgName: org?.name ?? null,
    roleLabel: member?.role ? roleLabel(member.role) : null,
    roleOpens: member?.role ? roleOpensSentence(member.role) : null,
    inviterName: sender?.name ?? null,
    inviterRole: sender?.role ? roleLabel(sender.role) : null,
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
  // `.maybeSingle()` from erroring on >1 row. The membership rule below (Verified Network) decides
  // whether the join may happen. (The /home pending-invites card accepts multiple invites individually.)
  // The page sends the club from its link (J10-010) so a person invited to two clubs joins the one
  // whose link they followed; without it, the oldest pending invitation (the previous behaviour).
  const linkOrg = typeof body.orgSlug === 'string' && body.orgSlug ? body.orgSlug : null;
  let pending = supabaseAdmin
    .from('organization_members')
    .select('id, role, organization_id, organizations!inner(slug)')
    .eq('user_id', user.id)
    .eq('status', 'invited');
  if (linkOrg) pending = pending.eq('organizations.slug', linkOrg);
  const { data: member } = await pending
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
    const destination = await destinationAfterAccept(user.id, linkOrg ?? orgSlug);
    return NextResponse.json({ ok: true, orgSlug, role, alreadyAccepted: true, destination });
  }

  // ⚖ Verified Network (A03): belonging to another organization no longer blocks joining this one —
  // only a scorekeeper keeps one home organization. (Coaching rows elsewhere never counted.)
  const join = await checkCrossOrgJoin(user.id, member.organization_id, member.role);
  if (join.blocked) {
    return NextResponse.json({ error: crossOrgJoinRefusalForInvitee(join), code: 'one_home_org' }, { status: 409 });
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
    // A13 / J10-007: a named failure the page can act on — it retries ONLY this join (the password
    // is already saved), never asks for a new password, and never moves on as if it had worked.
    return captureAndJson(error, { error: 'We couldn’t add you just now. Try again.', code: 'join_failed' }, 500);
  }

  const orgSlug = orgSlugFromRelation(member.organizations);
  // J10-011: land where this role starts — the same resolver sign-in uses — not a hard-coded /admin.
  const destination = await destinationAfterAccept(user.id, orgSlug);
  return NextResponse.json({ ok: true, orgSlug, role: member.role, destination });
}, { route: '/api/auth/accept-invite' });
