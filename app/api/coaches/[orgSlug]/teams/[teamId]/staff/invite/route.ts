import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { denyUnless } from '@/lib/coach-capabilities';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { createAssistantInvite, orgRequiresAssistantApproval } from '@/lib/assistant-invites';
import { sendEmail, assistantCoachInviteHtml } from '@/lib/email';
import { notify } from '@/lib/notify';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fieldlogichq.ca';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/coaches/[orgSlug]/teams/[teamId]/staff/invite — head coach invites an assistant by email.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return forbidden();
  const denied = denyUnless(assignment.capabilities.isHeadCoach, 'Only the head coach can invite assistant coaches.');
  if (denied) return denied;

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) return NextResponse.json({ error: 'No active program year for this team' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });

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
    requireApproval,
  });

  if (status === 'pending_approval') {
    // Tell the org so an admin can approve (their bell). Assistant is NOT emailed until approval.
    await notify({
      orgId: ctx.org.id,
      eventType: 'assistant_coach_approval_requested',
      title: 'Assistant coach invite awaiting approval',
      body: `${invitedByName ?? 'A head coach'} invited ${email} to ${team.name}.`,
      link: `/${orgSlug}/admin/rep-teams`,
      metadata: { inviteId },
    }).catch(() => {});
    return NextResponse.json({ ok: true, pendingApproval: true });
  }

  const inviteUrl = `${APP_URL}/auth/accept-assistant-invite?token=${rawToken}`;
  await sendEmail(email, `You're invited to help coach ${team.name}`, assistantCoachInviteHtml({
    teamName: team.name, invitedByName, inviteUrl,
  }));

  return NextResponse.json({ ok: true, pendingApproval: false });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/staff/invite' });
