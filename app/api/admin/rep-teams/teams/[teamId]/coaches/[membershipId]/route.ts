import { NextResponse } from 'next/server';
import { resolveClubTeam } from '@/lib/club-team-route';
import { countActiveHeadCoaches, getTeamStaffMembershipById, removeStaffMember } from '@/lib/coach-membership';
import { wouldLeaveNoHeadCoach } from '@/lib/coach-capabilities';
import { revokeStaleChatMembershipsForCoach } from '@/lib/chat-service';
import { withObservability } from '@/lib/observability';

/**
 * DELETE — the club removes someone from a team's staff (Club Tier Stage 2, J4-035; specimen 5's
 * "Remove that asks"). Everywhere at once: the team membership is revoked (the record kept — the
 * seasons they coached still name them), the live season's row goes, and re-adding restores them.
 *
 * ⚠⚠ THE CLUB MAY REMOVE A TEAM'S LAST HEAD COACH — the portal may not (`refuseLastHeadCoach`,
 * unchanged). When a coach leaves, the club must be able to act; a team with no head coach is a
 * state the board then shows in red until someone accepts an invitation. But it is never an
 * accident: removing the last one needs `confirmLastHeadCoach: true` (JSON body or query), and
 * without it the answer is 409 `last_head_coach`, in words, so the screen can ask.
 * ⚠ A check-then-act: two admins removing a team's two head coaches in the same instant can each
 * pass the count. Accepted: the club may leave a team with none, and the board says so at once.
 */
export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string; membershipId: string }> },) => {
  const { teamId, membershipId } = await params;
  const resolved = await resolveClubTeam(req, teamId, { write: true });
  if ('error' in resolved) return resolved.error;
  const { ctx, team } = resolved;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const confirmLastHeadCoach = body?.confirmLastHeadCoach === true
    || new URL(req.url).searchParams.get('confirmLastHeadCoach') === 'true';

  const member = await getTeamStaffMembershipById(membershipId);
  if (!member || member.teamId !== team.id || member.status !== 'active') {
    return NextResponse.json({ error: 'They’re no longer on this team’s staff — refresh to see its coaches.' }, { status: 404 });
  }

  if (member.coachRole === 'head_coach' && !confirmLastHeadCoach
    && wouldLeaveNoHeadCoach(await countActiveHeadCoaches(team.id), true)) {
    return NextResponse.json(
      {
        error: `${team.name} will have no head coach. Its row on Rep Teams will say so until you invite one.`,
        code: 'last_head_coach',
      },
      { status: 409 },
    );
  }

  const outcome = await removeStaffMember(ctx.org.id, team.id, member.userId, ctx.user.id);
  await revokeStaleChatMembershipsForCoach(member.userId).catch(() => {});
  return NextResponse.json({
    ok: true,
    removed: outcome === 'removed',
    teamHasHeadCoach: (await countActiveHeadCoaches(team.id)) > 0,
  });
}, { route: '/api/admin/rep-teams/teams/[teamId]/coaches/[membershipId]' });
