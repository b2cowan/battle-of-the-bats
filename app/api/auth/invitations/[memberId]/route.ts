import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { userBelongsToOtherRealOrg } from '@/lib/org-membership-policy';
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

type Params = { params: Promise<{ memberId: string }> };

function orgSlugFromRelation(rel: unknown): string | null {
  if (Array.isArray(rel)) return (rel[0] as { slug?: string } | undefined)?.slug ?? null;
  return (rel as { slug?: string } | null)?.slug ?? null;
}

// POST /api/auth/invitations/[memberId] — accept ({action:'accept'}) or decline
// ({action:'decline'}) a pending invitation the SESSION user owns.
//
// SECURITY: the target row must be status='invited' AND user_id === the session user.
// We never trust the memberId alone — it is always re-scoped to the authenticated
// user_id, so one user cannot accept/decline another's invite by guessing an id.
// (Reconciliation has already re-pointed any email-matched invite onto this user_id.)
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { memberId } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action === 'decline' ? 'decline' : body?.action === 'accept' ? 'accept' : null;
  if (!action) {
    return NextResponse.json({ error: "action must be 'accept' or 'decline'" }, { status: 400 });
  }

  // Re-scope to the session identity: the invite must be theirs and still pending.
  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('id, role, organization_id, display_name, organizations(slug)')
    .eq('id', memberId)
    .eq('user_id', user.id)
    .eq('status', 'invited')
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: 'Invitation not found or already handled' }, { status: 404 });
  }

  if (action === 'decline') {
    // Decline = remove the pending row. No 'declined' status (keeps the status CHECK
    // at invited|active|suspended). The orphaned invite-only auth user is left as-is.
    const { error } = await supabaseAdmin
      .from('organization_members')
      .delete()
      .eq('id', member.id)
      .eq('user_id', user.id)
      .eq('status', 'invited');
    if (error) {
      return captureAndJson(error, { error: error.message }, 500);
    }
    return NextResponse.json({ ok: true, declined: true });
  }

  // Single-org by default (decision 2026-06-19): don't accept into a SECOND real org. The user's
  // own Coaches Portal is exempt (one-login coach+club). Closes the long-open cross-org accept guard.
  if (await userBelongsToOtherRealOrg(user.id, member.organization_id)) {
    return NextResponse.json(
      { error: 'Your account already belongs to another organization. Ask an admin to remove you there before joining this one.' },
      { status: 409 }
    );
  }

  // Accept: flip to active. Mirrors /api/auth/accept-invite POST, but targets this
  // specific invite id (the card may show several). Backfill display_name from the
  // logged-in user's auth metadata if the member row has none, so card-accepted members
  // aren't blank in support/member views and email greetings (the card — unlike the
  // accept-invite form — doesn't collect a name, but the user already has one from signup).
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const metaName = [meta.full_name, meta.display_name, meta.name]
    .find((v): v is string => typeof v === 'string' && v.trim().length > 0)
    ?.trim()
    .slice(0, 60);

  const memberUpdate: Record<string, unknown> = {
    accepted_at: new Date().toISOString(),
    status: 'active',
  };
  if (!member.display_name && metaName) memberUpdate.display_name = metaName;

  const { error } = await supabaseAdmin
    .from('organization_members')
    .update(memberUpdate)
    .eq('id', member.id)
    .eq('user_id', user.id)
    .eq('status', 'invited');

  if (error) {
    return captureAndJson(error, { error: error.message }, 500);
  }

  return NextResponse.json({
    ok: true,
    accepted: true,
    orgSlug: orgSlugFromRelation(member.organizations),
    role: member.role,
  });
}, { route: '/api/auth/invitations/[memberId]' });
