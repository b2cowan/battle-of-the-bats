import { refuseWithoutLiveSeat } from '@/lib/coach-season-refusal';
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  updateRepProgramYear,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';

/* ⚠⚠ WRITE-ONLY, ON PURPOSE (2026-10-01). This route used to answer GET as well — the season's
   estimated total, dues collected, the team's own paid bills, and a `net` of the three — and its
   one reader was the team Overview's Budget tile. That reply knew only the ESTIMATE, so a plan
   built from lines read "Not set", and its spend left out the club's bill and every refund, so the
   tile disagreed with the Money hub's headroom. The tile now reads `money-summary`, the Money
   Overview's own payload. ⛔ Do not restore a GET here: a second reply to "what is the budget and
   how much is left?" is the defect, not a convenience. Read `money-summary`. */

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
  if (!assignment) return { error: await refuseWithoutLiveSeat(ctx.org, ctx.user.id, teamId) };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const { budgetAmount } = body;

  // NULL clears the estimated total — a coach who sets one must be able to take it back, and
  // "delete this number" was previously only expressible as a $0 estimate, which is a different
  // and much louder statement (it reads as "this season costs nothing").
  if (budgetAmount === null) {
    const cleared = await updateRepProgramYear(programYear.id, { budgetAmount: null });
    return NextResponse.json({ programYear: cleared });
  }

  if (budgetAmount === undefined || typeof budgetAmount !== 'number' || budgetAmount < 0) {
    return NextResponse.json({ error: 'budgetAmount must be a non-negative number, or null to clear it' }, { status: 400 });
  }

  const updated = await updateRepProgramYear(programYear.id, { budgetAmount });
  return NextResponse.json({ programYear: updated });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget' });
