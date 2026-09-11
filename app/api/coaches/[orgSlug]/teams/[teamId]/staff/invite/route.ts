import { NextResponse } from 'next/server';
import { requireHeadCoachMembership, resolveWorkingProgramYear, getTeamStaffPanelList } from '@/lib/coach-membership';
import { normalizeGuardianEmail } from '@/lib/guardian-email';
import { STAFF_PRESETS, sanitizeAssistantGrants, sanitizeStaffKind } from '@/lib/coach-capabilities';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import {
  createAssistantInvite, orgRequiresAssistantApproval, sendAssistantInviteEmail, notifyAdminOfPendingInvite,
} from '@/lib/assistant-invites';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/coaches/[orgSlug]/teams/[teamId]/staff/invite — the head coach invites someone by
// email, naming WHO they are (one of the four kinds) and WHAT they will be able to open.
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

  // Someone already on the staff cannot be "re-invited" into a different kind: accepting would be
  // a silent no-op (the membership, not the invite, is their access), so say so and point at the
  // row where the change actually happens (/review, 2026-09-11).
  const staff = await getTeamStaffPanelList(teamId, ctx.org.id);
  if (staff.some(m => normalizeGuardianEmail(m.email) === normalizeGuardianEmail(email))) {
    return NextResponse.json(
      { error: 'They’re already on your staff — change their role or access from their row instead.' },
      { status: 409 },
    );
  }

  /**
   * WHICH KIND is being invited (pass 2, 2026-09-11) — REQUIRED, with no default. The sheet forces
   * the choice ("nothing is preselected"), and a route that quietly defaulted a missing kind would
   * reopen the "safer accident" the sheet was built to close. The word is STORED on the invite
   * and copied to the membership on accept; it never gates anything.
   *
   * The starting access is the kind's preset unless the head coach adjusted it in the sheet, in
   * which case the body carries the whole grid. Either way it is sanitised here and again on
   * accept.
   */
  const kind = sanitizeStaffKind(body.kind);
  if (!kind) return NextResponse.json({ error: 'Choose who they are before sending the invite.' }, { status: 400 });
  const initialCapabilities = body.capabilities && typeof body.capabilities === 'object'
    ? sanitizeAssistantGrants(body.capabilities)
    : { ...STAFF_PRESETS[kind] };

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
    staffKind: kind,
    requireApproval,
  });

  if (status === 'pending_approval') {
    // Tell the org so an admin can approve (their bell). The invitee is NOT emailed until approval.
    await notifyAdminOfPendingInvite({
      orgId: ctx.org.id, orgSlug, inviteId, email, teamName: team.name, invitedByName, staffKind: kind,
    });
    return NextResponse.json({ ok: true, inviteId, pendingApproval: true });
  }

  await sendAssistantInviteEmail({
    email, teamName: team.name, invitedByName, rawToken: rawToken!, staffKind: kind,
  });

  return NextResponse.json({ ok: true, inviteId, pendingApproval: false });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/staff/invite' });
