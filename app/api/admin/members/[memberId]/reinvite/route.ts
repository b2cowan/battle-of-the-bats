import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, requireCapability } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendPendingInviteLink } from '@/lib/invite-links';
import { coachingStaffRowRefusal } from '@/lib/board-roles';
import { waitingBoardRole } from '@/lib/waiting-board-role';
import { withObservability, captureAndJson } from '@/lib/observability';

type Params = { params: Promise<{ memberId: string }> };

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  const denied = await requireCapability(ctx, 'manage_members');
  if (denied) return denied;

  const { org } = ctx;
  const { memberId } = await params;

  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('id, role, user_id, status, accepted_at, pending_role')
    .eq('id', memberId)
    .eq('organization_id', org.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // ⚖ A club's coach invited to the board (trust close-out 13 P2b): the WAITING role is an invitation like any other, so it
  // is resent; the coaching row itself still belongs to the team's staff page (S1-03) and is refused.
  const waiting = waitingBoardRole(member);
  if (member.role === 'coach' && !waiting) return coachingStaffRowRefusal();

  if (member.status !== 'invited' && !waiting) {
    return NextResponse.json({ error: 'This member has already accepted their invitation' }, { status: 400 });
  }

  // An existing account's invitation (and a coach's waiting board role) goes again as a sign-in-and-accept email; otherwise
  // a magic link for a confirmed account, an invite link for the rest. Shared with the self-serve resend route so the link
  // logic can't drift.
  const result = await sendPendingInviteLink({
    memberId: member.id,
    userId: member.user_id,
    role: waiting ?? (member.role as string),
    orgName: org.name,
    orgSlug: org.slug,
    askedBy: ctx.user.id,
    waitingRole: waiting,
  });
  if (!result.ok && result.changed) {
    return NextResponse.json({ error: result.error, code: 'invitation_changed' }, { status: 409 });
  }
  if (!result.ok) {
    return captureAndJson(
      new Error(`sendPendingInviteLink failed: ${result.error ?? 'unknown'}`),
      { error: result.error },
      500,
    );
  }

  // `existingAccount`: they accept from Home when they sign in, so the screen's notice promises no 24-hour link.
  return NextResponse.json({ ok: true, existingAccount: result.existingAccount });
}, { route: '/api/admin/members/[memberId]/reinvite' });
