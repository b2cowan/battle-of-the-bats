import { NextResponse } from 'next/server';
import { sanitizeAssistantGrants, resolveCoachCapabilities } from '@/lib/coach-capabilities';
import {
  requireHeadCoachMembership,
  getTeamStaffMembershipById,
  updateStaffMemberCapabilities,
  removeStaffMember,
} from '@/lib/coach-membership';
import { revokeStaleChatMembershipsForCoach } from '@/lib/chat-service';
import { withObservability } from '@/lib/observability';

/**
 * M1 (owner ruling 2026-08-16): staff management addresses the TEAM MEMBERSHIP, not a season's
 * row. The `[coachId]` URL segment now carries the membership id. Chunk F's "governing rule 3"
 * (the one deliberate per-season write, so a head coach could revoke a past season's read access
 * row-by-row) is RETIRED — removal from the team is the single control, and it revokes every
 * season at once. Seasons' staff records are never edited from here.
 */
async function resolveHeadCoachTarget(orgSlug: string, teamId: string, membershipId: string) {
  const gate = await requireHeadCoachMembership(orgSlug, teamId);
  if ('error' in gate) return gate;
  const { ctx, team } = gate;

  // Tenancy: a membership id from another team (or org) is a 404, never an edit.
  const target = await getTeamStaffMembershipById(membershipId);
  if (!target || target.teamId !== teamId || target.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Coach not found on this team.' }, { status: 404 }) };
  }

  // The target must be an ASSISTANT (never the head coach / never self).
  if (target.coachRole !== 'assistant_coach') {
    return { error: NextResponse.json({ error: 'Only assistant coaches can be managed here.' }, { status: 400 }) };
  }
  // Defense-in-depth: never let a head coach target their own row (already blocked by the role check).
  if (target.userId === ctx.user.id) {
    return { error: NextResponse.json({ error: 'You cannot manage your own assignment here.' }, { status: 400 }) };
  }

  return { ctx, team, target };
}

// PATCH — set an assistant's per-duty grants (the head coach's toggle grid). Head coach only.
// Grants live on the membership and apply everywhere at once; the live season's record row is
// mirrored in the same call (the projection invariant — see lib/coach-membership.ts).
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; coachId: string }> },) => {
  const { orgSlug, teamId, coachId } = await params;
  const resolved = await resolveHeadCoachTarget(orgSlug, teamId, coachId);
  if ('error' in resolved) return resolved.error!;

  const body = await req.json().catch(() => ({}));
  const grants = sanitizeAssistantGrants(body.capabilities ?? body);
  // The WHERE re-asserts team + active + assistant — a target removed (or changed) after this
  // screen loaded comes back null instead of silently editing a revoked record.
  const updated = await updateStaffMemberCapabilities(resolved.target.id, teamId, grants);
  if (!updated) {
    return NextResponse.json(
      { error: 'They are no longer on the team’s staff — reload to see the current list.' },
      { status: 409 },
    );
  }
  return NextResponse.json({
    ok: true,
    memberId: updated.id,
    capabilities: resolveCoachCapabilities('assistant_coach', updated.capabilities),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/staff/[coachId]' });

// DELETE — remove an assistant from the team: everywhere, at once (membership revoked, live
// season's row dropped, guest org membership cleaned up). Their name stays on the seasons they
// coached, and re-inviting them later reactivates the same membership.
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; coachId: string }> },) => {
  const { orgSlug, teamId, coachId } = await params;
  const resolved = await resolveHeadCoachTarget(orgSlug, teamId, coachId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, target } = resolved;

  const removed = await removeStaffMember(ctx.org.id, teamId, target.userId, ctx.user.id);
  if (!removed) {
    // Nothing active to revoke — a concurrent removal got there first (the call above still
    // re-ran the projection cleanup, which is what makes a repeat click a repair, not a no-op).
    console.warn('[staff DELETE] no active membership to revoke', { teamId, userId: target.userId });
  }
  // Phase 4: drop the removed assistant from any tournament chat room they no longer belong to.
  await revokeStaleChatMembershipsForCoach(target.userId).catch(() => {});
  return NextResponse.json({ ok: true, removed });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/staff/[coachId]' });
