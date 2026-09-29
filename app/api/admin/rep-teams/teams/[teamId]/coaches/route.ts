import { NextResponse } from 'next/server';
import { resolveClubTeam } from '@/lib/club-team-route';
import { memberDisplayName } from '@/lib/member-names';
import { getTeamStaffPanelList, resolveMembershipCapabilities, resolveWorkingProgramYear } from '@/lib/coach-membership';
import {
  STAFF_KIND_COPY, STAFF_PRESETS, applyOrgGrantPolicy, sensitiveGrantWords, staffKindWord,
} from '@/lib/coach-capabilities';
import {
  createAssistantInvite, listOpenAssistantInvitesForTeam, sendClubCoachInviteEmail, type InviteCoachRole,
} from '@/lib/assistant-invites';
import { normalizeGuardianEmail } from '@/lib/guardian-email';
import { clubRoleWords } from '@/lib/club-coach-invite';
import { withObservability } from '@/lib/observability';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A CLUB TEAM'S COACHES — ONE DOOR (Club Tier Stage 2: D10 + Ask 4, owner rulings 2026-09-28;
 * specimens 5 and 6). Replaces, once session 3 builds its page, the per-season coaches route
 * (`program-years/[yearId]/coaches`), which could only assign someone ALREADY an active club
 * member, sent nothing, and refused everyone between seasons.
 *
 *   GET  — the team's staff (memberships: the access truth since M1, so the list is the same in
 *          every season) + its open invitations, including a head coach's assistant invites that
 *          await the club's approval.
 *   POST — "Invite a coach": `{ email, kind: 'head_coach' | 'assistant_coach' }`. Reuses the
 *          portal's staff invite (the token, the 7-day link, /auth/accept-assistant-invite); on
 *          accept it writes the coach's org membership AND the team staff membership. It works
 *          BETWEEN SEASONS — staff belong to the team, not to a season.
 *
 * ⚠ There is no Coach row on the club's Members page (Ask 4): this is the only door.
 * ⚠ The club's invite is never subject to "Require admin approval" — the club IS the approver
 *   (Ask 6: the switch governs a head coach's own staff invites, optional and off by default).
 * ⚠ The head seat is a ROLE on the invite (mig 312), never a fifth staff kind, and only this door
 *   offers it — the portal's own invite route never sends a role.
 * Gate: GET for any Rep Teams holder; POST for the owner or an admin with Rep Teams.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROUTE = '/api/admin/rep-teams/teams/[teamId]/coaches';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string }> },) => {
  const { teamId } = await params;
  const resolved = await resolveClubTeam(req, teamId, { write: false });
  if ('error' in resolved) return resolved.error;
  const { ctx, team } = resolved;

  const [members, invites] = await Promise.all([
    getTeamStaffPanelList(team.id, ctx.org.id),
    listOpenAssistantInvitesForTeam(team.id, 'club'),
  ]);
  const now = Date.now();
  const staff = members.map(m => {
    const caps = resolveMembershipCapabilities(m);
    return {
      membershipId: m.id,
      userId: m.userId,
      name: m.displayName,
      email: m.email,
      coachRole: m.coachRole,
      staffKind: m.staffKind,
      /** "Head coach", "Assistant coach", "Team manager"… — the portal's own word for the row. */
      kindWord: staffKindWord(caps, m.staffKind),
      since: m.createdAt,
      /** The sensitive grants they hold, in the portal's words (the person window's "what they can open"). */
      opens: caps.isHeadCoach ? [] : sensitiveGrantWords(caps),
    };
  });
  const invitations = invites.map(i => ({
    id: i.id,
    email: i.invitedEmail,
    coachRole: i.coachRole,
    staffKind: i.staffKind,
    kindWord: i.coachRole === 'head_coach' ? 'Head coach' : STAFF_KIND_COPY[i.staffKind ?? 'assistant'].name,
    /** 'pending' = emailed; 'pending_approval' = a head coach's invite waiting on the club. */
    status: i.status,
    sentBy: i.sentBy,
    invitedByName: i.invitedByName,
    invitedAt: i.createdAt,
    expiresAt: i.expiresAt,
    expired: new Date(i.expiresAt).getTime() < now,
  }));
  return NextResponse.json({
    team: { id: team.id, name: team.name, groupName: team.groupName ?? null },
    staff,
    invitations,
    hasHeadCoach: staff.some(s => s.coachRole === 'head_coach'),
    headCoachInvited: invitations.some(i => i.coachRole === 'head_coach' && !i.expired),
    canWrite: ctx.role === 'owner' || ctx.role === 'admin',
  });
}, { route: ROUTE });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string }> },) => {
  const { teamId } = await params;
  const resolved = await resolveClubTeam(req, teamId, { write: true });
  if ('error' in resolved) return resolved.error;
  const { ctx, team } = resolved;

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  // REQUIRED, with no default — the window forces the choice, as the portal's does.
  const coachRole: InviteCoachRole | null =
    body.kind === 'head_coach' ? 'head_coach' : body.kind === 'assistant_coach' ? 'assistant_coach' : null;
  if (!coachRole) {
    return NextResponse.json({ error: 'Choose whether they are the head coach or an assistant coach.' }, { status: 400 });
  }

  // Someone already on the staff is not "re-invited": accepting would change nothing (their
  // membership is their access). Say so, and where the change actually happens.
  const staff = await getTeamStaffPanelList(team.id, ctx.org.id);
  if (staff.some(m => normalizeGuardianEmail(m.email) === normalizeGuardianEmail(email))) {
    return NextResponse.json(
      { error: `They’re already on ${team.name}’s staff.`, code: 'already_on_staff' },
      { status: 409 },
    );
  }

  // Provenance only — null for a brand-new team with no season yet (mig 312). Access never reads it.
  const workingSeason = await resolveWorkingProgramYear(team.id);
  // Their club name, else their account's (lib/member-names.ts) — never "The head coach".
  const invitedByName = await memberDisplayName(ctx.org.id, ctx.user.id);

  const { inviteId, rawToken, invite } = await createAssistantInvite({
    orgId: ctx.org.id,
    teamId: team.id,
    programYearId: workingSeason?.id ?? null,
    coachRole,
    sentBy: 'club',
    invitedByUserId: ctx.user.id,
    invitedByName,
    invitedEmail: email,
    teamName: team.name,
    // An assistant from the club starts on the assistant preset (the head coach adjusts it later,
    // as for anyone they invite themselves); a head coach carries no grants and no kind.
    initialCapabilities: coachRole === 'assistant_coach'
      ? applyOrgGrantPolicy({ ...STAFF_PRESETS.assistant }, { isTeamWorkspace: false })
      : null,
    staffKind: coachRole === 'assistant_coach' ? 'assistant' : null,
    requireApproval: false,
  });

  await sendClubCoachInviteEmail({
    email,
    clubName: ctx.org.name,
    teamName: team.name,
    coachRole,
    invitedByName,
    invitedByRoleWords: clubRoleWords(ctx.role),
    rawToken: rawToken!,
  });

  return NextResponse.json({
    ok: true,
    invitation: {
      id: inviteId,
      email: invite.invitedEmail,
      coachRole: invite.coachRole,
      status: invite.status,
      invitedAt: invite.createdAt,
      expiresAt: invite.expiresAt,
    },
  }, { status: 201 });
}, { route: ROUTE });
