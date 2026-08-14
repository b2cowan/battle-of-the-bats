import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepDuesPayout,
  removeRepDuesPayout,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';

// ⚠ Active year only — money moves, so an archived season never reaches this route.
async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

// DELETE — the undo. Voids the payout's ledger entry (never deletes it: the books only grow),
// removes the row, and the money goes back to being owed — so that family's bills drop again on
// the next read, with nothing to un-stamp because nothing was ever stamped.
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; payoutId: string }> },) => {
  const { orgSlug, teamId, playerId, payoutId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const payout = await getRepDuesPayout(payoutId);
  if (!payout || payout.playerId !== playerId || payout.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
  }

  await removeRepDuesPayout(payout, { id: team.id, orgId: team.orgId, name: team.name });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-payouts/[payoutId]' });
