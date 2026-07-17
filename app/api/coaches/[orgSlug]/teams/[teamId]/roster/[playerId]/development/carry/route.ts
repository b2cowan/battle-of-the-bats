import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepRosterPlayer,
  getRepTeamContinuityLinks,
  getRepPlayerDevelopmentGoalsForPlayer,
  createRepPlayerDevelopmentGoal,
  setContinuityCarryDecision,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteDevelopment } from '@/lib/coach-capabilities';
import { findConfirmedLink } from '@/lib/continuity-match';

async function resolveContext(orgSlug: string, teamId: string, playerId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const [assignments, player] = await Promise.all([
    getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id),
    getRepRosterPlayer(playerId),
  ]);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };
  if (!player || player.teamId !== teamId || player.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Player not found' }, { status: 404 }) };
  }

  return { ctx, player, assignment };
}

/**
 * The ONE-TIME rollover carry-forward answer (3D). action 'carry' COPIES the directly-linked
 * prior season's WORKING focus areas onto this player (copies, never moves — the archive
 * keeps the originals; measurables are never carried), then stamps the link. action 'fresh'
 * only stamps. Copy is dedup-safe (skips focus areas the player already has, so a retry
 * after a partial failure never duplicates) and the stamp is transition-guarded in the
 * UPDATE (confirmed + unanswered only).
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, playerId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, player, assignment } = resolved;
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can decide this.');
  if (denied) return denied;

  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const action = body.action === 'carry' || body.action === 'fresh' ? body.action : null;
  if (!action) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  // The DIRECT confirmed link for this player — keyed by the roster id OR its originating
  // tryout registration (the accept-boundary alias). Shared resolver + EXPLICIT id priority
  // (own id before the alias) so the offer shown and the offer answered are the same link.
  const links = await getRepTeamContinuityLinks(teamId);
  const link = findConfirmedLink(links, [player.id, player.tryoutRegistrationId]);
  if (!link || link.carryStatus !== null) {
    return NextResponse.json({ error: 'This offer has already been answered.' }, { status: 409 });
  }
  if (action === 'carry' && !link.priorRosterId) {
    return NextResponse.json({ error: 'The linked season has no roster record to bring forward.' }, { status: 409 });
  }

  // CLAIM the one-time decision ATOMICALLY, BEFORE copying anything. setContinuityCarryDecision
  // is a guarded UPDATE (status='confirmed' AND carry_status IS NULL), so of two concurrent
  // requests — two tabs, a double-tap, a phone + laptop — exactly ONE wins a non-null row; the
  // loser gets null and returns 409 without copying. Copying only after the claim means goals
  // can never be duplicated by a race, and the recorded status can never contradict the goals
  // that were written (the reordered fix for the review's concurrency finding).
  const stamped = await setContinuityCarryDecision(link.id, teamId, action === 'carry' ? 'carried' : 'fresh', ctx.user.id);
  if (!stamped) {
    return NextResponse.json({ error: 'This offer has already been answered.' }, { status: 409 });
  }

  // Only the winning request reaches here. Copy the prior season's WORKING focus areas onto
  // this player (copies, never moves — the archive keeps the originals; measurables never
  // carry). Dedup against the player's current goals so a focus area the coach already added
  // by hand isn't duplicated. A copy failure surfaces as 500 (observability-captured); the
  // decision is already recorded, so the banner won't return — any missing area is a manual
  // re-add (rare; these are simple inserts).
  const createdGoals: Awaited<ReturnType<typeof createRepPlayerDevelopmentGoal>>[] = [];
  if (action === 'carry' && link.priorRosterId) {
    const [priorGoals, currentGoals] = await Promise.all([
      getRepPlayerDevelopmentGoalsForPlayer(link.priorRosterId),
      getRepPlayerDevelopmentGoalsForPlayer(playerId),
    ]);
    const existing = new Set(currentGoals.map(g => g.focusArea.trim().toLowerCase()));
    const toCopy = priorGoals.filter(g =>
      g.status === 'working' && !existing.has(g.focusArea.trim().toLowerCase()));
    for (const g of toCopy) {
      createdGoals.push(await createRepPlayerDevelopmentGoal({
        orgId: ctx.org.id,
        teamId,
        playerId,
        focusArea: g.focusArea,
        note: g.note,
        status: 'working',
        createdBy: ctx.user.id,
      }));
    }
  }

  return NextResponse.json({ carryStatus: stamped.carryStatus, goals: createdGoals });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/carry' });
