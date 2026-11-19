import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkCrossOrgJoin, crossOrgJoinRefusalForInvitee } from '@/lib/org-membership-policy';
import { roleLabel, memberOpensSentence } from '@/lib/member-access';
import { invitationSender } from '@/lib/member-names';
import { destinationAfterAccept } from '@/lib/invite-acceptance';
import { withObservability, captureAndJson } from '@/lib/observability';
import { accountDoorRefusal, checkAcceptance, recordDoorAcceptance } from '@/lib/legal-acceptance';
import { getSignedInUser } from '@/lib/two-step-session';
import { startTwoStepGrace } from '@/lib/two-step-grace';
import { isDemoOrganizerEmail } from '@/lib/demo-org';
import { invitationHasLapsed, invitationLapseCutoff, lapsedInvitationMessage } from '@/lib/invitation-lapse';

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

function orgSlugFromRelation(organizations: unknown) {
  return orgFromRelation(organizations)?.slug ?? null;
}

function orgFromRelation(organizations: unknown): { slug?: string; name?: string } | null {
  if (Array.isArray(organizations)) {
    return (organizations[0] as { slug?: string; name?: string } | undefined) ?? null;
  }
  return (organizations as { slug?: string; name?: string } | null) ?? null;
}

/** The code both doors answer when the club must be chosen (leftover call 12); the page reads `clubs`. */
const CHOOSE_CLUB = 'choose_club';

/**
 * The clubs whose invitation to this person is LIVE (status invited, within 30 days of its last send), oldest first — the
 * one set the GET and the POST decide "choose a club" on, so they cannot disagree. Throws when the read fails: a read
 * that didn't come back must never let the join pick a club.
 */
async function liveInvitationClubs(userId: string): Promise<{ slug: string; name: string }[]> {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('invited_at, organizations!inner(slug, name)')
    .eq('user_id', userId)
    .eq('status', 'invited')
    .gte('invited_at', invitationLapseCutoff())
    .order('invited_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).flatMap(r => {
    const org = orgFromRelation(r.organizations);
    return org?.slug ? [{ slug: org.slug, name: org.name ?? org.slug }] : [];
  });
}

export const GET = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // The link names its club (J10-010). When the person holds invitations to more than one, read
  // THAT club's — otherwise the page would title itself with whichever row sorted first.
  const linkOrg = new URL(req.url).searchParams.get('org');
  // ⚖ Leftover call 12 (owner 2026-11-19): with no club named and more than one LIVE invitation waiting, the page asks which
  // club; neither this read nor the join picks one. The same rule as the POST (one helper), so the two can't disagree.
  if (!linkOrg) {
    const clubs = await liveInvitationClubs(user.id);
    if (clubs.length > 1) {
      return NextResponse.json({
        ok: true, code: CHOOSE_CLUB, clubs,
        orgSlug: null, role: null, status: 'invited', orgName: null, roleLabel: null, roleOpens: null, inviterName: null, inviterRole: null,
      });
    }
  }
  let query = supabaseAdmin
    .from('organization_members')
    .select('role, status, organization_id, capabilities, invited_at, organizations!inner(slug, name)')
    .eq('user_id', user.id)
    .in('status', ['invited', 'active']);
  if (linkOrg) query = query.eq('organizations.slug', linkOrg);
  const { data: member } = await query
    .order('status', { ascending: false })
    // The newest invitation first (/review, P2c): a live one is never hidden behind an older run-out one.
    .order('invited_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const org = orgFromRelation(member?.organizations ?? null);
  // ── Added 2026-09-25 (Club Tier Stage 1, specimen 6), additively: the club's NAME, the role's
  // label and sentence, and who sent the invitation — so the page says who is asking and what the
  // role opens. `orgSlug`, `role` and `status` are unchanged.
  const sender = member?.status === 'invited' && member.organization_id
    ? await invitationSender(member.organization_id as string, user.id)
    : null;
  // A run-out invitation (P2c) reads as 'lapsed', so the page says so before a password is set for nothing.
  const status = member?.status === 'invited' && invitationHasLapsed(member.invited_at as string | null) ? 'lapsed' : member?.status ?? null;
  return NextResponse.json({
    ok: true,
    orgSlug: org?.slug ?? null,
    role: member?.role ?? null,
    status,
    orgName: org?.name ?? null,
    roleLabel: member?.role ? roleLabel(member.role) : null,
    roleOpens: member?.role ? memberOpensSentence(member.role, member.capabilities as Record<string, boolean> | null) : null,
    inviterName: sender?.name ?? null,
    inviterRole: sender?.role ? roleLabel(sender.role) : null,
  });
}, { route: '/api/auth/accept-invite' });

export const POST = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // A "See it live" demo's shared account never joins a club (trust close-out 13), as on Home's invitations card.
  if (isDemoOrganizerEmail(user.email)) {
    return NextResponse.json({ error: 'A demo account can’t join a club.', code: 'demo_account' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const linkOrg = typeof body.orgSlug === 'string' && body.orgSlug ? body.orgSlug : null;

  // ⚖ Leftover call 12 (owner 2026-11-19): no club named and more than one live invitation → refused with the clubs to
  // choose from; it never picks one, and every invitation stays waiting (none declined, none used). Asked FIRST: a refused
  // join records nothing (no Terms agreement, no name), and the page sends both again with the club chosen.
  if (!linkOrg) {
    const clubs = await liveInvitationClubs(user.id);
    if (clubs.length > 1) {
      return NextResponse.json(
        { error: 'You have invitations from more than one club. Choose the club you’re joining.', code: CHOOSE_CLUB, clubs },
        { status: 409 },
      );
    }
  }

  // The Terms box (GST/HST Stage 6 step 6.3, §20 (1), the census's `staff_invite`): the invitation made the account, and the
  // page set its password in the browser before this request, so the refusal sits on the JOIN — asked only while the person
  // still needs to agree (an account that already has stays as it was). Anyone who goes around it meets the sign-in screen.
  // Off while the legal pages are off: `checkAcceptance` answers `off` and nothing is read.
  if ((await checkAcceptance(user)).state === 'needed') {
    const termsRefusal = accountDoorRefusal(body);
    if (termsRefusal) return termsRefusal;
    await recordDoorAcceptance(user, 'staff_invite', body);
  }

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
  // The membership rule below (Verified Network) decides whether the join may happen. (The /home pending-invites card
  // accepts multiple invites individually.) The page sends the club from its link (J10-010) so a person invited to two
  // clubs joins the one whose link they followed; without it, the ONE live invitation (two or more were refused at the
  // top, leftover call 12: this used to take the oldest). `.limit(1)` keeps `.maybeSingle()` from erroring on >1 row.
  // ⚖ Only a LIVE invitation is accepted (P2c): 30 days from its last send (lib/invitation-lapse.ts).
  const cutoff = invitationLapseCutoff();
  let pending = supabaseAdmin
    .from('organization_members')
    .select('id, role, organization_id, organizations!inner(slug)')
    .eq('user_id', user.id)
    .eq('status', 'invited')
    .gte('invited_at', cutoff);
  if (linkOrg) pending = pending.eq('organizations.slug', linkOrg);
  const { data: member } = await pending
    .order('invited_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!member) {
    // A run-out invitation is said as one, never as "already accepted" (which would send them on as if they had joined).
    let lapsedQuery = supabaseAdmin
      .from('organization_members')
      .select('id, organizations!inner(slug, name)')
      .eq('user_id', user.id)
      .eq('status', 'invited')
      .lt('invited_at', cutoff);
    if (linkOrg) lapsedQuery = lapsedQuery.eq('organizations.slug', linkOrg);
    const { data: lapsed } = await lapsedQuery.limit(1).maybeSingle();
    // Without the link's club, someone who already belongs somewhere keeps the old answer (they land where they work);
    // the refusal is for a person whose only way in was the run-out invitation (/review).
    const { count: activeElsewhere } = lapsed && !linkOrg
      ? await supabaseAdmin.from('organization_members').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'active')
      : { count: 0 };
    if (lapsed && !(activeElsewhere ?? 0)) {
      return NextResponse.json(
        { error: lapsedInvitationMessage(orgFromRelation(lapsed.organizations ?? null)?.name), code: 'invitation_lapsed' },
        { status: 410 },
      );
    }
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
    .eq('id', member.id)
    .eq('status', 'invited');

  if (error) {
    // A13 / J10-007: a named failure the page can act on — it retries ONLY this join (the password
    // is already saved), never asks for a new password, and never moves on as if it had worked.
    return captureAndJson(error, { error: 'We couldn’t add you just now. Try again.', code: 'join_failed' }, 500);
  }

  // Two-step (Board Ready, Part 3): a seat the club already requires gets its own 14 days from today.
  await startTwoStepGrace(user.id, member.organization_id, member.role);

  const orgSlug = orgSlugFromRelation(member.organizations);
  // J10-011: land where this role starts — the same resolver sign-in uses — not a hard-coded /admin.
  const destination = await destinationAfterAccept(user.id, orgSlug);
  return NextResponse.json({ ok: true, orgSlug, role: member.role, destination });
}, { route: '/api/auth/accept-invite' });
