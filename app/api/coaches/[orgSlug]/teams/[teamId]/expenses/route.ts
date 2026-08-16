import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamExpenses,
  createRepTeamExpense,
  createOutOfPocketExpense,
  getRepTeamTagLibrary,
  getRepTeamExpenseTagsMap,
  setRepTeamExpenseTags,
} from '@/lib/db';
import { resolveValidTagIds } from '@/lib/rep-event-tags';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { tournamentToday } from '@/lib/timezone';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney, canWriteMoney } from '@/lib/coach-capabilities';
import { resolveCoachSeasonRead } from '@/lib/coach-season-read';
import { resolveBudgetItem } from '@/lib/coach-budget-items';

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
  const { ctx, capabilities, programYear } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const expenses = await getRepTeamExpenses(programYear.id);
  // Money-tag library (team + org-shared) for the picker + which tags each expense carries, so the
  // list renders chips and the filter chip-row without a per-expense fetch (mirrors events GET).
  const [expenseTags, tagsByExpenseId] = await Promise.all([
    getRepTeamTagLibrary(teamId, 'expense', ctx.org.id),
    getRepTeamExpenseTagsMap(expenses.map(e => e.id)),
  ]);
  return NextResponse.json({ expenses, expenseTags, tagsByExpenseId });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/expenses' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const {
    expenseType,
    description,
    category = null,
    amount,
    depositAmount = null,
    depositDueDate = null,
    balanceAmount = null,
    balanceDueDate = null,
    eventId = null,
    notes = null,
    paymentMethod = null,
    payeeId = null,
    payeePayer = null,
    paidByPlayerId = null,
    /** mig 240 — what this cost IS: an item from the taxonomy the budget is written in. */
    budgetItemId = null,
  } = body;

  if (!expenseType || !['expense', 'tournament_payable'].includes(expenseType)) {
    return NextResponse.json({ error: 'expenseType must be "expense" or "tournament_payable"' }, { status: 400 });
  }
  if (!description?.trim()) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }

  /* WHAT THIS COST IS (mig 240). Validated against the taxonomy THIS TEAM can see — platform,
     club-published, or its own — and the text category is DERIVED from the item, because an item
     belongs to exactly one category and the report reads both levels.
     ⚠ WHETHER IT WAS BUDGETED IS NOT RECORDED HERE, OR ANYWHERE. It is derived by asking whether a
     budget line exists for the same category and item, which is what let the old "Not in the
     budget" declaration be deleted outright. See lib/coach-budget-items.ts. */
  const linked = await resolveBudgetItem(budgetItemId, ctx!.org.id, team.id, team.sport);
  if (!linked.ok) return NextResponse.json({ error: linked.error }, { status: 400 });
  /* ⚠ REQUIRED ON A NEW COST, and enforced HERE as well as on the form. The form is a courtesy — a
     stale tab, a replay or a direct caller all arrive here — and an unclassified cost is the exact
     "Not itemized" row this change exists to stop producing. ⚠ ONLY ON CREATE: an EDIT may legally
     clear it (a coach fixing a mis-filed cost), and every row written before mig 240 has no item at
     all, so refusing them retroactively would lock coaches out of their own history. */
  if (!linked.item) {
    return NextResponse.json(
      { error: 'Pick a category and item — they line this cost up with your budget.' },
      { status: 400 },
    );
  }

  // Out-of-pocket (owner Call 5): a family covered this cost directly. Validate the player is on
  // THIS season's roster before anything is written — the credit it creates is real money owed.
  let paidByPlayer: { id: string; name: string } | null = null;
  if (paidByPlayerId) {
    if (expenseType !== 'expense') {
      return NextResponse.json(
        { error: 'A payable is billed to the team — only a plain expense can be paid out of pocket.' },
        { status: 400 },
      );
    }
    const { data: row } = await supabaseAdmin
      .from('rep_roster_players')
      .select('id, player_first_name, player_last_name')
      .eq('id', paidByPlayerId)
      .eq('program_year_id', programYear.id)
      .single();
    if (!row) {
      return NextResponse.json({ error: 'Player not found in this program year' }, { status: 404 });
    }
    paidByPlayer = {
      id: row.id,
      name: [row.player_first_name, row.player_last_name].filter(Boolean).join(' ') || 'player',
    };
  }

  // Optional money tags — validated against this team's expense-tag library (own + org-shared)
  // before anything is written, so a stray/cross-team id can't be linked.
  let tagIds: string[] = [];
  if (body.tagIds !== undefined) {
    const resolvedTags = await resolveValidTagIds(team.id, ctx!.org.id, 'expense', body.tagIds);
    if (resolvedTags === null) {
      return NextResponse.json({ error: 'tagIds must be an array of this team’s existing money-tag ids' }, { status: 400 });
    }
    tagIds = resolvedTags;
  }

  const expenseFields = {
    programYearId:  programYear.id,
    teamId:         team.id,
    orgId:          team.orgId,
    expenseType,
    description:    description.trim(),
    // ⚠ A CHOSEN ITEM WINS OVER TYPED TEXT. The form derives the same category client-side, but a
    // stale tab or a direct caller could send a mismatched pair — and the mismatch would be
    // invisible until the report placed the money under one heading and the plan under another.
    category:       linked.item ? linked.item.categoryName : (category?.trim() || null),
    budgetItemId:     linked.item?.id ?? null,
    budgetCategoryId: linked.item?.categoryId ?? null,
    amount,
    depositAmount:  depositAmount != null ? Number(depositAmount) : null,
    depositDueDate: depositDueDate || null,
    balanceAmount:  balanceAmount != null ? Number(balanceAmount) : null,
    balanceDueDate: balanceDueDate || null,
    eventId:        eventId || null,
    notes:          notes?.trim() || null,
    paymentMethod:  paymentMethod?.trim() || null,
    payeeId:        payeeId || null,
    payeePayer:     payeePayer?.trim() || null,
    createdBy:      ctx!.user.id,
  };

  // Out-of-pocket goes through the ONE door that writes the expense and the debt it creates
  // together — a team-paid expense takes the ordinary path. No cash ledger entry either way
  // here: the team's account only moves when a payable/expense is marked paid.
  const { expense, reimbursementCredit } = paidByPlayer
    ? await createOutOfPocketExpense({
        expense: expenseFields,
        playerId: paidByPlayer.id,
        creditDate: tournamentToday(),
      })
    : { expense: await createRepTeamExpense(expenseFields), reimbursementCredit: null };

  if (tagIds.length > 0) {
    await setRepTeamExpenseTags(expense.id, tagIds);
  }

  return NextResponse.json({ expense, tagIds, reimbursementCredit }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/expenses' });
