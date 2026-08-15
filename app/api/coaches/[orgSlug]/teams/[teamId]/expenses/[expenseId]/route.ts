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
  getOrCreateRepTeamLedger,
  createEntry,
  setRepTeamExpenseTags,
} from '@/lib/db';
import { resolveValidTagIds } from '@/lib/rep-event-tags';
import { lockedFields } from '@/lib/expense-ledger';
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

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; expenseId: string }> },) => {
  const { orgSlug, teamId, expenseId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const expense = await getRepTeamExpense(expenseId);
  if (!expense || expense.teamId !== teamId) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  const body = await req.json();
  const { action, description, category, notes } = body;

  /* ── What a PAID record still lets you change (owner ruling 2026-08-15) ──────────────────────
     Descriptive edits stay open; anything that moved money locks. The PREDICATE is shared with the
     form (lib/expense-ledger.ts) so the two can't drift — read that function for the per-half rule
     and why "paid by" is unconditional.

     ⚠ THIS IS THE ONLY PLACE THE RULE IS ENFORCED. The form greys the locked fields, but a form is
     a courtesy; a stale tab, a replayed request or a second coach saving concurrently all arrive
     here. Silently ignoring a locked field would be worse than refusing — the coach would see a
     save succeed and the number not change. */
  const locks = lockedFields(expense);
  const rejectLocked = (label: string, wasPaidOn: string | null) => NextResponse.json(
    { error: `${label} can’t change — this was marked paid${wasPaidOn ? ` on ${wasPaidOn.slice(0, 10)}` : ''} and the amount is already on the team’s books. Delete it and enter it again to correct the figure.` },
    { status: 409 },
  );

  /* Tags, validated against the team's own + org-shared library before writing.
     A tags-only PATCH remains valid (no action or other field required) even though nothing sends
     one any more — the per-row tag editor that did was removed 2026-08-15 and tags now travel with
     the rest of the record's form. Kept permissive because the shape costs nothing and a caller
     that wants to change only tags should not have to resend the whole record to do it. */
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

  const patch: Parameters<typeof updateRepTeamExpense>[1] = {};
  if (description !== undefined) patch.description = description.trim();
  if (category !== undefined) {
    const trimmed = typeof category === 'string' ? category.trim() : '';
    if (trimmed.length > 80) {
      return NextResponse.json({ error: 'Category must be 80 characters or fewer' }, { status: 400 });
    }
    patch.category = trimmed || null;
  }
  if (notes !== undefined) patch.notes = notes?.trim() || null;

  // ── Always-editable bookkeeping detail: no figure moves, so no lock applies ──
  if (body.paymentMethod !== undefined) {
    patch.paymentMethod = typeof body.paymentMethod === 'string'
      ? body.paymentMethod.trim().slice(0, 100) || null
      : null;
  }
  if (body.payeeId !== undefined || body.payeePayer !== undefined) {
    patch.payeeId = typeof body.payeeId === 'string' && body.payeeId ? body.payeeId : null;
    patch.payeePayer = typeof body.payeePayer === 'string' ? body.payeePayer.trim() || null : null;
  }

  /* ── Figures: gated on whether the half they belong to has already posted ──
     ⚠ A payable's total is NOT its deposit + balance — it is the commitment, and the halves are how
     it gets paid. `lockedFields` therefore locks a payable's total only once BOTH halves are paid,
     which is why one gate serves both record kinds here. */
  if (body.amount !== undefined) {
    if (locks.amount) {
      return rejectLocked(
        expense.expenseType === 'tournament_payable' ? 'The total' : 'The amount',
        locks.paidOn,
      );
    }
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 });
    }
    patch.amount = amount;
  }

  /* ⚠ NO NaN SENTINEL. An earlier draft returned NaN from a `number | null` helper to mean
     "invalid", which type-checks as perfectly good money and would have flowed straight into a
     database write the moment a caller forgot to test for it. Each half validates where it is
     assigned instead, so an invalid value has no path to `patch` at all. */
  const readHalfAmount = (v: unknown): { ok: true; value: number | null } | { ok: false } => {
    if (v === null || v === '' || v === undefined) return { ok: true, value: null };
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? { ok: true, value: n } : { ok: false };
  };

  if (body.depositAmount !== undefined || body.depositDueDate !== undefined) {
    if (locks.deposit) return rejectLocked('The deposit', expense.depositPaidAt);
    if (body.depositAmount !== undefined) {
      const parsed = readHalfAmount(body.depositAmount);
      if (!parsed.ok) return NextResponse.json({ error: 'Enter a valid deposit amount' }, { status: 400 });
      patch.depositAmount = parsed.value;
    }
    if (body.depositDueDate !== undefined) patch.depositDueDate = body.depositDueDate || null;
  }
  if (body.balanceAmount !== undefined || body.balanceDueDate !== undefined) {
    if (locks.balance) return rejectLocked('The balance', expense.balancePaidAt);
    if (body.balanceAmount !== undefined) {
      const parsed = readHalfAmount(body.balanceAmount);
      if (!parsed.ok) return NextResponse.json({ error: 'Enter a valid balance amount' }, { status: 400 });
      patch.balanceAmount = parsed.value;
    }
    if (body.balanceDueDate !== undefined) patch.balanceDueDate = body.balanceDueDate || null;
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
     Anything paid before mig 236 has no recorded entry id, so a delete finds its ledger entry by
     MATCHING the description it was posted with. Renaming such a record makes that match fail — and
     a failed match is indistinguishable from "already voided", so the delete would remove the record
     and silently leave a posted entry behind, after telling the coach the money was coming back.
     Migration 236's own comment predicted exactly this and left it open; this closes it.
     Adopting the id here is permanent and happens once, so a record only pays this cost the first
     time it is renamed. If the match is AMBIGUOUS we refuse the rename rather than let the link go —
     the coach can still fix everything else about the record. */
  if (patch.description !== undefined && patch.description !== expense.description) {
    try {
      Object.assign(patch, await adoptLedgerLinksForExpense(expense, team));
    } catch (e: any) {
      return NextResponse.json(
        { error: typeof e?.message === 'string' ? e.message : 'Could not match this to its ledger entry.' },
        { status: 409 },
      );
    }
  }

  const ledger = await getOrCreateRepTeamLedger(team.orgId, team.id, team.name);
  const now = new Date().toISOString();

  /* ⚠ THE FIGURES ABOUT TO BE STORED, not the ones this request arrived to find.
     A single PATCH may carry BOTH a figure edit and a mark-paid action. The mark-paid branches
     below post a ledger entry, and they used to read the amount off the row as fetched — so a
     request that raised an unpaid expense from $100 to $500 and marked it paid in one go stored
     $500 while posting $100 to the books. Nothing would have looked wrong: the row says $500, it
     locks at $500, and a later delete would promise the coach $500 back while actually returning
     $100. That is precisely the "the confirmation and the reversal must agree" failure the shared
     ledger module exists to prevent, reintroduced one layer up. Caught by the correctness lens,
     2026-08-15.
     The portal's own UI never sends both in one request — but this route's stated threat model is
     the stale tab and the replay, and both can. */
  const effectiveAmount = patch.amount ?? expense.amount;
  const effectiveDepositAmount = patch.depositAmount !== undefined ? patch.depositAmount : expense.depositAmount;
  const effectiveBalanceAmount = patch.balanceAmount !== undefined ? patch.balanceAmount : expense.balanceAmount;

  if (action === 'markExpensePaid') {
    if (expense.expensePaidAt) {
      return NextResponse.json({ error: 'Expense already marked paid' }, { status: 409 });
    }
    // ⚠ AN OUT-OF-POCKET COST IS ALREADY SETTLED — a family paid it, and no team cash ever moves
    // for it (owner Call 5, mig 234). Such an expense is created already-paid, so reaching this
    // action at all means something is out of step; posting a cash-out entry here would invent an
    // outflow the account never had and put the coach's "Cash on hand" at odds with the org
    // ledger for exactly that amount (/review 2026-08-14).
    if (expense.paidByPlayerId) {
      return NextResponse.json(
        { error: 'A family paid this out of pocket, so it is already settled — no team money leaves the account for it.' },
        { status: 409 },
      );
    }
    const entry = await createEntry(
      ledger.id,
      {
        entryDate: now.slice(0, 10),
        description: expense.description,
        amount: effectiveAmount,
        entryType: 'expense',
        status: 'posted',
        category: expense.category ?? 'Team Expense',
      },
      ctx!.user.id,
    );
    patch.expensePaidAt = now;
    /* ⚠ RECORDING THIS IS WHAT MAKES DELETE ABLE TO GIVE THE MONEY BACK (mig 236). It used to be
       discarded here — `void entry`, under a comment claiming the table had nowhere to put it,
       while `accounting_entry_id` had existed with a foreign key the whole time. Without it a
       delete has to GUESS which ledger row belongs to this expense, and once descriptions became
       editable that guess stops being safe. */
    patch.accountingEntryId = entry.id;
  } else if (action === 'markDepositPaid') {
    if (expense.expenseType !== 'tournament_payable') {
      return NextResponse.json({ error: 'Only tournament payables have a deposit' }, { status: 400 });
    }
    if (expense.depositPaidAt) {
      return NextResponse.json({ error: 'Deposit already marked paid' }, { status: 409 });
    }
    /* ⚠ POSTING A HALF WITHOUT ITS OWN AMOUNT ALSO RECORDS THAT AMOUNT.
       A deposit with no `deposit_amount` posts the payable's TOTAL. If that stays unrecorded, the
       row keeps saying "no deposit amount" while the books hold one, the total stays editable
       (`lockedFields` only locks it once both halves pay), and a later edit to the total makes the
       delete confirmation quote a figure that was never posted. Writing it down here means the
       reversal always reads back exactly what went out. */
    const depositAmt = effectiveDepositAmount ?? effectiveAmount;
    if (effectiveDepositAmount == null) patch.depositAmount = depositAmt;
    const depositEntry = await createEntry(
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
    patch.depositEntryId = depositEntry.id;
  } else if (action === 'markBalancePaid') {
    if (expense.expenseType !== 'tournament_payable') {
      return NextResponse.json({ error: 'Only tournament payables have a balance' }, { status: 400 });
    }
    if (expense.balancePaidAt) {
      return NextResponse.json({ error: 'Balance already marked paid' }, { status: 409 });
    }
    // Same rule as the deposit above — record what was actually posted.
    const balanceAmt = effectiveBalanceAmount ?? effectiveAmount;
    if (effectiveBalanceAmount == null) patch.balanceAmount = balanceAmt;
    const balanceEntry = await createEntry(
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
    patch.balanceEntryId = balanceEntry.id;
  }

  if (!Object.keys(patch).length && !tagsUpdated) {
    return NextResponse.json({ error: 'No valid action or fields provided' }, { status: 400 });
  }

  const updated = Object.keys(patch).length ? await updateRepTeamExpense(expenseId, patch) : expense;
  return NextResponse.json({ expense: updated, ...(tagsUpdated ? { tagIds: appliedTagIds } : {}) });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/expenses/[expenseId]' });

/**
 * Delete an expense or payable, reversing whatever it had posted to the team's books.
 *
 * ⚠ Expenses were the ONLY money record in the coaches portal without this. Dues payments, dues
 * credits, payouts, payment requests and budget lines all had one, so a coach who typed $1,300
 * instead of $130 had that figure on the books permanently (owner review 2026-08-15, Q4).
 *
 * The reversal itself, and the rule for finding entries recorded before mig 236, live in
 * `deleteRepTeamExpense`. An ambiguous historic match surfaces here as a 409 carrying the sentence
 * the coach should act on — never a 500, because there is nothing broken: we simply will not pick
 * between two identical ledger entries on their behalf.
 */
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; expenseId: string }> },) => {
  const { orgSlug, teamId, expenseId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { team, assignment } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const expense = await getRepTeamExpense(expenseId);
  if (!expense || expense.teamId !== teamId) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  try {
    const { reversedAmount } = await deleteRepTeamExpense(expense, team);
    return NextResponse.json({ ok: true, reversedAmount });
  } catch (e: any) {
    // The one expected failure: a pre-mig-236 payment whose ledger entry can't be identified
    // uniquely. The message is written for the coach, so pass it straight through.
    if (typeof e?.message === 'string' && e.message.includes('ledger')) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/expenses/[expenseId]' });
