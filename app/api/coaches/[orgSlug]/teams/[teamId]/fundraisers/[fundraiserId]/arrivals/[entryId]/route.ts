import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepFundraiser,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { undoSponsorArrival } from '@/lib/sponsor-arrivals-server';

/**
 * DELETE — undo one arrival (mig 268): its family credits, its dated income row and the entry
 * itself are removed together, and undoing the LAST arrival returns the sponsor to a pledge.
 * The payout floor is asked per family BEFORE anything is touched (lib/sponsor-arrivals-server) —
 * cash already handed back against an accrued credit refuses the undo with the shared sentence.
 */
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
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string; entryId: string }> },) => {
  const { orgSlug, teamId, fundraiserId, entryId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const fundraiser = await getRepFundraiser(fundraiserId, team.id, programYear.id);
  if (!fundraiser) return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 });
  if ((fundraiser.kind ?? 'fundraiser') !== 'sponsor') {
    return NextResponse.json({ error: 'Arrivals belong to sponsors.' }, { status: 400 });
  }

  const result = await undoSponsorArrival({
    programYearId: programYear.id,
    fundraiser: { id: fundraiser.id, name: fundraiser.name },
    entryId,
  });
  if ('error' in result) return result.error;

  return NextResponse.json({ ok: true, nowPledged: result.nowPledged });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/arrivals/[entryId]' });
