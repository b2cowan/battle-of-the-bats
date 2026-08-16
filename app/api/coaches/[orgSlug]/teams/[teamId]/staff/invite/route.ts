import { NextResponse } from 'next/server';
import { requireHeadCoachMembership, resolveWorkingProgramYear } from '@/lib/coach-membership';
import { HELPER_PRESET } from '@/lib/coach-capabilities';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { createAssistantInvite, orgRequiresAssistantApproval } from '@/lib/assistant-invites';
import { sendEmail, assistantCoachInviteHtml } from '@/lib/email';
import { notify } from '@/lib/notify';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/coaches/[orgSlug]/teams/[teamId]/staff/invite — head coach invites an assistant by email.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;

  // M1: authority is the caller's ACTIVE team membership — which also means a head coach whose
  // season just ended can still build next year's staff (the between-seasons state is ordinary).
  const gate = await requireHeadCoachMembership(orgSlug, teamId, 'Only the head coach can invite staff.');
  if ('error' in gate) return gate.error;
  const { ctx, team } = gate;

  // The invite token still records a season for provenance; acceptance grants TEAM membership,
  // so between seasons the newest closed year stands in and nothing about access reads it.
  const programYear = await resolveWorkingProgramYear(teamId);
  if (!programYear) return NextResponse.json({ error: 'This team has no seasons yet.' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });

  /**
   * Which PRESET is being invited (Phase 4, 2026-08-03). An unrecognised value — including the
   * absent one every caller sent before today — means "assistant coach", which is the behaviour
   * this route has always had.
   *
   * ⚠ This picks a bundle of grants; it does NOT pick a role. Both land on the same
   * `assistant_coach` row, and from the moment the invite is accepted the head coach can move any
   * individual grant on either of them. The word chosen here is not stored anywhere.
   */
  const isHelper = body.preset === 'helper';
  const initialCapabilities = isHelper ? { ...HELPER_PRESET } : null;

  // The head coach's own display name for the email ("Jane invited you…").
  const { data: inviterMember } = await supabaseAdmin
    .from('organization_members').select('display_name')
    .eq('organization_id', ctx.org.id).eq('user_id', ctx.user.id).maybeSingle<{ display_name: string | null }>();
  const invitedByName = inviterMember?.display_name ?? null;

  // A standalone Premium workspace has no separate admin, so approval never applies there.
  const requireApproval = !isTeamWorkspaceOrg(ctx.org) && await orgRequiresAssistantApproval(ctx.org.id);

  const { inviteId, rawToken, status } = await createAssistantInvite({
    orgId: ctx.org.id,
    teamId,
    programYearId: programYear.id,
    invitedByUserId: ctx.user.id,
    invitedByName,
    invitedEmail: email,
    teamName: team.name,
    initialCapabilities,
    requireApproval,
  });

  if (status === 'pending_approval') {
    // Tell the org so an admin can approve (their bell). The invitee is NOT emailed until approval.
    // ⚠ The notification names WHICH kind was invited: an admin approving "a helper — a parent who
    // runs a station" is being asked a different question from one approving an assistant coach,
    // and a generic line would hide the difference at the only moment someone can object to it.
    await notify({
      orgId: ctx.org.id,
      eventType: 'assistant_coach_approval_requested',
      title: isHelper ? 'Helper invite awaiting approval' : 'Assistant coach invite awaiting approval',
      body: isHelper
        ? `${invitedByName ?? 'A head coach'} invited ${email} to ${team.name} as a helper — they will see practice plans and players' names, and nothing else.`
        : `${invitedByName ?? 'A head coach'} invited ${email} to ${team.name}.`,
      link: `/${orgSlug}/admin/rep-teams`,
      metadata: { inviteId },
    }).catch(() => {});
    return NextResponse.json({ ok: true, pendingApproval: true });
  }

  const inviteUrl = `${APP_URL}/auth/accept-assistant-invite?token=${rawToken}`;
  await sendEmail(
    email,
    isHelper ? `You're invited to help out at ${team.name}` : `You're invited to help coach ${team.name}`,
    assistantCoachInviteHtml({ teamName: team.name, invitedByName, inviteUrl, asHelper: isHelper }),
  );

  return NextResponse.json({ ok: true, pendingApproval: false });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/staff/invite' });
