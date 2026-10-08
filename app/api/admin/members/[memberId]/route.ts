import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ALL_CAPABILITY_KEYS, hasCapability, countsAsSeat, seatExemptRoles } from '@/lib/roles';
import { checkCrossOrgJoin, crossOrgJoinRefusalForAdmin } from '@/lib/org-membership-policy';
import { describeAccessChange, isOwnerOnlyCapability } from '@/lib/member-access';
import { coachingStaffRowRefusal, isAssignableRole } from '@/lib/board-roles';
import { isVolunteerJobChangeOnly, volunteerJobOf, withoutVolunteerJob } from '@/lib/volunteer-jobs';
import { VOLUNTEER_REFUSAL } from '@/lib/volunteer-words';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgRole } from '@/lib/types';
import { sendEmail, memberSuspendedHtml, memberRemovedHtml, memberAccessChangedHtml } from '@/lib/email';
import {
  cleanupBasicCoachTeamsForUserDeletion,
  countActiveBasicCoachTeamMembershipsForUser,
} from '@/lib/basic-coach-teams';
import { withObservability } from '@/lib/observability';

const VALID_CAPABILITIES = new Set<string>(ALL_CAPABILITY_KEYS);

type Params = { params: Promise<{ memberId: string }> };

function ownerRowRefusal() {
  return NextResponse.json(
    { error: 'Only an owner can change or remove another owner.', code: 'owner_row' },
    { status: 403 },
  );
}

async function ownerCount(orgId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('role', 'owner');
  return count ?? 0;
}

/**
 * GET /api/admin/members/[memberId]
 * Returns the contact-assignment impact for a member — how many tournaments and
 * divisions list them as the primary contact. Used to warn before removal.
 */
export const GET = withObservability(async (req: Request, { params }: Params) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'manage_members')) return forbidden();

  const { org } = ctx;
  const { memberId } = await params;

  // Confirm member belongs to this org (need user_id for the cross-org + coaching impact, J4-036)
  const { data: target } = await supabaseAdmin
    .from('organization_members')
    .select('id, user_id')
    .eq('id', memberId)
    .eq('organization_id', org.id)
    .single();

  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  const [
    { count: tournamentCount },
    { count: divisionCount },
    { count: otherOrgCount },
    { count: coachingAssignmentCount },
    basicCoachTeamCount,
  ] = await Promise.all([
    supabaseAdmin
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .eq('default_contact_member_id', memberId),
    supabaseAdmin
      .from('divisions')
      .select('id', { count: 'exact', head: true })
      .eq('contact_member_id', memberId),
    // J4-036: other org memberships drive the "membership-only vs hard-delete" warning + behavior.
    supabaseAdmin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', target.user_id)
      .neq('organization_id', org.id),
    // Rep-team coaching assignments this person holds (also lost on removal).
    supabaseAdmin
      .from('rep_team_coaches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', target.user_id),
    // Free (Basic) Coaches Portal teams. An active free portal counts as off-org presence: it now
    // forces the membership-only (account-preserving) path in DELETE, so the warning reassures the
    // admin the portal is kept rather than (as before) silently destroying it.
    countActiveBasicCoachTeamMembershipsForUser(target.user_id),
  ]);

  return NextResponse.json({
    tournamentCount: tournamentCount ?? 0,
    divisionCount: divisionCount ?? 0,
    otherOrgCount: otherOrgCount ?? 0,
    coachingAssignmentCount: coachingAssignmentCount ?? 0,
    basicCoachTeamCount,
  });
}, { route: '/api/admin/members/[memberId]' });

export const DELETE = withObservability(async (req: Request, { params }: Params) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'manage_members')) return forbidden();

  const { org } = ctx;
  const { memberId } = await params;

  const { data: target } = await supabaseAdmin
    .from('organization_members')
    .select('id, role, user_id')
    .eq('id', memberId)
    .eq('organization_id', org.id)
    .single();

  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (target.role === 'coach') return coachingStaffRowRefusal();

  // Only an owner removes an owner — "manage members" is the board's power over the board, not
  // over the people who own the club.
  if (target.role === 'owner' && ctx.role !== 'owner') return ownerRowRefusal();

  // Prevent removing the last owner
  if (target.role === 'owner' && (await ownerCount(org.id)) <= 1) {
    return NextResponse.json(
      { error: 'Cannot remove the last owner of the organization' },
      { status: 400 }
    );
  }

  // Prevent self-removal via this endpoint
  if (target.user_id === ctx.user.id) {
    return NextResponse.json(
      { error: 'You cannot remove yourself from the organization.' },
      { status: 400 }
    );
  }

  // Capture email before any deletion (the auth record is gone after deleteUser)
  const { data: { user: targetAuthUser } } = await supabaseAdmin.auth.admin.getUserById(target.user_id);
  const targetEmail = targetAuthUser?.email ?? null;

  // J4-036: does this user have any presence BEYOND this org? "Remove member" used to call
  // auth.admin.deleteUser unconditionally — destroying a person's entire account (their other clubs,
  // and — silently — their free Coaches Portal teams/roster/fees/history) and orphaning that data.
  // Preserve the account and remove ONLY this org's membership row + scope rows whenever off-org
  // presence exists; hard-delete ONLY a true sole-presence account (owner-approved: gated, not removed).
  //
  // Off-org presence = (a) membership in another organization OR (b) an active free (Basic) Coaches
  // Portal. A free portal is org-less (not an organization_members row), so it was invisible to the
  // original check and a free-only coach fell through to hard-delete — the data-loss footgun this closes.
  const [{ count: otherMembershipCount }, basicCoachTeamCount] = await Promise.all([
    supabaseAdmin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', target.user_id)
      .neq('organization_id', org.id),
    countActiveBasicCoachTeamMembershipsForUser(target.user_id),
  ]);

  const hasOtherOrg = (otherMembershipCount ?? 0) > 0;
  const hasFreeCoachPortal = basicCoachTeamCount > 0;

  if (hasOtherOrg || hasFreeCoachPortal) {
    // Membership-only removal: drop this org's member row + its scope/assignment rows.
    // (These FK to organization_members.id; delete them explicitly since we're not cascading
    // via the auth user.) The account, other orgs, and the free Coaches Portal are all preserved —
    // this path runs neither cleanupBasicCoachTeamsForUserDeletion nor deleteUser.
    await supabaseAdmin.from('org_member_tournament_assignments').delete().eq('org_member_id', memberId);
    await supabaseAdmin.from('org_member_rep_group_scopes').delete().eq('member_id', memberId);
    // Note: tournaments.default_contact_member_id and divisions(age_groups).contact_member_id both
    // FK organization_members(id) ON DELETE SET NULL (mig 088), so deleting the member row below
    // auto-nulls any contact references — no explicit clearing needed on this path.
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .delete()
      .eq('id', memberId)
      .eq('organization_id', org.id);
    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    void supabaseAdmin.from('org_audit_log').insert({
      org_id: org.id,
      actor_id: ctx.user.id,
      target_id: target.user_id,
      action: 'member_removed',
      payload: {
        email: targetEmail,
        role: target.role,
        membershipOnly: true,
        otherOrgs: otherMembershipCount ?? 0,
        basicCoachTeams: basicCoachTeamCount,
        preservedReason: hasOtherOrg ? 'other_org' : 'basic_coach_portal',
      },
    });

    // The account survives, so a courtesy "your access was removed" notice is meaningful (mirrors
    // the suspension notice). Best-effort — never block the removal on email delivery.
    if (targetEmail) {
      void (async () => {
        try {
          await sendEmail(
            targetEmail,
            `Your access to ${org.name} was removed`,
            memberRemovedHtml({ orgName: org.name }),
          );
        } catch (e) {
          console.error('[members] removal email failed:', e);
        }
      })();
    }

    return NextResponse.json({ ok: true, membershipOnly: true });
  }

  // J5-012: before deleting the auth user (cascade strips their basic_coach_team_users rows),
  // delete any Basic coach team they were the SOLE active member of — otherwise it orphans (zero
  // members → unreachable + unclaimable). Mirrors the platform-admin delete path. Best-effort: log
  // but don't block the removal.
  try {
    await cleanupBasicCoachTeamsForUserDeletion(target.user_id);
  } catch (e) {
    console.error('[members] basic-coach-team cleanup failed (continuing with user delete):', e);
  }

  // Sole membership → hard-delete the account (ON DELETE CASCADE removes the member row and
  // org_member_tournament_assignments). Reached only after the other-membership check above.
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(target.user_id);
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  void supabaseAdmin.from('org_audit_log').insert({
    org_id: org.id,
    actor_id: ctx.user.id,
    target_id: target.user_id,
    action: 'member_removed',
    payload: { email: targetEmail, role: target.role, membershipOnly: false },
  });

  return NextResponse.json({ ok: true, membershipOnly: false });
}, { route: '/api/admin/members/[memberId]' });

export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'manage_members')) return forbidden();

  const { org } = ctx;
  const { memberId } = await params;

  const body = await req.json();

  const hasRoleUpdate = 'role' in body;
  const hasCapabilitiesUpdate = 'capabilities' in body;
  const hasStatusUpdate = 'status' in body;
  const hasRepGroupIdsUpdate = 'repGroupIds' in body;

  // Capabilities, status, and rep group scope changes are owner-only — capabilities with ONE exception,
  // checked once the target is read below (a volunteer's two jobs, P1).
  if (hasStatusUpdate && ctx.role !== 'owner') return forbidden();
  if (hasRepGroupIdsUpdate && ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();

  const hasDisplayNameUpdate = 'displayName' in body;
  const hasTitleUpdate = 'title' in body;

  const { data: target } = await supabaseAdmin
    .from('organization_members')
    .select('id, role, user_id, capabilities, status')
    .eq('id', memberId)
    .eq('organization_id', org.id)
    .single();

  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (target.role === 'coach') return coachingStaffRowRefusal();

  // Prevent demoting the last owner
  if (hasRoleUpdate && target.role === 'owner' && (await ownerCount(org.id)) <= 1) {
    return NextResponse.json(
      { error: 'Cannot demote the last owner of the organization' },
      { status: 400 }
    );
  }

  // Owners cannot be suspended
  if (hasStatusUpdate && target.role === 'owner') {
    return NextResponse.json(
      { error: 'Cannot suspend an organization owner' },
      { status: 400 }
    );
  }

  // A role is changed only when it CHANGES — today's Manage dialog sends `role` only when edited,
  // and re-sending a member's own role must never trip the checks below.
  const roleChanging = hasRoleUpdate && body.role !== target.role;

  // ⚖ P1 (owner, 2026-10-07 — Tournament admin redesign Stage 6): whoever may invite may also switch a
  // VOLUNTEER's two jobs (submit scores, check teams in at the gate) and nothing else — the body may
  // differ from the row only in those two keys, and both are within the volunteer role's own defaults,
  // so nothing can be granted this way. Every other access change stays the owner's.
  if (hasCapabilitiesUpdate && ctx.role !== 'owner') {
    const resultingRole = roleChanging ? body.role : target.role;
    const bodyCaps = body.capabilities === null || (typeof body.capabilities === 'object' && !Array.isArray(body.capabilities))
      ? (body.capabilities as Record<string, boolean> | null)
      : undefined;
    const jobOnly = resultingRole === 'official' && bodyCaps !== undefined
      && isVolunteerJobChangeOnly(target.capabilities as Record<string, boolean> | null, bodyCaps);
    if (!jobOnly) {
      return NextResponse.json({ error: VOLUNTEER_REFUSAL.ownerOnly, code: 'owner_only_access' }, { status: 403 });
    }
  }

  if (roleChanging) {
    // Only an owner changes an owner's role, and no one below owner changes their OWN: "manage
    // members" delegated to a board member must not let them promote themselves (a staff member
    // holding it could make themselves Admin), and must not reach the club's owners.
    if (target.role === 'owner' && ctx.role !== 'owner') return ownerRowRefusal();
    if (target.user_id === ctx.user.id && ctx.role !== 'owner') {
      return NextResponse.json(
        { error: 'You can’t change your own role. Ask the club’s owner.', code: 'own_role' },
        { status: 403 },
      );
    }
    // A13 / A02: the board roles are assignable (treasurer; the league roles when the club runs a
    // house league — Ask 2), and anything else is REFUSED. This used to coerce every unrecognised
    // role to 'staff', so choosing Treasurer silently demoted the person (J4-039).
    if (!(await isAssignableRole({ ...org, id: org.id }, body.role))) {
      return NextResponse.json(
        { error: 'That role can’t be given in this organization.', code: 'role_not_assignable' },
        { status: 400 },
      );
    }
    // A role change respects the seat limit, exactly as an invite does: a free scorekeeper who
    // becomes staff takes a seat (the invite checked this; the role change never did).
    const planCfg = PLAN_CONFIG[org.planId];
    if (!countsAsSeat(target.role, planCfg) && countsAsSeat(body.role, planCfg)) {
      const { count: seatCount } = await supabaseAdmin
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .not('role', 'in', `(${seatExemptRoles(planCfg).join(',')})`);
      if ((seatCount ?? 0) >= planCfg.seatLimit) {
        return NextResponse.json(
          {
            error: `Seat limit reached (${planCfg.seatLimit} seat${planCfg.seatLimit === 1 ? '' : 's'} on the ${planCfg.label} plan). Upgrade to add more members.`,
            code: 'seat_limit_reached',
          },
          { status: 403 },
        );
      }
    }
    // Becoming a scorekeeper here is the one role Verified Network keeps to one home org.
    const join = await checkCrossOrgJoin(target.user_id, org.id, body.role);
    if (join.blocked) {
      return NextResponse.json({ error: crossOrgJoinRefusalForAdmin(join), code: 'one_home_org' }, { status: 409 });
    }
  }

  // Reinstate re-asks the membership rule for the role they hold (Verified Network, A03): being
  // active in another organization no longer blocks it; only a scorekeeper keeps one home org.
  if (hasStatusUpdate && body.status === 'active' && target.status === 'suspended') {
    const join = await checkCrossOrgJoin(target.user_id, org.id, target.role);
    if (join.blocked) {
      return NextResponse.json({ error: crossOrgJoinRefusalForAdmin(join), code: 'one_home_org' }, { status: 409 });
    }
  }

  // J10-022: plan & billing and organization settings stay with the owner. A body that tries to
  // GRANT one is refused outright rather than half-applied.
  if (hasCapabilitiesUpdate && body.capabilities && typeof body.capabilities === 'object') {
    const granted = Object.entries(body.capabilities as Record<string, unknown>)
      .filter(([key, val]) => isOwnerOnlyCapability(key) && val === true);
    if (granted.length > 0) {
      return NextResponse.json(
        { error: 'Plan & billing and organization settings stay with the owner; they can’t be handed out.', code: 'owner_only_power' },
        { status: 400 },
      );
    }
  }

  const update: Record<string, unknown> = {};

  if (roleChanging) {
    update.role = body.role as OrgRole;
  }

  if (hasStatusUpdate) {
    // Only 'active' and 'suspended' are settable via this endpoint; 'invited' is set by the invite route.
    if (body.status === 'suspended' || body.status === 'active') {
      update.status = body.status;
    }
  }

  if (hasCapabilitiesUpdate) {
    if (body.capabilities === null) {
      update.capabilities = null;
    } else if (typeof body.capabilities === 'object') {
      const sanitized: Record<string, boolean> = {};
      for (const [key, val] of Object.entries(body.capabilities as Record<string, unknown>)) {
        // Owner-only powers are never stored as an override (a `true` was refused above; a stray
        // `false` is meaningless for a non-owner and would show as a phantom change).
        if (VALID_CAPABILITIES.has(key) && typeof val === 'boolean' && !isOwnerOnlyCapability(key)) {
          sanitized[key] = val;
        }
      }
      // Empty object → null (no overrides stored)
      update.capabilities = Object.keys(sanitized).length > 0 ? sanitized : null;
    }
  } else if (roleChanging && target.role === 'official') {
    // A volunteer's two job keys were their JOB, not a decision about the role they move to (a gate
    // volunteer made Staff must not keep "no scores" without anyone choosing it): they go with the role.
    const kept = withoutVolunteerJob(target.capabilities as Record<string, boolean> | null);
    if (JSON.stringify(kept) !== JSON.stringify(target.capabilities ?? null)) update.capabilities = kept;
  }

  // ⚖ P2 (owner, 2026-10-07): a volunteer always keeps one job. Switching off the last one is refused
  // in words — to end their access, remove them. (Checked before ANY write, the scope rows included.)
  const resultingRole = (update.role as OrgRole | undefined) ?? (target.role as OrgRole);
  const resultingCaps = 'capabilities' in update
    ? (update.capabilities as Record<string, boolean> | null)
    : (target.capabilities as Record<string, boolean> | null);
  if (resultingRole === 'official' && (roleChanging || 'capabilities' in update) && !volunteerJobOf(resultingCaps)) {
    return NextResponse.json({ error: VOLUNTEER_REFUSAL.noJob, code: 'volunteer_no_job' }, { status: 400 });
  }

  if (hasDisplayNameUpdate) {
    const raw = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 60) : '';
    update.display_name = raw || null;
  }

  if (hasTitleUpdate) {
    const raw = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : '';
    update.title = raw || null;
  }

  // Rep group scope update — replace all scope rows for this member
  if (hasRepGroupIdsUpdate) {
    const rawIds = body.repGroupIds;
    const newGroupIds: string[] = Array.isArray(rawIds)
      ? rawIds.filter((id): id is string => typeof id === 'string')
      : [];

    // Validate each ID belongs to this org
    if (newGroupIds.length > 0) {
      const { data: validGroups } = await supabaseAdmin
        .from('rep_team_groups')
        .select('id')
        .eq('org_id', org.id)
        .in('id', newGroupIds);
      const validIds = new Set((validGroups ?? []).map((g: any) => g.id as string));
      const allValid = newGroupIds.every(id => validIds.has(id));
      if (!allValid) {
        return NextResponse.json({ error: 'One or more group IDs are invalid for this org' }, { status: 400 });
      }
    }

    await supabaseAdmin
      .from('org_member_rep_group_scopes')
      .delete()
      .eq('member_id', memberId);

    if (newGroupIds.length > 0) {
      await supabaseAdmin
        .from('org_member_rep_group_scopes')
        .insert(newGroupIds.map(gid => ({ member_id: memberId, group_id: gid })));
    }

    void supabaseAdmin.from('org_audit_log').insert({
      org_id: org.id, actor_id: ctx.user.id, target_id: target.user_id,
      action: 'rep_group_scope_changed',
      payload: { groupIds: newGroupIds },
    });
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseAdmin
    .from('organization_members')
    .update(update)
    .eq('id', memberId)
    .eq('organization_id', org.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log — one row per logical change type
  if (roleChanging) {
    void supabaseAdmin.from('org_audit_log').insert({
      org_id: org.id, actor_id: ctx.user.id, target_id: target.user_id,
      action: 'role_changed', payload: { before: target.role, after: update.role },
    });
  }
  if ('capabilities' in update) {
    void supabaseAdmin.from('org_audit_log').insert({
      org_id: org.id, actor_id: ctx.user.id, target_id: target.user_id,
      action: 'capabilities_changed',
      payload: { before: target.capabilities ?? null, after: update.capabilities ?? null },
    });
  }
  if (hasStatusUpdate && update.status !== target.status) {
    void supabaseAdmin.from('org_audit_log').insert({
      org_id: org.id, actor_id: ctx.user.id, target_id: target.user_id,
      action: update.status === 'suspended' ? 'member_suspended' : 'member_reinstated',
      payload: {},
    });

    // J10-019: notify a newly-suspended member by email (transactional account-state notice) so the
    // /auth/suspended wall they'll hit on next sign-in isn't their first signal. Best-effort.
    if (update.status === 'suspended') {
      void (async () => {
        try {
          const { data: { user: suspendedUser } } = await supabaseAdmin.auth.admin.getUserById(target.user_id);
          if (suspendedUser?.email) {
            await sendEmail(
              suspendedUser.email,
              `Your access to ${org.name} was suspended`,
              memberSuspendedHtml({ orgName: org.name }),
            );
          }
        } catch (e) {
          console.error('[members] suspension email failed:', e);
        }
      })();
    }
  }

  // J10-020: a member whose access changed is told what changed — their role, and the programs
  // they gained or lost — computed by the same `whatTheyCanOpen` the gates use, so the email can
  // never announce a door the server would refuse. A change that alters nothing they can open
  // (an override that restates the default) sends nothing. Best-effort, like the other notices.
  // Only for someone who has joined: a pending invitee hears about the role in their invitation.
  if ((roleChanging || hasCapabilitiesUpdate) && (update.status ?? target.status) === 'active') {
    const before = { role: target.role as OrgRole, capabilities: (target.capabilities as Record<string, boolean> | null) ?? null };
    const after = {
      role: (update.role as OrgRole | undefined) ?? before.role,
      capabilities: 'capabilities' in update ? ((update.capabilities as Record<string, boolean> | null) ?? null) : before.capabilities,
    };
    const changes = describeAccessChange(before, after, org);
    if (changes.length > 0) {
      void (async () => {
        try {
          const { data: { user: changedUser } } = await supabaseAdmin.auth.admin.getUserById(target.user_id);
          if (changedUser?.email) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';
            await sendEmail(
              changedUser.email,
              `Your access to ${org.name} changed`,
              memberAccessChangedHtml({ orgName: org.name, changes, signInUrl: `${appUrl}/auth/login` }),
            );
          }
        } catch (e) {
          console.error('[members] access-change email failed:', e);
        }
      })();
    }
  }

  return NextResponse.json({ ok: true, ...(hasRoleUpdate ? { role: update.role ?? target.role } : {}) });
}, { route: '/api/admin/members/[memberId]' });
