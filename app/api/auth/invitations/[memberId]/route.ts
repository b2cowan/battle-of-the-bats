import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkCrossOrgJoin, crossOrgJoinRefusalForInvitee } from '@/lib/org-membership-policy';
import { destinationAfterAccept } from '@/lib/invite-acceptance';
import { withObservability, captureAndJson } from '@/lib/observability';
import { getSignedInUser } from '@/lib/two-step-session';
import { startTwoStepGrace } from '@/lib/two-step-grace';
import { isDemoOrganizerEmail } from '@/lib/demo-org';
import { PENDING_INVITATION_FILTER, WAITING_ROLE_CLEARED, waitingBoardRole } from '@/lib/waiting-board-role';
import { invitationSender } from '@/lib/member-names';
import { roleLabel } from '@/lib/member-access';
import { accountNameOf } from '@/lib/family-invitation';
import { notify } from '@/lib/notify';
import { invitationHasLapsed, invitationLapseCutoff, lapsedInvitationMessage } from '@/lib/invitation-lapse';
import { orgFromRelation } from '@/lib/invite-reconciliation';
import { getMembersHref } from '@/lib/billing-urls';
import { effectiveOrgFactsForId } from '@/lib/entitlement-grants';

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
  const user = await getSignedInUser(supabase);
  return user;
}

type Params = { params: Promise<{ memberId: string }> };

/**
 * A decline TELLS THE CLUB (owner 2026-11-18). Before this the pending row was deleted and nobody was told: the
 * invitation just vanished from Members, while a club's coach invitation already told its sender
 * (`club_coach_declined`). The bell reaches whoever sent it — the audit log's `member_invited` row, the one record
 * that names the sender — or, when that person is no longer an active member (or the invitation predates the log),
 * the club's owners. Best-effort: the decline has already happened, so a failed notice never undoes or errors it.
 */
async function tellClubMemberInviteDeclined(
  member: { role: string; organization_id: string; display_name: string | null; organizations: unknown },
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null },
): Promise<void> {
  try {
    const orgId = member.organization_id;
    const sender = await invitationSender(orgId, user.id);
    const { data: active } = await supabaseAdmin
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', orgId)
      .eq('status', 'active');
    const activeRows = (active ?? []) as { user_id: string; role: string }[];
    const recipients = sender.userId && activeRows.some(r => r.user_id === sender.userId)
      ? [sender.userId]
      : activeRows.filter(r => r.role === 'owner').map(r => r.user_id);
    const ids = recipients.filter(id => id !== user.id);
    if (ids.length === 0) return;
    const who = member.display_name?.trim() || accountNameOf(user.user_metadata) || user.email || 'Someone';
    const slug = orgSlugFromRelation(member.organizations);
    // Members where the plan keeps it (a Tournament plan's is under the tournament's settings: the org address would
    // send its owner to the Tournaments list — Retire the old tournament-only menu, found on the way 2). The plan right
    // now, through the door: a Tournament plan on free Club time has the Organization's Members. A failed read costs the
    // link's precision (the Organization's Members), never the notice.
    const planId = (await effectiveOrgFactsForId(orgId).catch(() => null))?.planId ?? null;
    await notify({
      orgId,
      eventType: 'member_invite_declined',
      title: `${who} declined your invitation`,
      body: `They won’t join as ${roleLabel(member.role)}.`,
      userIds: ids,
      excludeUserIds: [user.id],
      link: slug ? getMembersHref(slug, planId) : undefined,
    });
  } catch { /* the notice is best-effort */ }
}

function orgSlugFromRelation(rel: unknown): string | null {
  if (Array.isArray(rel)) return (rel[0] as { slug?: string } | undefined)?.slug ?? null;
  return (rel as { slug?: string } | null)?.slug ?? null;
}
// POST /api/auth/invitations/[memberId] — accept ({action:'accept'}) or decline
// ({action:'decline'}) a pending invitation the SESSION user owns.
//
// SECURITY: the target row must be status='invited' (or a coach row with a waiting board role, P2b) AND user_id === the
// session user.
// We never trust the memberId alone — it is always re-scoped to the authenticated
// user_id, so one user cannot accept/decline another's invite by guessing an id.
// (Reconciliation has already re-pointed any email-matched invite onto this user_id.)
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // A "See it live" demo's shared account never joins a club (trust close-out 13): every anonymous visitor is signed in as
  // it. The invite route refuses to write such a row; this refuses one that exists anyway.
  if (isDemoOrganizerEmail(user.email)) {
    return NextResponse.json({ error: 'A demo account can’t join a club.', code: 'demo_account' }, { status: 403 });
  }

  const { memberId } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action === 'decline' ? 'decline' : body?.action === 'accept' ? 'accept' : null;
  if (!action) {
    return NextResponse.json({ error: "action must be 'accept' or 'decline'" }, { status: 400 });
  }

  // Re-scope to the session identity: the invite must be theirs and still pending — a pending row, or a club's coach row
  // with a board role WAITING on it (trust close-out 13 P2b, mig 503).
  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('id, role, status, organization_id, display_name, invited_at, pending_role, pending_capabilities, pending_invited_at, organizations(slug, name)')
    .eq('id', memberId)
    .eq('user_id', user.id)
    .or(PENDING_INVITATION_FILTER)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: 'Invitation not found or already handled' }, { status: 404 });
  }

  // ⚖ A club's coach offered a board role (P2b): the row is their coaching, so a decline clears the waiting role and never
  // deletes the row, and an accept moves the waiting role onto it. Everything else about the answer is the same as a
  // pending row's, and is said once below with `offeredRole` — the role the person was shown.
  const waiting = waitingBoardRole(member);
  const offeredRole = waiting ?? (member.role as string);

  if (action === 'decline') {
    if (waiting) {
      const { data: cleared, error } = await supabaseAdmin
        .from('organization_members')
        .update(WAITING_ROLE_CLEARED)
        .eq('id', member.id)
        .eq('user_id', user.id)
        .eq('role', 'coach')
        // The offer read, never a newer one sent since (/review): a decline must not clear an offer the person never saw.
        .eq('pending_role', waiting)
        .eq('pending_invited_at', member.pending_invited_at)
        .select('id');
      if (error) return captureAndJson(error, { error: error.message }, 500);
      if (!cleared?.length) return NextResponse.json({ error: 'Invitation not found or already handled' }, { status: 404 });
    } else {
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
    }
    // The club is told, naming the role offered (for a coach, the one that was WAITING, never 'coach').
    await tellClubMemberInviteDeclined({ ...member, role: offeredRole }, user);
    return NextResponse.json({ ok: true, declined: true });
  }

  // ⚖ A run-out invitation can't be accepted (P2c, lib/invitation-lapse.ts): 30 days from its last send. (A decline above
  // is still taken: it only ends what the club would otherwise sweep.)
  if (invitationHasLapsed(waiting ? member.pending_invited_at : member.invited_at)) {
    return NextResponse.json({ error: lapsedInvitationMessage(orgFromRelation(member.organizations as Parameters<typeof orgFromRelation>[0])?.name), code: 'invitation_lapsed' }, { status: 410 });
  }

  // A yes is to the role the person was SHOWN (trust close-out 13, /review): the club can still change a pending row's role,
  // so if it moved after their card loaded, nothing is accepted and they are asked to reload and see the new one. (A request
  // without a role — an older page — is taken as before.)
  if (typeof body?.role === 'string' && body.role !== offeredRole) {
    return NextResponse.json({ error: 'This invitation changed since you opened it. Reload the page to see it as it is now.', code: 'invitation_changed' }, { status: 409 });
  }

  // ⚖ Verified Network (A03): belonging to another organization no longer blocks joining this one —
  // only a scorekeeper keeps one home organization. (Coaching rows elsewhere never counted.)
  const join = await checkCrossOrgJoin(user.id, member.organization_id, offeredRole);
  if (join.blocked) {
    return NextResponse.json({ error: crossOrgJoinRefusalForInvitee(join), code: 'one_home_org' }, { status: 409 });
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

  // A coach's waiting board role moves onto their (already active) row and is cleared; a pending row turns active.
  const memberUpdate: Record<string, unknown> = waiting
    ? { role: waiting, capabilities: member.pending_capabilities ?? null, accepted_at: new Date().toISOString(), ...WAITING_ROLE_CLEARED }
    : { accepted_at: new Date().toISOString(), status: 'active' };
  if (!member.display_name && metaName) memberUpdate.display_name = metaName;

  // Guarded on what was read, so a Cancel or another answer in between leaves nothing accepted.
  const write = supabaseAdmin
    .from('organization_members')
    .update(memberUpdate)
    .eq('id', member.id)
    .eq('user_id', user.id);
  const { data: accepted, error } = await (waiting
    // The offer read, to its date (/review): a Cancel and a new offer of the same role with other access in between leaves
    // nothing accepted, rather than the withdrawn access.
    ? write.eq('role', 'coach').eq('pending_role', waiting).eq('pending_invited_at', member.pending_invited_at)
    : write.eq('status', 'invited').gte('invited_at', invitationLapseCutoff())
  ).select('id');

  if (error) {
    return captureAndJson(error, { error: error.message }, 500);
  }
  if (!accepted?.length) {
    return NextResponse.json({ error: 'Invitation not found or already handled' }, { status: 404 });
  }

  // Two-step (Board Ready, Part 3): a seat the club already requires gets its own 14 days from today.
  await startTwoStepGrace(user.id, member.organization_id, offeredRole);

  const orgSlug = orgSlugFromRelation(member.organizations);
  return NextResponse.json({
    ok: true,
    accepted: true,
    orgSlug,
    role: offeredRole,
    // J10-011 (added 2026-09-25): where this role starts — the resolver sign-in uses.
    destination: await destinationAfterAccept(user.id, orgSlug),
  });
}, { route: '/api/auth/invitations/[memberId]' });
