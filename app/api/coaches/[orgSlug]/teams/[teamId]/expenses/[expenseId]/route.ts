import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamExpense,
  updateRepTeamExpense,
  deleteRepTeamExpense,
  adoptLedgerLinksForExpense,
  setRepTeamExpenseTags,
  MoneyEditRefusal,
} from '@/lib/db';
import { resolveValidTagIds } from '@/lib/rep-event-tags';
import { whyPaidDateIsRefused, asMoneyAmount, parseInstallmentPlan } from '@/lib/expense-ledger';
import { tournamentToday } from '@/lib/timezone';
import { resolveBudgetItem } from '@/lib/coach-budget-items';
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
 * Edit a money record. ⚖ THE THREE MARK-PAID ACTIONS ARE GONE (Payables Rebuild P2): settling is
 * `Record a payment` on the payments sub-route now, which can say "part of it" and can be undone —
 * the two things the old actions structurally could not (QA §27's blocking defects). A stale tab
 * still sending an `action` gets a sentence pointing at the new door, never a silent partial write.
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; expenseId: string }> },) => {
  const { orgSlug, teamId, expenseId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  /* ⚠⚠ THE RECORD'S OWN SEASON IS RE-ASSERTED, not just its team (/review, 2026-08-16 —
     pre-existing gap, surfaced by the paid-date work because a chosen date is what makes writing
     into a finished season look deliberate rather than obviously wrong).
     Every sibling money route already does this — money-in, dues installments, dues payments,
     payouts all compare the record's `programYearId` to the ACTIVE one. CLAUDE.md's archive ruling
     is explicit that anything moving money stays live-season-only. */
  const expense = await getRepTeamExpense(expenseId);
  if (!expense || expense.teamId !== teamId || expense.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  const body = await req.json();
  const { description, category, notes } = body;

  if (body.action !== undefined) {
    return NextResponse.json(
      { error: 'Mark paid has been replaced — record a payment against the commitment instead.' },
      { status: 400 },
    );
  }

  /* Tags, validated against the team's own + org-shared library before writing.
     A tags-only PATCH remains valid (no other field required) — kept permissive because the shape
     costs nothing and a caller that wants to change only tags should not have to resend the whole
     record to do it. */
  let tagsUpdated = false;
  let appliedTagIds: string[] = [];
  if (body.tagIds !== undefined) {
    const tagIds = await resolveValidTagIds(team.id, ctx!.org.id, 'expense', body.tagIds);
    if (tagIds === null) {
      return NextResponse.json({ error: 'tagIds must be an array of this team’s existing money-tag ids' }, { status: 400 });
    }
    await setRepTeamExpenseTags(expenseId, tagIds);
    appliedTagIds = tagIds;
    tagsUpdated = true;
  }

  const fields: Parameters<typeof updateRepTeamExpense>[1] = {};
  if (description !== undefined) fields.description = description.trim();
  if (category !== undefined) {
    const trimmed = typeof category === 'string' ? category.trim() : '';
    if (trimmed.length > 80) {
      return NextResponse.json({ error: 'Category must be 80 characters or fewer' }, { status: 400 });
    }
    fields.category = trimmed || null;
  }

  /* ── What this cost IS (mig 240) ─────────────────────────────────────────────────────────────
     ⚠ DELIBERATELY NOT LOCKED ON A PAID RECORD. Re-filing a past cost under the right item is
     ordinary bookkeeping: it moves no money, posts nothing, and touches no ledger entry — mig 236's
     links are to the AMOUNT, not to the classification.
     Re-derives the text category from the item too, so an edit cannot leave the pair disagreeing —
     the same rule the create path applies, for the same reason. */
  if (body.budgetItemId !== undefined) {
    const linked = await resolveBudgetItem(body.budgetItemId, ctx!.org.id, teamId, team.sport);
    if (!linked.ok) return NextResponse.json({ error: linked.error }, { status: 400 });
    fields.budgetItemId     = linked.item?.id ?? null;
    fields.budgetCategoryId = linked.item?.categoryId ?? null;
    // Clearing the item leaves whatever category the same request supplied; choosing one wins.
    if (linked.item) fields.category = linked.item.categoryName;
  }
  if (notes !== undefined) fields.notes = notes?.trim() || null;

  // ── Always-editable bookkeeping detail: no figure moves, so no lock applies ──
  if (body.paymentMethod !== undefined) {
    fields.paymentMethod = typeof body.paymentMethod === 'string'
      ? body.paymentMethod.trim().slice(0, 100) || null
      : null;
  }
  if (body.payeeId !== undefined || body.payeePayer !== undefined) {
    fields.payeeId = typeof body.payeeId === 'string' && body.payeeId ? body.payeeId : null;
    fields.payeePayer = typeof body.payeePayer === 'string' ? body.payeePayer.trim() || null : null;
  }

  /* ── The figures: editable, including after they have posted (owner ruling 2026-08-16) ────────
     A payable's plan arrives as explicit installments; a plain cost as its one amount. The server
     carries a settled figure's correction through to the payment that settled it and the entry that
     payment posted — `updateRepTeamExpense` owns that rule and its refusals. */
  if (body.installments !== undefined) {
    if (expense.expenseType !== 'tournament_payable') {
      return NextResponse.json(
        { error: 'A plain cost has one amount — send `amount`, not a schedule.' },
        { status: 400 },
      );
    }
    const parsed = parseInstallmentPlan(body.installments);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    fields.installments = parsed.plan;
  }
  if (body.amount !== undefined) {
    if (expense.expenseType === 'tournament_payable' && body.installments === undefined) {
      return NextResponse.json(
        { error: 'A commitment’s total is the sum of its installments — edit the installments.' },
        { status: 400 },
      );
    }
    if (expense.expenseType !== 'tournament_payable') {
      // Same floor as the create door — a figure that rounds below a cent is not money, and on an
      // out-of-pocket cost it is what a family is owed.
      const amount = asMoneyAmount(body.amount);
      if (amount === null) {
        return NextResponse.json({ error: 'Enter an amount of at least $0.01.' }, { status: 400 });
      }
      fields.amount = amount;
    }
  }

  /* ── Correcting WHEN a cost was paid (owner ruling 2026-08-16) ────────────────────────────────
     ⚠ ONLY A PLAIN COST, and only one with exactly one payment — a commitment's payments each carry
     their own date and are corrected by undoing and re-recording. The refusals for "never paid" and
     "paid in pieces" live in the writer, beside the restatement they guard. */
  if (body.paidDate !== undefined) {
    if (expense.expenseType === 'tournament_payable') {
      return NextResponse.json(
        { error: 'A commitment’s payments each carry their own date — undo the one that is wrong and record it again.' },
        { status: 400 },
      );
    }
    const refusal = whyPaidDateIsRefused(body.paidDate, tournamentToday());
    if (refusal) return NextResponse.json({ error: refusal }, { status: 400 });
    fields.paidDate = body.paidDate;
  }

  /* ⚠ PAID BY IS NOT EDITABLE AT ALL, at any stage — it is not merely locked once paid. An
     out-of-pocket expense is created already-settled AND carries a reimbursement credit owed to
     that family (mig 234). Moving it to another family here would change who is owed without
     touching the credit, leaving a debt recorded against the wrong household — the one failure
     mode in this file that a coach would have no way to see. Changing it means delete and re-add,
     which removes the credit by cascade and writes a fresh one. */
  if (body.paidByPlayerId !== undefined && (body.paidByPlayerId || null) !== expense.paidByPlayerId) {
    return NextResponse.json(
      { error: 'Who paid can’t be changed after saving — it decides which family the team owes. Delete this and enter it again.' },
      { status: 409 },
    );
  }

  /* ⚠ A RENAME MUST CLAIM THE LEDGER LINK BEFORE IT BREAKS IT.
     A payment recorded before mig 236 has no entry id, so an undo or a delete finds its ledger
     entry by MATCHING the description it was posted with. Renaming such a record makes that match
     fail — and a failed match is indistinguishable from "already voided", so the delete would
     remove the record and silently leave a posted entry behind. Adopting the id onto the payment
     row here is permanent and happens once. If the match is AMBIGUOUS we refuse the rename rather
     than let the link go — the coach can still fix everything else about the record. */
  if (fields.description !== undefined && fields.description !== expense.description) {
    try {
      await adoptLedgerLinksForExpense(expense, team);
    } catch (e: any) {
      return NextResponse.json(
        { error: typeof e?.message === 'string' ? e.message : 'Could not match this to its ledger entry.' },
        { status: 409 },
      );
    }
  }

  if (!Object.keys(fields).length && !tagsUpdated) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
  }

  /* ⚠⚠ THE BOOKS MOVE FIRST, THEN THE ROW (owner ruling 2026-08-16) — the order now lives inside
     `updateRepTeamExpense`, which restates the settled payment and its entry, keeps an
     out-of-pocket cost's family credit honest, and writes the plan, all before the row persists.
     Every write is an absolute value, so a coach who hits an error and saves again converges. */
  try {
    const updated = Object.keys(fields).length
      ? await updateRepTeamExpense(expenseId, fields, {
          team: { id: team.id, orgId: team.orgId, name: team.name },
          before: expense,
        })
      : expense;
    return NextResponse.json({ expense: updated, ...(tagsUpdated ? { tagIds: appliedTagIds } : {}) });
  } catch (e: any) {
    /* A refusal's sentence is written for the coach and is shown as-is; the record is untouched.
       Anything else is a real error and stays one. */
    if (e instanceof MoneyEditRefusal) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/expenses/[expenseId]' });

/**
 * Delete an expense or payable, reversing whatever it had posted to the team's books.
 *
 * ⚠ Expenses were the ONLY money record in the coaches portal without this. Dues payments, dues
 * credits, payouts, payment requests and budget lines all had one, so a coach who typed $1,300
 * instead of $130 had that figure on the books permanently (owner review 2026-08-15, Q4).
 *
 * The reversal reads the commitment's own PAYMENTS — each carrying its ledger entry (R5) — and on a
 * part-paid commitment gives back what was ACTUALLY paid, never the total. An ambiguous pre-mig-236
 * match surfaces here as a 409 carrying the sentence the coach should act on — never a 500, because
 * there is nothing broken: we simply will not pick between two identical ledger entries for them.
 */
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; expenseId: string }> },) => {
  const { orgSlug, teamId, expenseId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  /* ⚠⚠ THE RECORD'S OWN SEASON IS RE-ASSERTED, not just its team — same rule and reason as the
     PATCH above: anything moving money stays live-season-only. */
  const expense = await getRepTeamExpense(expenseId);
  if (!expense || expense.teamId !== teamId || expense.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  try {
    const { reversedAmount } = await deleteRepTeamExpense(expense, team);
    return NextResponse.json({ ok: true, reversedAmount });
  } catch (e: any) {
    if (e instanceof MoneyEditRefusal) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/expenses/[expenseId]' });
