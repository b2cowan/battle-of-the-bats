import { NextResponse } from 'next/server';
import {
  sanitizeAssistantGrants, sanitizeStaffKind, resolveCoachCapabilities, STAFF_PRESETS, LAST_HEAD_COACH_MESSAGE,
} from '@/lib/coach-capabilities';
import {
  requireHeadCoachMembership,
  getTeamStaffMembershipById,
  updateStaffMemberAccess,
  setStaffMemberRole,
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
 *
 * ⚠ WIDENED for R8 (pass 2, 2026-09-11): a HEAD-COACH row is now a legal target — for a ROLE
 * change ("Make assistant coach") and for removal, both under the last-head-coach guard — but
 * never for grants (a head coach has none to set) and never for self. `allowHeadCoach` says which.
 */
async function resolveHeadCoachTarget(orgSlug: string, teamId: string, membershipId: string, opts?: { allowHeadCoach?: boolean }) {
  const gate = await requireHeadCoachMembership(orgSlug, teamId);
  if ('error' in gate) return gate;
  const { ctx, team } = gate;

  // Tenancy: a membership id from another team (or org) is a 404, never an edit.
  const target = await getTeamStaffMembershipById(membershipId);
  if (!target || target.teamId !== teamId || target.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Coach not found on this team.' }, { status: 404 }) };
  }

  if (target.coachRole !== 'assistant_coach' && !opts?.allowHeadCoach) {
    return { error: NextResponse.json({ error: 'A head coach has every area — there is nothing to set.' }, { status: 400 }) };
  }
  // Never let a head coach target their own row: the last-head guard would still hold, but "make
  // yourself an assistant" from the only page that needs a head coach to render is a trap.
  if (target.userId === ctx.user.id) {
    return { error: NextResponse.json({ error: 'You cannot change your own role here — ask another head coach.' }, { status: 400 }) };
  }

  return { ctx, team, target };
}

// PATCH — set a member's per-duty grants and/or their kind (the sheet), or change their ROLE
// (R8: `{ coachRole: 'head_coach' | 'assistant_coach' }`). Head coach only. Grants live on the
// membership and apply everywhere at once; the live season's record row is mirrored in the same
// call (the projection invariant — see lib/coach-membership.ts). The kind is a label and is not
// projected.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; coachId: string }> },) => {
  const { orgSlug, teamId, coachId } = await params;
  const body = await req.json().catch(() => ({}));

  // ── A role change (R8) ────────────────────────────────────────────────────────────────────
  if (body.coachRole === 'head_coach' || body.coachRole === 'assistant_coach') {
    const resolved = await resolveHeadCoachTarget(orgSlug, teamId, coachId, { allowHeadCoach: true });
    if ('error' in resolved) return resolved.error!;
    const result = await setStaffMemberRole(resolved.target.id, teamId, body.coachRole);
    if (!result.ok) {
      return result.reason === 'last_head'
        ? NextResponse.json({ error: LAST_HEAD_COACH_MESSAGE }, { status: 409 })
        : NextResponse.json({ error: 'They are no longer on the team’s staff — reload to see the current list.' }, { status: 409 });
    }
    const m = result.membership;
    return NextResponse.json({
      ok: true,
      memberId: m.id,
      coachRole: m.coachRole,
      staffKind: m.staffKind,
      capabilities: resolveCoachCapabilities(m.coachRole, m.capabilities),
    });
  }

  // ── Grants and/or the kind ─────────────────────────────────────────────────────────────────
  const resolved = await resolveHeadCoachTarget(orgSlug, teamId, coachId);
  if ('error' in resolved) return resolved.error!;

  const patch: { capabilities?: ReturnType<typeof sanitizeAssistantGrants>; staffKind?: NonNullable<ReturnType<typeof sanitizeStaffKind>> } = {};
  if (body.capabilities && typeof body.capabilities === 'object') patch.capabilities = sanitizeAssistantGrants(body.capabilities);
  const kind = sanitizeStaffKind(body.kind);
  if (kind) {
    patch.staffKind = kind;
    // A kind CHANGE applies that kind's starting access — the server owns that rule, the same way
    // the invite route does, so a word can never land without the grants it promises. Re-sending
    // the kind already stored is not a change and must not reset customised grants.
    if (!patch.capabilities && kind !== resolved.target.staffKind) patch.capabilities = { ...STAFF_PRESETS[kind] };
  }
  if (!patch.capabilities && !patch.staffKind) {
    return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  }

  // The WHERE re-asserts team + active + assistant — a target removed (or changed) after this
  // screen loaded comes back null instead of silently editing a revoked record.
  const updated = await updateStaffMemberAccess(resolved.target.id, teamId, patch);
  if (!updated) {
    return NextResponse.json(
      { error: 'They are no longer on the team’s staff — reload to see the current list.' },
      { status: 409 },
    );
  }
  return NextResponse.json({
    ok: true,
    memberId: updated.id,
    coachRole: updated.coachRole,
    staffKind: updated.staffKind,
    capabilities: resolveCoachCapabilities('assistant_coach', updated.capabilities),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/staff/[coachId]' });

// DELETE — remove someone from the team: everywhere, at once (membership revoked, live season's
// row dropped, guest org membership cleaned up). Their name stays on the seasons they coached, and
// re-inviting them later reactivates the same membership. Another head coach may be removed —
// never the last one (R8).
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; coachId: string }> },) => {
  const { orgSlug, teamId, coachId } = await params;
  const resolved = await resolveHeadCoachTarget(orgSlug, teamId, coachId, { allowHeadCoach: true });
  if ('error' in resolved) return resolved.error!;
  const { ctx, target } = resolved;

  const removed = await removeStaffMember(ctx.org.id, teamId, target.userId, ctx.user.id, { refuseLastHeadCoach: true });
  if (removed === 'last_head') {
    return NextResponse.json({ error: LAST_HEAD_COACH_MESSAGE }, { status: 409 });
  }
  if (removed === 'nothing') {
    // Nothing active to revoke — a concurrent removal got there first (the call above still
    // re-ran the projection cleanup, which is what makes a repeat click a repair, not a no-op).
    console.warn('[staff DELETE] no active membership to revoke', { teamId, userId: target.userId });
  }
  // Phase 4: drop the removed member from any tournament chat room they no longer belong to.
  await revokeStaleChatMembershipsForCoach(target.userId).catch(() => {});
  return NextResponse.json({ ok: true, removed: removed === 'removed' });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/staff/[coachId]' });
