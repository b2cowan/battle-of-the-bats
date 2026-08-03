import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepRosterPlayer,
  createRepPlayerDevelopmentGoal,
} from '@/lib/db';
import type { RepDevelopmentGoalStatus } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteDevelopment } from '@/lib/coach-capabilities';
import { readFocusArea, verifyFocusTag } from '@/lib/development-goal-input';

const VALID_STATUSES: RepDevelopmentGoalStatus[] = ['working', 'achieved', 'parked'];

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

  // Year-scope guard (Batch 3 rider): a goal attaches to a roster ROW, which is season-
  // scoped — only the ACTIVE season's rows may take new goals ("read-only past season"
  // must hold per-row, not just per-team). The assignment already names the active year
  // (draft|active-filtered lookup), so no extra query is needed. The carry flow reads
  // prior-season rows via its own route.
  if (player.programYearId !== assignment.programYearId) {
    return { error: NextResponse.json({ error: 'This player belongs to a past season, which is read-only.' }, { status: 409 }) };
  }

  return { ctx, player, assignment };
}

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, playerId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can edit development.');
  if (denied) return denied;

  let body: { focusArea?: unknown; note?: unknown; status?: unknown; tagId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ⚠ The focus area and its optional grouping tag are validated by the SHARED helpers — the
  // tryout seeding route (Phase 2) writes goals too, and the 80-character rule and the
  // tag-ownership check must not exist as two copies (/simplify 2026-08-02). They are called
  // SEPARATELY, in the original order — focus → note → status → tag — because collapsing them
  // changed which error a doubly-invalid payload gets back (/review, 2026-08-02).
  const area = readFocusArea(body);
  if ('error' in area) return area.error;
  const { focusArea } = area;

  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (note.length > 280) {
    return NextResponse.json({ error: 'Note is too long (max 280 characters).' }, { status: 400 });
  }
  const status = (typeof body.status === 'string' ? body.status : 'working') as RepDevelopmentGoalStatus;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const tag = await verifyFocusTag(body, { orgId: ctx.org.id, teamId });
  if ('error' in tag) return tag.error;
  const { tagId } = tag;

  const goal = await createRepPlayerDevelopmentGoal({
    orgId: ctx.org.id,
    teamId,
    playerId,
    focusArea,
    note: note || null,
    status,
    tagId,
    createdBy: ctx.user.id,
  });
  return NextResponse.json({ goal }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development/goals' });
