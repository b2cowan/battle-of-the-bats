import { NextResponse } from 'next/server';
import { resolveClubTeam } from '@/lib/club-team-route';
import {
  getOpenAssistantInviteForTeam, resendAssistantInvite, revokeAssistantInvite,
  sendAssistantInviteEmail, sendClubCoachInviteEmail,
} from '@/lib/assistant-invites';
import { clubRoleWords } from '@/lib/club-coach-invite';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

/**
 * One open invitation on a club team's Coaches page (Club Tier Stage 2, specimen 5): Resend and
 * Cancel. The owner or an admin with Rep Teams (`resolveClubTeam`, write).
 *
 * The club's door sees EVERY open invitation on the team (`door: 'club'`), including a head
 * coach's own assistant invites — and it may resend or cancel those too, in their own words: a
 * resend keeps the invite's door, so a portal invite goes out again as the portal's email.
 * An invitation still waiting on the club's approval has no link to resend (approving mints it,
 * on the Assistant coaches page).
 */
const ROUTE = '/api/admin/rep-teams/teams/[teamId]/coaches/invites/[inviteId]';

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string; inviteId: string }> },) => {
  const { teamId, inviteId } = await params;
  const resolved = await resolveClubTeam(req, teamId, { write: true });
  if ('error' in resolved) return resolved.error;
  const { ctx, team } = resolved;

  const body = await req.json().catch(() => ({}));
  if (body.action !== 'resend') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });

  const open = await getOpenAssistantInviteForTeam(inviteId, team.id, 'club');
  if (!open) {
    return NextResponse.json({ error: 'This invitation is no longer open — refresh to see the team’s coaches.' }, { status: 404 });
  }
  if (open.status === 'pending_approval') {
    return NextResponse.json(
      { error: 'This invitation is waiting for the club’s approval, so there is no link to resend yet.', code: 'awaiting_approval' },
      { status: 409 },
    );
  }

  // A fresh link and a fresh seven days; the old link stops working. The club is the approver, so
  // a resend from here is never held for approval.
  const minted = await resendAssistantInvite(inviteId, team.id, { requireApproval: false, door: 'club' });
  if (!minted || !minted.rawToken) {
    return NextResponse.json({ error: 'This invitation is no longer open — refresh to see the team’s coaches.' }, { status: 409 });
  }

  if (minted.invite.sentBy === 'club') {
    // The email names the person who first sent it, with their club role as it stands today.
    const { data: row } = await supabaseAdmin
      .from('assistant_invite_tokens').select('invited_by_user_id').eq('id', minted.invite.id)
      .maybeSingle<{ invited_by_user_id: string }>();
    const { data: inviter } = row
      ? await supabaseAdmin.from('organization_members').select('role')
          .eq('organization_id', ctx.org.id).eq('user_id', row.invited_by_user_id).eq('status', 'active')
          .maybeSingle<{ role: string }>()
      : { data: null };
    await sendClubCoachInviteEmail({
      email: minted.invite.invitedEmail,
      clubName: ctx.org.name,
      teamName: minted.teamName ?? team.name,
      coachRole: minted.invite.coachRole,
      invitedByName: minted.invitedByName,
      invitedByRoleWords: clubRoleWords(inviter?.role),
      rawToken: minted.rawToken,
    });
  } else {
    await sendAssistantInviteEmail({
      email: minted.invite.invitedEmail,
      teamName: minted.teamName ?? team.name,
      invitedByName: minted.invitedByName,
      rawToken: minted.rawToken,
      staffKind: minted.invite.staffKind,
      isTeamWorkspace: false,
    });
  }

  return NextResponse.json({
    ok: true,
    invitation: {
      id: minted.invite.id,
      email: minted.invite.invitedEmail,
      coachRole: minted.invite.coachRole,
      status: minted.invite.status,
      invitedAt: minted.invite.createdAt,
      expiresAt: minted.invite.expiresAt,
    },
  });
}, { route: ROUTE });

export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string; inviteId: string }> },) => {
  const { teamId, inviteId } = await params;
  const resolved = await resolveClubTeam(req, teamId, { write: true });
  if ('error' in resolved) return resolved.error;
  const { team } = resolved;

  const open = await getOpenAssistantInviteForTeam(inviteId, team.id, 'club');
  if (!open) {
    return NextResponse.json({ error: 'This invitation is no longer open — refresh to see the team’s coaches.' }, { status: 404 });
  }
  await revokeAssistantInvite(inviteId, team.id, 'club');
  return NextResponse.json({ ok: true });
}, { route: ROUTE });
