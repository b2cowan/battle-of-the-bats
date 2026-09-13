import { NextResponse } from 'next/server';
import { requireStaffManagerMembership } from '@/lib/coach-membership';
import {
  sanitizeAssistantGrants, sanitizeStaffKind, resolveCoachCapabilities, STAFF_PRESETS, grantsOf, applyOrgGrantPolicy,
} from '@/lib/coach-capabilities';
import { delegationViolation, clampForDelegate, delegationReasonSentence } from '@/lib/coach-staff-delegation';
import { grantLabel } from '@/lib/coach-staff-labels';
import {
  getOpenAssistantInviteForTeam, updateAssistantInviteAccess, resendAssistantInvite,
  revokeAssistantInvite, sendAssistantInviteEmail, notifyAdminOfPendingInvite, orgRequiresAssistantApproval,
} from '@/lib/assistant-invites';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

/**
 * ONE PENDING INVITE, from the head coach's staff list (R3, pass 2 of the staff access plan,
 * 2026-09-11). Until now an invite vanished the moment it was sent — only a club admin's
 * oversight page listed it, and a standalone team has no admin. Three things a head coach can do
 * to one before it is accepted: change what it will hand over (PATCH), send it again (POST
 * resend), and cancel it (DELETE).
 *
 * ⚠ STAFF-MANAGER-GATED AND TEAM-SCOPED, every verb: the shared gate resolves the caller's active
 * membership on THIS team and requires a head coach or a Manage staff holder (2026-09-13), and
 * every lib read below re-asserts `team_id` — an invite id from another team is a 404, never a
 * row. An accepted invite is not "open" and 404s too; by then the membership, not the invite, is
 * the person's access truth. A delegate's PATCH runs the ceiling against what the invite already
 * hands over.
 */
async function resolveInvite(orgSlug: string, teamId: string, inviteId: string) {
  const gate = await requireStaffManagerMembership(orgSlug, teamId);
  if ('error' in gate) return gate;
  const invite = await getOpenAssistantInviteForTeam(inviteId, teamId);
  if (!invite) return { error: NextResponse.json({ error: 'That invite is no longer open.' }, { status: 404 }) };
  return { ...gate, invite };
}

/** The caller's display name for the admin's bell ("Jane changed…"), best-effort. */
async function inviterName(orgId: string, userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('organization_members').select('display_name')
    .eq('organization_id', orgId).eq('user_id', userId).maybeSingle<{ display_name: string | null }>();
  return data?.display_name ?? null;
}

const shape = (i: NonNullable<Awaited<ReturnType<typeof getOpenAssistantInviteForTeam>>>) => ({
  inviteId: i.id,
  email: i.invitedEmail,
  status: i.status,
  staffKind: i.staffKind,
  capabilities: resolveCoachCapabilities('assistant_coach', sanitizeAssistantGrants(i.initialCapabilities)),
  expiresAt: i.expiresAt,
  createdAt: i.createdAt,
});

// PATCH { kind?, capabilities? } — the access this invite will hand over, editable until accepted.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; inviteId: string }> },) => {
  const { orgSlug, teamId, inviteId } = await params;
  const resolved = await resolveInvite(orgSlug, teamId, inviteId);
  if ('error' in resolved) return resolved.error!;

  const body = await req.json().catch(() => ({}));
  const patch: Parameters<typeof updateAssistantInviteAccess>[2] = {};
  if (body.capabilities && typeof body.capabilities === 'object') patch.initialCapabilities = sanitizeAssistantGrants(body.capabilities);
  const kind = sanitizeStaffKind(body.kind);
  if (kind) {
    patch.staffKind = kind;
    // A kind CHANGE applies that kind's starting access — the server owns the rule (see the member
    // route); re-sending the kind already on the invite resets nothing.
    if (!patch.initialCapabilities && kind !== resolved.invite.staffKind) patch.initialCapabilities = { ...STAFF_PRESETS[kind] };
  }
  if (!patch.staffKind && !patch.initialCapabilities) {
    return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  }
  if (!resolved.capabilities.isHeadCoach && patch.initialCapabilities) {
    // The ceiling, against what the invite ALREADY hands over: a client-sent bundle is refused by
    // name; the server's own preset (a bare kind change) is clamped — same split as the invite route.
    const current = grantsOf(resolveCoachCapabilities('assistant_coach', sanitizeAssistantGrants(resolved.invite.initialCapabilities)));
    const proposed = grantsOf(resolveCoachCapabilities('assistant_coach', patch.initialCapabilities));
    if (body.capabilities && typeof body.capabilities === 'object') {
      const violation = delegationViolation(resolved.capabilities, current, proposed);
      if (violation) {
        return NextResponse.json({ error: delegationReasonSentence(violation, grantLabel), key: violation.key }, { status: 403 });
      }
      patch.initialCapabilities = proposed;
    } else {
      patch.initialCapabilities = clampForDelegate(resolved.capabilities, current, proposed).grants;
    }
  }
  // Run tournaments exists only in a Premium workspace (D2).
  if (patch.initialCapabilities) {
    patch.initialCapabilities = applyOrgGrantPolicy(patch.initialCapabilities, { isTeamWorkspace: isTeamWorkspaceOrg(resolved.ctx.org) });
  }

  const updated = await updateAssistantInviteAccess(inviteId, teamId, patch);
  if (!updated) return NextResponse.json({ error: 'That invite is no longer open.' }, { status: 409 });
  if (updated.status === 'pending_approval') {
    // The admin's bell described what the invite USED to hand over — ring it again with the change.
    await notifyAdminOfPendingInvite({
      orgId: resolved.ctx.org.id, orgSlug, inviteId, email: updated.invitedEmail, teamName: resolved.team.name,
      invitedByName: await inviterName(resolved.ctx.org.id, resolved.ctx.user.id), staffKind: updated.staffKind, changed: true,
    });
  }
  return NextResponse.json({ ok: true, invite: shape(updated) });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/staff/invites/[inviteId]' });

// POST { action: 'resend' } — a fresh link, the old one superseded, the seven days restarted.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; inviteId: string }> },) => {
  const { orgSlug, teamId, inviteId } = await params;
  const resolved = await resolveInvite(orgSlug, teamId, inviteId);
  if ('error' in resolved) return resolved.error!;

  const body = await req.json().catch(() => ({}));
  if (body.action !== 'resend') return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  if (resolved.invite.status !== 'pending') {
    // Awaiting the club admin: there is no link to send yet — the approval mints it.
    return NextResponse.json({ error: 'This invite is waiting for your club admin to approve it — there is no link to resend yet.' }, { status: 409 });
  }

  // The org's CURRENT policy, exactly as the invite route decides it — a club that turned approval
  // on after this invite went out is not bypassed by Resend.
  const requireApproval = !isTeamWorkspaceOrg(resolved.ctx.org) && await orgRequiresAssistantApproval(resolved.ctx.org.id);
  const minted = await resendAssistantInvite(inviteId, teamId, { requireApproval });
  if (!minted) return NextResponse.json({ error: 'That invite is no longer open.' }, { status: 409 });
  const teamName = minted.teamName ?? resolved.team.name;
  if (!minted.rawToken) {
    await notifyAdminOfPendingInvite({
      orgId: resolved.ctx.org.id, orgSlug, inviteId: minted.invite.id, email: minted.invite.invitedEmail, teamName,
      invitedByName: minted.invitedByName, staffKind: minted.invite.staffKind,
    });
    return NextResponse.json({ ok: true, pendingApproval: true, invite: shape(minted.invite) });
  }
  await sendAssistantInviteEmail({
    email: minted.invite.invitedEmail,
    teamName,
    invitedByName: minted.invitedByName,
    rawToken: minted.rawToken,
    staffKind: minted.invite.staffKind,
    isTeamWorkspace: isTeamWorkspaceOrg(resolved.ctx.org),
  });
  return NextResponse.json({ ok: true, pendingApproval: false, invite: shape(minted.invite) });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/staff/invites/[inviteId]' });

// DELETE — cancel: the link stops working; nothing else changes.
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; inviteId: string }> },) => {
  const { orgSlug, teamId, inviteId } = await params;
  const resolved = await resolveInvite(orgSlug, teamId, inviteId);
  if ('error' in resolved) return resolved.error!;
  await revokeAssistantInvite(inviteId, teamId);
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/staff/invites/[inviteId]' });
