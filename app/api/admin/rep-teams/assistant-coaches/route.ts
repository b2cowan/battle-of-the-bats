import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden, repGroupScopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import {
  getOrgAssistantCoaches, getRepTeam, getRepTeamCoachById, removeRepTeamCoach, cleanupOrphanedCoachMembership,
} from '@/lib/db';
import {
  listOpenAssistantInvitesForOrg, getAssistantInviteById, approveAssistantInvite, revokeAssistantInvite,
  orgRequiresAssistantApproval,
} from '@/lib/assistant-invites';
import { resolveCoachCapabilities } from '@/lib/coach-capabilities';
import { revokeStaleChatMembershipsForCoach } from '@/lib/chat-service';
import { sendEmail, assistantCoachInviteHtml } from '@/lib/email';
import { withObservability } from '@/lib/observability';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fieldlogichq.ca';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

/** Keep only teams the (possibly rep-group-scoped) admin may see. Unrestricted (null) sees all;
 *  a scoped admin sees only teams whose group is in scope — ungrouped teams stay invisible. */
function inScope(repGroupIds: string[] | null, teamGroupId: string | null): boolean {
  if (repGroupIds === null) return true;
  return teamGroupId !== null && repGroupIds.includes(teamGroupId);
}

// GET — org-wide assistant oversight: all assistants + outstanding invites + the approval setting.
export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const [assistantsRaw, invitesRaw, requireApproval] = await Promise.all([
    getOrgAssistantCoaches(ctx!.org.id),
    listOpenAssistantInvitesForOrg(ctx!.org.id),
    orgRequiresAssistantApproval(ctx!.org.id),
  ]);

  const assistants = assistantsRaw
    .filter(a => inScope(ctx!.repGroupIds, a.teamGroupId))
    .map(a => ({
      coachId: a.coachId,
      teamId: a.teamId,
      teamName: a.teamName,
      programYearName: a.programYearName,
      displayName: a.displayName,
      email: a.email,
      capabilities: resolveCoachCapabilities('assistant_coach', a.capabilities),
    }));

  const pendingInvites = invitesRaw
    .filter(i => inScope(ctx!.repGroupIds, i.teamGroupId))
    .map(i => ({ id: i.id, teamId: i.teamId, teamName: i.teamName, invitedEmail: i.invitedEmail, status: i.status, expiresAt: i.expiresAt }));

  return NextResponse.json({
    assistants,
    pendingInvites,
    requireApproval,
    canWrite: ctx!.role === 'owner' || ctx!.role === 'admin',
  });
}, { route: '/api/admin/rep-teams/assistant-coaches' });

// POST — admin override actions: approve / decline a pending invite, or remove an assistant.
export const POST = withObservability(async (req: Request): Promise<Response> => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;
  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  // Scope helper: returns an error Response if the team isn't in this org + the admin's rep-group scope, else null.
  async function teamScopeError(teamId: string): Promise<Response | null> {
    const team = await getRepTeam(teamId);
    if (!team || team.orgId !== ctx!.org.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return repGroupScopeGuard(ctx!, team.groupId) ?? null;
  }

  if (action === 'approve' || action === 'decline') {
    const inviteId = typeof body.inviteId === 'string' ? body.inviteId : '';
    if (!inviteId) return NextResponse.json({ error: 'Missing inviteId.' }, { status: 400 });
    const invite = await getAssistantInviteById(inviteId);
    if (!invite || invite.orgId !== ctx!.org.id) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    const scopeErr = await teamScopeError(invite.teamId);
    if (scopeErr) return scopeErr;

    if (action === 'approve' && invite.status !== 'pending_approval') {
      return NextResponse.json({ error: 'This invite is not awaiting approval.' }, { status: 409 });
    }
    if (action === 'decline' && invite.status !== 'pending' && invite.status !== 'pending_approval') {
      return NextResponse.json({ error: 'This invite is no longer open.' }, { status: 409 });
    }

    if (action === 'decline') {
      await revokeAssistantInvite(inviteId);
      return NextResponse.json({ ok: true });
    }
    // approve → mint a fresh token, flip to pending, email the assistant.
    const approved = await approveAssistantInvite(inviteId);
    if (!approved) return NextResponse.json({ error: 'This invite is no longer awaiting approval.' }, { status: 409 });
    const inviteUrl = `${APP_URL}/auth/accept-assistant-invite?token=${approved.rawToken}`;
    await sendEmail(invite.invitedEmail, `You're invited to help coach ${approved.invite.team_name ?? 'a team'}`,
      assistantCoachInviteHtml({ teamName: approved.invite.team_name ?? 'the team', invitedByName: approved.invite.invited_by_name, inviteUrl }));
    return NextResponse.json({ ok: true });
  }

  if (action === 'remove') {
    const coachId = typeof body.coachId === 'string' ? body.coachId : '';
    if (!coachId) return NextResponse.json({ error: 'Missing coachId.' }, { status: 400 });
    const target = await getRepTeamCoachById(coachId);
    if (!target || target.orgId !== ctx!.org.id) return NextResponse.json({ error: 'Assistant not found' }, { status: 404 });
    if (target.coachRole !== 'assistant_coach') return NextResponse.json({ error: 'Only assistant coaches can be removed here.' }, { status: 400 });
    const scopeErr = await teamScopeError(target.teamId);
    if (scopeErr) return scopeErr;

    await removeRepTeamCoach(coachId);
    await cleanupOrphanedCoachMembership(ctx!.org.id, target.userId);
    // Phase 4: revoke the removed assistant's stale tournament chat access.
    await revokeStaleChatMembershipsForCoach(target.userId).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
}, { route: '/api/admin/rep-teams/assistant-coaches' });
