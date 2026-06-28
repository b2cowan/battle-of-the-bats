import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ALL_CAPABILITY_KEYS, hasCapability } from '@/lib/roles';
import type { OrgRole } from '@/lib/types';
import { sendEmail, memberSuspendedHtml, memberRemovedHtml } from '@/lib/email';
import {
  cleanupBasicCoachTeamsForUserDeletion,
  countActiveBasicCoachTeamMembershipsForUser,
} from '@/lib/basic-coach-teams';
import { withObservability } from '@/lib/observability';

const VALID_CAPABILITIES = new Set<string>(ALL_CAPABILITY_KEYS);

type Params = { params: Promise<{ memberId: string }> };

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

  // Capabilities, status, and rep group scope changes are owner-only
  if (hasCapabilitiesUpdate && ctx.role !== 'owner') return forbidden();
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

  const update: Record<string, unknown> = {};

  if (hasRoleUpdate) {
    // Accept admin | staff | official; never allow promoting to owner via this endpoint
    update.role =
      body.role === 'admin' ? 'admin'
      : body.role === 'staff' ? 'staff'
      : body.role === 'official' ? 'official'
      : 'staff';
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
        if (VALID_CAPABILITIES.has(key) && typeof val === 'boolean') {
          sanitized[key] = val;
        }
      }
      // Empty object → null (no overrides stored)
      update.capabilities = Object.keys(sanitized).length > 0 ? sanitized : null;
    }
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
  if (hasRoleUpdate && update.role !== target.role) {
    void supabaseAdmin.from('org_audit_log').insert({
      org_id: org.id, actor_id: ctx.user.id, target_id: target.user_id,
      action: 'role_changed', payload: { before: target.role, after: update.role },
    });
  }
  if (hasCapabilitiesUpdate) {
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

  return NextResponse.json({ ok: true, ...(hasRoleUpdate ? { role: update.role } : {}) });
}, { route: '/api/admin/members/[memberId]' });
