import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamExpense,
  removePayablePayment,
  MoneyEditRefusal,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';

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

/**
 * DELETE — undo a recorded payment (Payables Rebuild P2, closing QA §27's defect 2).
 *
 * R5: undo IS deleting the payment, and the books reverse by exactly that payment's amount, read
 * from its OWN recorded ledger entry — never a description-and-amount guess (mig 236's lesson). A
 * payment with no entry forks two ways with opposite handling: an out-of-pocket cost moves the
 * family's credit back instead of any cash, and a pre-mig-236 record falls back to the description
 * match, which REFUSES an ambiguous pair rather than voiding a guess.
 *
 * ⚠ Check-then-act: the tenancy conditions this read checks are re-asserted in the WHERE of the
 * delete inside `removePayablePayment`, and a zero-row delete — a double-tapped Undo losing the
 * race — comes back as the same refusal a stale read gets, never as a second reversal.
 */
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; expenseId: string; paymentId: string }> },) => {
  const { orgSlug, teamId, expenseId, paymentId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  /* ⚠ THE RECORD'S OWN SEASON IS RE-ASSERTED — undoing a payment moves money, and anything that
     moves money stays live-season-only (CLAUDE.md's archive ruling). */
  const expense = await getRepTeamExpense(expenseId);
  if (!expense || expense.teamId !== teamId || expense.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  try {
    const result = await removePayablePayment({
      expense,
      team: { id: team.id, orgId: team.orgId, name: team.name },
      paymentId,
    });
    if (!result) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }
    if (!result.removed) {
      // A concurrent undo won the race after our read — same situation as the 404 above from the
      // coach's side, said honestly rather than reported as a second success.
      return NextResponse.json({ error: 'This payment has already been undone.' }, { status: 409 });
    }
    return NextResponse.json({ ok: true, reversedAmount: result.reversedAmount });
  } catch (e: any) {
    /* A refusal's sentence is written for the coach (a pre-mig-236 payment whose ledger entry
       can't be identified uniquely; an out-of-pocket cost whose family credit has gone missing)
       and travels with its own status — same pattern as the sibling expense route. */
    if (e instanceof MoneyEditRefusal) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/expenses/[expenseId]/payments/[paymentId]' });
