import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  updateRepProgramYear,
  getRepPlayerDuesSchedules,
  getRepDuesPaymentsByProgramYear,
  getRepTeamExpenses,
} from '@/lib/db';
import { duesPaidAmount, paymentsTotalByPlayer } from '@/lib/dues-payments';
import { expenseTotals } from '@/lib/season-settlement';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney, canWriteMoney } from '@/lib/coach-capabilities';
import { resolveCoachSeasonRead } from '@/lib/coach-season-read';

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

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachSeasonRead(orgSlug, teamId, req);
  if ('error' in resolved) return resolved.error;
  const { capabilities, programYear } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // Compute summary stats. Collected = payment FACTS capped per player at their schedule total
  // (mig 232) — the same figure every other dues reader quotes; the stamp-sum this replaced read
  // part-payments as $0.
  const [schedules, seasonPayments] = await Promise.all([
    getRepPlayerDuesSchedules(programYear.id),
    getRepDuesPaymentsByProgramYear(programYear.id),
  ]);
  const paymentsByPlayer = paymentsTotalByPlayer(seasonPayments);
  const duesCollected = schedules.reduce(
    (sum, s) => sum + duesPaidAmount(paymentsByPlayer.get(s.playerId) ?? 0, s.totalAmount), 0);

  // PAID-ONLY, like every other money surface (owner ruling 2026-08-13, thread 1A). This used
  // to sum face values — logging a $1,600 payable you hadn't paid yet flashed the Overview tile
  // "over budget" while the Money hub correctly showed the cash unmoved, two screens apart.
  // Same settled-legs semantics as money-summary and Budget vs. Actual.
  // ONE definition of what a season has spent (lib/season-settlement.ts `expenseTotals`) — this
  // was the third hand-copy of the payable-legs branch, and the copies had already begun to
  // differ: this one had no notion of an out-of-pocket cost at all.
  const expenses = await getRepTeamExpenses(programYear.id);
  const totalExpenses = expenseTotals(expenses).paid;

  return NextResponse.json({
    budgetAmount: programYear.budgetAmount ?? null,
    duesCollected,
    totalExpenses,
    net: (programYear.budgetAmount ?? 0) + duesCollected - totalExpenses,
    programYear,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget' });

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
