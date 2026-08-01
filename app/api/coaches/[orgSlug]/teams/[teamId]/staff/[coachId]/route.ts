import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getRepProgramYear,
  getRepTeamCoachById,
  updateRepTeamCoachCapabilities,
  removeRepTeamCoach,
  cleanupOrphanedCoachMembership,
} from '@/lib/db';
import { sanitizeAssistantGrants, resolveCoachCapabilities, denyUnless } from '@/lib/coach-capabilities';
import { revokeStaleChatMembershipsForCoach } from '@/lib/chat-service';
import { withObservability } from '@/lib/observability';
// Rule 3's declared exception — see tests/unit/coach-season-write-guard.test.ts.
import { resolveCoachSeasonCapabilityMap } from '@/lib/coach-season-read';

/**
 * Governing rule 3 (Chunk F) — the ONE deliberate write surface on a finished season, and the
 * only write path in the coach portal that may address a season other than the live one.
 *
 * It resolves the TARGET'S OWN season rather than the team's active year. Before this it did the
 * opposite, which meant the archive's "Remove access" either (a) deleted the assistant's LIVE
 * assignment on a rolled-forward team, while the screen promised it only affected who could view
 * the archive, or (b) 404'd outright on a team with no live season — i.e. exactly the case the
 * rule exists for. Both were found by `/review` 2026-08-01.
 *
 * Authority is checked against THAT season too: you must have been the head coach of the season
 * you are editing, not merely head coach today.
 */
async function resolveHeadCoachTargetContext(orgSlug: string, teamId: string, coachId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  // The target row names the season — everything else is checked against it.
  const target = await getRepTeamCoachById(coachId);
  if (!target || target.teamId !== teamId) {
    return { error: NextResponse.json({ error: 'Coach not found on this team.' }, { status: 404 }) };
  }

  const programYear = await getRepProgramYear(target.programYearId);
  // Tenancy: a coach row whose season belongs to another team/org is a 404, never an edit.
  if (!programYear || programYear.teamId !== teamId || programYear.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Coach not found on this team.' }, { status: 404 }) };
  }
  const seasonIsClosed = programYear.status === 'completed' || programYear.status === 'archived';

  // Head coach OF THAT SEASON (active or closed) — not "head coach of this team today".
  const capsByYear = await resolveCoachSeasonCapabilityMap(ctx.org, ctx.user.id, teamId);
  const callerCaps = capsByYear.get(programYear.id);
  if (!callerCaps) return { error: forbidden() };
  const denied = denyUnless(callerCaps.isHeadCoach, 'Only the head coach manages the coaching staff.');
  if (denied) return { error: denied };

  // The target must be an ASSISTANT (never the head coach / never self).
  if (target.coachRole !== 'assistant_coach') {
    return { error: NextResponse.json({ error: 'Only assistant coaches can be managed here.' }, { status: 400 }) };
  }
  // Defense-in-depth: never let a head coach target their own row (already blocked by the role check).
  if (target.userId === ctx.user.id) {
    return { error: NextResponse.json({ error: 'You cannot manage your own assignment here.' }, { status: 400 }) };
  }

  return { ctx, team, target, programYear, seasonIsClosed };
}

// PATCH — set an assistant's per-duty grants (the head coach's toggle grid). Head coach only.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; coachId: string }> },) => {
  const { orgSlug, teamId, coachId } = await params;
  const resolved = await resolveHeadCoachTargetContext(orgSlug, teamId, coachId);
  if ('error' in resolved) return resolved.error!;

  // Rule 3 permits exactly ONE write on a finished season: taking access away. The stored grants
  // are the historical record of what that coach could see at the time (rule 1 reads them back),
  // so editing them would rewrite the past rather than change who can look at it.
  if (resolved.seasonIsClosed) {
    return NextResponse.json({
      error: 'This season is finished. What each coach could see is part of its record and can’t be changed — you can still remove their access to it.',
    }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const grants = sanitizeAssistantGrants(body.capabilities ?? body);
  const updated = await updateRepTeamCoachCapabilities(coachId, grants);
  return NextResponse.json({
    ok: true,
    coachId: updated.id,
    capabilities: resolveCoachCapabilities('assistant_coach', updated.capabilities),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/staff/[coachId]' });

// DELETE — remove an assistant from the team. Head coach only. Cleans up an orphaned guest membership.
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; coachId: string }> },) => {
  const { orgSlug, teamId, coachId } = await params;
  const resolved = await resolveHeadCoachTargetContext(orgSlug, teamId, coachId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, target } = resolved;

  await removeRepTeamCoach(coachId);
  await cleanupOrphanedCoachMembership(ctx.org.id, target.userId);
  // Phase 4: drop the removed assistant from any tournament chat room they no longer belong to.
  await revokeStaleChatMembershipsForCoach(target.userId).catch(() => {});
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/staff/[coachId]' });
