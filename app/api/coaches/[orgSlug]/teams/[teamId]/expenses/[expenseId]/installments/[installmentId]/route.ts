import { NextResponse } from 'next/server';
import {
  getRepTeamExpense,
  getCommitmentStandingFor,
  updateRepTeamExpense,
  MoneyEditRefusal,
} from '@/lib/db';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { asMoneyAmount, isRealCalendarDate } from '@/lib/expense-ledger';
import {
  planScopedInstallmentEdit, planScopedInstallmentDelete, describeScopedOutcome,
} from '@/lib/payable-scope-edit';
import {
  scopeChoiceIsMeaningful, ALL_EDIT_SCOPES,
  type EditScope, type CommitmentStanding,
} from '@/lib/payable-standing';
import { withObservability } from '@/lib/observability';
import type { RepTeam, RepTeamExpense } from '@/lib/types';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';

/**
 * ONE piece of a commitment's plan — changing it, or removing it, with a scope (Payables Rebuild P4).
 *
 * ⚠⚠ WHY THIS IS ITS OWN DOOR AND NOT A FLAG ON THE EXPENSE PATCH. That route takes the WHOLE plan:
 * the form states every row, so there is no ambiguity about reach and no question to ask. This one
 * takes a change to a SINGLE row plus the answer to "how far should that go?" — a different request
 * with a different refusal set. Folding them together would mean one endpoint where `installments`
 * sometimes means "this is the plan" and sometimes means "derive the plan", which is exactly the
 * kind of double-meaning field this project has spent four phases removing.
 *
 * ⚠ IT STILL WRITES THROUGH `updateRepTeamExpense`. The scope module turns the question into a
 * whole desired plan; storing that plan, carrying a settled figure through to the payment that
 * settled it and its entry on the books, and keeping an out-of-pocket cost's family credit honest
 * are all that one writer's job already. A second writer for repeating costs would be a second
 * place for the books to drift.
 */
/** The shared front half of both verbs: auth, the record, its season, and where it stands. */
type ResolvedTarget =
  | { error: Response }
  | { error: null; team: RepTeam; expense: RepTeamExpense; standing: CommitmentStanding };

async function resolveTarget(
  orgSlug: string, teamId: string, expenseId: string, installmentId: string,
): Promise<ResolvedTarget> {
  /* ⚠ THE AUTH / TENANCY / ASSIGNMENT / SEASON CHAIN IS THE SHARED ONE, not a hand-copy
     (`/simplify`, reuse lens, 2026-08-20). `lib/coach-route-context.ts` exists precisely because
     that chain was hand-declared in ~53 coach route files and the third new copy had already
     silently dropped a step the other two had; its own header says it is "the shared home the next
     one should use", and this route is the next one. ⚠ `resolveLiveCoachTeamContext`, not
     `coach-team-read` — this route WRITES, and the live-season resolver is what keeps a write out
     of a season that has ended. */
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return { error: resolved.error };
  const { team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return { error: denied };

  /* The record and its schedule are independent reads keyed on the same id, so they go together
     rather than one after the other. A bad expense id costs one wasted query and still 404s below
     — the checks that matter are unchanged, they just run after both answers are in. */
  const [expense, standing] = await Promise.all([
    getRepTeamExpense(expenseId),
    getCommitmentStandingFor(expenseId),
  ]);

  /* ⚠⚠ THE RECORD'S OWN SEASON IS RE-ASSERTED, not just its team — anything that moves money stays
     live-season-only (CLAUDE.md's archive ruling; every sibling money route does the same). */
  if (!expense || expense.teamId !== teamId || expense.programYearId !== programYear.id) {
    return { error: NextResponse.json({ error: 'Expense not found' }, { status: 404 }) };
  }
  if (expense.expenseType !== 'tournament_payable') {
    return { error: NextResponse.json(
      { error: 'A plain cost has one amount — edit the cost itself.' }, { status: 400 }) };
  }

  /* ⚠ THE PIECE MUST BE ONE OF *THIS* COMMITMENT'S. The id arrives in the URL and is otherwise
     unconstrained; the standing is the only thing that knows which pieces belong here. The scope
     module refuses a stray id too, but the 404 belongs at the door. */
  if (!standing.installments.some(i => i.id === installmentId)) {
    return { error: NextResponse.json({ error: 'That payment is not part of this bill.' }, { status: 404 }) };
  }
  return { error: null, team, expense, standing };
}

/**
 * ⚠ S4 — the three-way question is only ASKED when it has more than one answer, and a request that
 * arrives with a scope on a commitment where it cannot matter is not refused, it is narrowed. The
 * screen hides the picker; a stale tab that still shows it must not be able to widen a change
 * beyond what the coach can currently see.
 */
function effectiveScope(standing: Parameters<typeof scopeChoiceIsMeaningful>[0], targetId: string, asked: unknown): EditScope | null {
  const scope = ALL_EDIT_SCOPES.includes(asked as EditScope) ? asked as EditScope : null;
  if (!scope) return null;
  return scopeChoiceIsMeaningful(standing, targetId) ? scope : 'this';
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; expenseId: string; installmentId: string }> },) => {
  const { orgSlug, teamId, expenseId, installmentId } = await params;
  const target = await resolveTarget(orgSlug, teamId, expenseId, installmentId);
  if (target.error) return target.error;
  const { team, expense, standing } = target;

  const body = await req.json();
  const scope = effectiveScope(standing, installmentId, body.scope);
  if (!scope) {
    return NextResponse.json(
      { error: 'Say how far this change should reach: this payment, this and later, or all unpaid.' },
      { status: 400 },
    );
  }

  const change: { amount?: number; dueDate?: string } = {};
  if (body.amount !== undefined) {
    const amount = asMoneyAmount(body.amount);
    if (amount === null) {
      return NextResponse.json({ error: 'Every installment needs an amount of at least $0.01.' }, { status: 400 });
    }
    change.amount = amount;
  }
  if (body.dueDate !== undefined) {
    // A DUE date is legitimately in the future, so it takes the calendar check alone — never the
    // paid-date validator beside it, which refuses tomorrow.
    if (!isRealCalendarDate(body.dueDate)) {
      return NextResponse.json({ error: 'Every installment needs a due date — that is what puts it on your payment schedule.' }, { status: 400 });
    }
    change.dueDate = body.dueDate;
  }
  if (change.amount === undefined && change.dueDate === undefined) {
    return NextResponse.json({ error: 'Nothing to change — give an amount or a due date.' }, { status: 400 });
  }

  const outcome = planScopedInstallmentEdit(standing, installmentId, scope, change);
  if (outcome.refusal) return NextResponse.json({ error: outcome.refusal }, { status: 400 });
  if (outcome.touched.length === 0) {
    // Saving the values that are already there is a no-op, not an error — say so and write nothing.
    return NextResponse.json({ expense, touched: [], summary: null });
  }

  try {
    const updated = await updateRepTeamExpense(expenseId, { installments: outcome.plan },
      { team: { id: team.id, orgId: team.orgId, name: team.name }, before: expense });
    return NextResponse.json({
      expense: updated,
      touched: outcome.touched,
      // The same sentence the coach was shown before confirming — echoed back so a screen that
      // reports what happened cannot word it differently from the one that asked.
      summary: describeScopedOutcome(outcome, 'change'),
    });
  } catch (e: any) {
    if (e instanceof MoneyEditRefusal) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/expenses/[expenseId]/installments/[installmentId]' });

/**
 * Remove one scheduled payment — S7.
 *
 * ⚠ Money recorded against the piece being removed is NOT lost and is not a refusal: it re-applies
 * to what remains, earliest piece first (R3), which is the ordinary rule rather than a special case.
 * It IS refused when there is nowhere for that money to land, because the bill would silently start
 * reading as over-paid — and refused when it would leave the commitment with no schedule at all
 * (R1). Deleting the whole bill is a different action, with its own confirmation and its own refund.
 */
export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; expenseId: string; installmentId: string }> },) => {
  const { orgSlug, teamId, expenseId, installmentId } = await params;
  const target = await resolveTarget(orgSlug, teamId, expenseId, installmentId);
  if (target.error) return target.error;
  const { team, expense, standing } = target;

  // The scope rides in the query string: a DELETE body is legal but not universally forwarded.
  const asked = new URL(req.url).searchParams.get('scope');
  const scope = effectiveScope(standing, installmentId, asked);
  if (!scope) {
    return NextResponse.json(
      { error: 'Say how far this should reach: this payment, this and later, or all unpaid.' },
      { status: 400 },
    );
  }

  const outcome = planScopedInstallmentDelete(standing, installmentId, scope);
  if (outcome.refusal) return NextResponse.json({ error: outcome.refusal }, { status: 400 });

  try {
    const updated = await updateRepTeamExpense(expenseId, { installments: outcome.plan },
      { team: { id: team.id, orgId: team.orgId, name: team.name }, before: expense });
    return NextResponse.json({
      expense: updated,
      touched: outcome.touched,
      summary: describeScopedOutcome(outcome, 'remove'),
    });
  } catch (e: any) {
    if (e instanceof MoneyEditRefusal) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/expenses/[expenseId]/installments/[installmentId]' });
