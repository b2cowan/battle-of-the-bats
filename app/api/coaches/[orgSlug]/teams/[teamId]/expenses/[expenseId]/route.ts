import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamExpense,
  updateRepTeamExpense,
  getOrCreateRepTeamLedger,
  createEntry,
} from '@/lib/db';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext();
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; expenseId: string }> },
) {
  const { orgSlug, teamId, expenseId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, team } = resolved;

  const expense = await getRepTeamExpense(expenseId);
  if (!expense || expense.teamId !== teamId) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  const body = await req.json();
  const { action, description, category, notes } = body;

  const patch: Parameters<typeof updateRepTeamExpense>[1] = {};
  if (description !== undefined) patch.description = description.trim();
  if (category !== undefined) patch.category = category?.trim() || null;
  if (notes !== undefined) patch.notes = notes?.trim() || null;

  const ledger = await getOrCreateRepTeamLedger(team.orgId, team.id, team.name);
  const now = new Date().toISOString();

  if (action === 'markExpensePaid') {
    if (expense.expensePaidAt) {
      return NextResponse.json({ error: 'Expense already marked paid' }, { status: 409 });
    }
    const entry = await createEntry(
      ledger.id,
      {
        entryDate: now.slice(0, 10),
        description: expense.description,
        amount: expense.amount,
        entryType: 'expense',
        status: 'posted',
        category: expense.category ?? 'Team Expense',
      },
      ctx!.user.id,
    );
    patch.expensePaidAt = now;
    // Track entry id via notes since the expense table doesn't have a single entryId column;
    // the ledger entry is authoritative for accounting purposes.
    void entry;
  } else if (action === 'markDepositPaid') {
    if (expense.expenseType !== 'tournament_payable') {
      return NextResponse.json({ error: 'Only tournament payables have a deposit' }, { status: 400 });
    }
    if (expense.depositPaidAt) {
      return NextResponse.json({ error: 'Deposit already marked paid' }, { status: 409 });
    }
    const depositAmt = expense.depositAmount ?? expense.amount;
    await createEntry(
      ledger.id,
      {
        entryDate: now.slice(0, 10),
        description: `${expense.description} — Deposit`,
        amount: depositAmt,
        entryType: 'expense',
        status: 'posted',
        category: expense.category ?? 'Tournament Payable',
      },
      ctx!.user.id,
    );
    patch.depositPaidAt = now;
  } else if (action === 'markBalancePaid') {
    if (expense.expenseType !== 'tournament_payable') {
      return NextResponse.json({ error: 'Only tournament payables have a balance' }, { status: 400 });
    }
    if (expense.balancePaidAt) {
      return NextResponse.json({ error: 'Balance already marked paid' }, { status: 409 });
    }
    const balanceAmt = expense.balanceAmount ?? expense.amount;
    await createEntry(
      ledger.id,
      {
        entryDate: now.slice(0, 10),
        description: `${expense.description} — Balance`,
        amount: balanceAmt,
        entryType: 'expense',
        status: 'posted',
        category: expense.category ?? 'Tournament Payable',
      },
      ctx!.user.id,
    );
    patch.balancePaidAt = now;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'No valid action or fields provided' }, { status: 400 });
  }

  const updated = await updateRepTeamExpense(expenseId, patch);
  return NextResponse.json({ expense: updated });
}
