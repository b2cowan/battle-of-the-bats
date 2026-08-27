import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamExpense,
  recordPayablePayment,
  MoneyEditRefusal,
} from '@/lib/db';
import { whyPaidDateIsRefused, asMoneyAmount } from '@/lib/expense-ledger';
import { tournamentToday } from '@/lib/timezone';
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
 * POST — record a payment against a commitment (Payables Rebuild P2, closing QA §27's defect 1).
 *
 * The payment is recorded against the COMMITMENT (R3): `commitmentStanding()` applies it to the
 * earliest unfilled installment and spills forward, so nobody types that arithmetic. An optional
 * `installmentId` is the coach's override — "this one was for March" — deciding where the pour
 * STARTS, and is null for the ordinary case.
 *
 * ⚠ OVER-PAYMENT IS ACCEPTED, NEVER REFUSED (R6). No figure here is compared to the commitment's
 * total: the money genuinely left the account, and refusing to record it teaches coaches to type a
 * figure that is not what happened, which is how a book stops matching a bank statement. The screen
 * says "$N over"; the server does not argue with reality.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; expenseId: string }> },) => {
  const { orgSlug, teamId, expenseId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  /* ⚠ THE RECORD'S OWN SEASON IS RE-ASSERTED, not just its team — anything that moves money stays
     live-season-only (CLAUDE.md's archive ruling; every sibling money route does the same). */
  const expense = await getRepTeamExpense(expenseId);
  if (!expense || expense.teamId !== teamId || expense.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  const body = await req.json();

  const amount = asMoneyAmount(body.amount);
  if (amount === null) {
    return NextResponse.json({ error: 'Enter an amount of at least $0.01.' }, { status: 400 });
  }

  /* ⚠ `whyPaidDateIsRefused` is the ONE validator every door that records a payment uses — a real
     calendar date, never in the future (a payment that has not happened is a commitment, and this
     record already is one). Its sentence is written for the coach. */
  const paidDate = typeof body.paidDate === 'string' ? body.paidDate : '';
  const refusal = whyPaidDateIsRefused(paidDate, tournamentToday());
  if (refusal) return NextResponse.json({ error: refusal }, { status: 400 });

  const method = typeof body.method === 'string' ? body.method.trim().slice(0, 100) || null : null;
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) || null : null;
  // The writer itself asserts the override is one of THIS commitment's own pieces.
  const installmentId = typeof body.installmentId === 'string' && body.installmentId
    ? body.installmentId
    : null;

  /* ⚠⚠ WHO ACTUALLY PAID IT (money centralization P4, mig 267) — the $200-deposit case. The form
     has offered this question since P1 and the answer was DROPPED ON THE FLOOR here, so a coach
     could name a family, save, and be told the team's cash left while that household was owed
     nothing. The writer validates the roster and refuses a payer that disagrees with one the cost
     already names; this only has to stop passing the answer through as a string. */
  const paidByPlayerId = typeof body.paidByPlayerId === 'string' && body.paidByPlayerId
    ? body.paidByPlayerId
    : null;

  try {
    const payment = await recordPayablePayment({
      expense,
      team: { id: team.id, orgId: team.orgId, name: team.name },
      amount,
      paidDate,
      method,
      note,
      installmentId,
      paidByPlayerId,
      createdBy: ctx!.user.id,
    });
    return NextResponse.json({ payment }, { status: 201 });
  } catch (e: any) {
    /* A refusal's sentence is written for the coach (a stray installment id, an out-of-pocket cost
       whose family credit has gone missing) and travels with its own status — same pattern as the
       sibling expense route. Anything else is a real error and stays one. */
    if (e instanceof MoneyEditRefusal) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/expenses/[expenseId]/payments' });
