import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, requireCapability } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendPendingInviteLink } from '@/lib/invite-links';
import { coachingStaffRowRefusal } from '@/lib/board-roles';
import { waitingBoardRole } from '@/lib/waiting-board-role';
import { withObservability, captureAndJson } from '@/lib/observability';
import { invitationHasLapsed } from '@/lib/invitation-lapse';
import { countsAsSeat, seatRowsFilter } from '@/lib/roles';
import { PLAN_CONFIG } from '@/lib/plan-config';

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
    .select('id, role, user_id, status, accepted_at, invited_at, pending_role, pending_invited_at')
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

  // ⚖ A run-out invitation holds no seat (P2c), and Resend gives it back one, so reviving it asks the invite route's seat
  // question first (/review): otherwise a club at its limit could pass it by reviving an old invitation.
  const offered = waiting ?? (member.role as string);
  const planCfg = PLAN_CONFIG[org.planId];
  if (invitationHasLapsed(waiting ? member.pending_invited_at : member.invited_at) && countsAsSeat(offered, planCfg)) {
    const { count: seatCount, error: seatError } = await supabaseAdmin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .or(seatRowsFilter(planCfg));
    if (seatError) return captureAndJson(seatError, { error: 'We couldn’t check the club’s seats. Try again.' }, 500);
    if ((seatCount ?? 0) >= planCfg.seatLimit) {
      const n = planCfg.seatLimit;
      return NextResponse.json(
        { error: `Seat limit reached (${n} seat${n === 1 ? '' : 's'} on the ${planCfg.label} plan). This invitation ran out and holds no seat; upgrade or free a seat to send it again.`, code: 'seat_limit_reached' },
        { status: 403 },
      );
    }
  }

  // An existing account's invitation (and a coach's waiting board role) goes again as a sign-in-and-accept email; otherwise
  // a magic link for a confirmed account, an invite link for the rest. Shared with the self-serve resend route so the link
  // logic can't drift.
  const result = await sendPendingInviteLink({
    memberId: member.id,
    userId: member.user_id,
    role: offered,
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
