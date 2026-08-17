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
  syncExpenseBooksForEdit,
} from '@/lib/db';
import { resolveValidTagIds } from '@/lib/rep-event-tags';
import { whyPaidDateIsRefused, asMoneyAmount } from '@/lib/expense-ledger';
import { tournamentToday, orgDayAsStoredInstant } from '@/lib/timezone';
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
     payouts all compare the record's `programYearId` to the ACTIVE one. Expenses was the outlier:
     it checked the team and stopped, so a coach who carries on with the team next season could
     still mark paid, re-file or delete a cost belonging to a year that Season's End has already
     reported as final. CLAUDE.md's archive ruling is explicit that anything moving money stays
     live-season-only; this is that rule, enforced where it was missing. */
  const expense = await getRepTeamExpense(expenseId);
  if (!expense || expense.teamId !== teamId || expense.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  const body = await req.json();
  const { action, description, category, notes } = body;

  /* ── What a PAID record lets you change: everything (owner ruling 2026-08-16) ────────────────
     This block used to refuse a figure edit on anything that had posted. The owner reversed that
     ruling — *"once it is edited the new value should permeate to the books and everything be in
     sync"* — so the refusals are gone and `syncExpenseBooksForEdit` carries the correction through
     to the entry the money created. `lib/expense-ledger.ts` records the reversal and why the
     original rule existed.

     ⚠ TWO THINGS STILL REFUSE, and neither is a lock on a figure: a record paid before the ledger
     link existed can only be corrected if its entry can be matched unambiguously, and WHO paid a
     cost out of pocket is a debt moving between households rather than a figure being restated. */
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

  /* ── What this cost IS (mig 240) ─────────────────────────────────────────────────────────────
     ⚠ DELIBERATELY NOT LOCKED ON A PAID RECORD, unlike the amount beside it. Re-filing a past cost
     under the right item is ordinary bookkeeping: it moves no money, posts nothing, and touches no
     ledger entry — mig 236's links are to the AMOUNT, not to the classification. Locking it would
     leave a coach who mis-filed a paid invoice with only one remedy, delete-and-re-enter, which
     reverses and re-posts real money to fix a label. `lockedFields` is unchanged for exactly that
     reason: this is not a figure.

     Re-derives the text category from the item too, so an edit cannot leave the pair disagreeing —
     the same rule the create path applies, for the same reason. */
  if (body.budgetItemId !== undefined) {
    const linked = await resolveBudgetItem(body.budgetItemId, ctx!.org.id, teamId, team.sport);
    if (!linked.ok) return NextResponse.json({ error: linked.error }, { status: 400 });
    patch.budgetItemId     = linked.item?.id ?? null;
    patch.budgetCategoryId = linked.item?.categoryId ?? null;
    // Clearing the item leaves whatever category the same request supplied; choosing one wins.
    if (linked.item) patch.category = linked.item.categoryName;
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

  /* ── Figures: editable, including after they have posted (owner ruling 2026-08-16) ──
     The previous ruling froze a paid figure because nothing could carry a correction through to the
     books. `syncExpenseBooksForEdit` does, so the refusals that used to sit in this block are gone
     and the books are moved to match instead. See `lib/expense-ledger.ts` for the reversal. */
  if (body.amount !== undefined) {
    // Same floor as the create door — a figure that rounds below a cent is not money (see
    // `asMoneyAmount`), and on an out-of-pocket cost it is what a family is owed.
    const amount = asMoneyAmount(body.amount);
    if (amount === null) {
      return NextResponse.json({ error: 'Enter an amount of at least $0.01.' }, { status: 400 });
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

  /* ⚠⚠ A HALF THAT HAS BEEN PAID CANNOT BE EMPTIED (/review, 2026-08-16, High). Clearing the field
     is legitimate on an OPEN half — it un-schedules it — but on a paid one it is money that already
     left, and `paidLedgerLegs` reads a half with no amount of its own as the record's TOTAL. So a
     blank deposit box on a $500 payable whose $100 deposit had posted made the sync "correct" that
     entry from $100 to $500: a silent $400 addition to the team's spending, from an empty field on
     an unrelated save. The form sends both halves on every save, so this needed no ill intent. */
  const halfCleared = (v: unknown) => v === null || v === '' ;
  if (body.depositAmount !== undefined || body.depositDueDate !== undefined) {
    if (body.depositAmount !== undefined) {
      if (expense.depositPaidAt && halfCleared(body.depositAmount)) {
        return NextResponse.json(
          { error: 'The deposit has been paid, so it needs an amount. Enter what was paid, or delete this and enter it again.' },
          { status: 400 },
        );
      }
      const parsed = readHalfAmount(body.depositAmount);
      if (!parsed.ok) return NextResponse.json({ error: 'Enter a valid deposit amount' }, { status: 400 });
      patch.depositAmount = parsed.value;
    }
    if (body.depositDueDate !== undefined) patch.depositDueDate = body.depositDueDate || null;
  }
  if (body.balanceAmount !== undefined || body.balanceDueDate !== undefined) {
    if (body.balanceAmount !== undefined) {
      if (expense.balancePaidAt && halfCleared(body.balanceAmount)) {
        return NextResponse.json(
          { error: 'The balance has been paid, so it needs an amount. Enter what was paid, or delete this and enter it again.' },
          { status: 400 },
        );
      }
      const parsed = readHalfAmount(body.balanceAmount);
      if (!parsed.ok) return NextResponse.json({ error: 'Enter a valid balance amount' }, { status: 400 });
      patch.balanceAmount = parsed.value;
    }
    if (body.balanceDueDate !== undefined) patch.balanceDueDate = body.balanceDueDate || null;
  }

  /* ── Correcting WHEN a cost was paid (owner ruling 2026-08-16) ────────────────────────────────
     The date became askable when the cost was recorded; this is the other half — a coach who picked
     the wrong day can fix it, and the entry on the books moves to that day with it, which is what
     puts the cost in the right month on the report.
     ⚠ ONLY A LUMP EXPENSE, and only one that has actually posted. A payable's halves carry their
     own paid dates and are corrected through their own fields; unpaid means there is no date to
     correct, and setting one here would claim money moved without posting any. */
  if (body.expensePaidAt !== undefined) {
    if (expense.expenseType === 'tournament_payable') {
      return NextResponse.json(
        { error: 'A payable is dated by its deposit and its balance, not as one commitment.' },
        { status: 400 },
      );
    }
    if (!expense.expensePaidAt) {
      return NextResponse.json(
        { error: 'This has not been paid yet — use Mark Paid to record when the money moved.' },
        { status: 400 },
      );
    }
    const refusal = whyPaidDateIsRefused(body.expensePaidAt, tournamentToday());
    if (refusal) return NextResponse.json({ error: refusal }, { status: 400 });
    const restamped = orgDayAsStoredInstant(body.expensePaidAt);
    if (!restamped) return NextResponse.json({ error: 'Enter the date this was paid.' }, { status: 400 });
    patch.expensePaidAt = restamped;
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
  /* WHEN THIS WAS PAID (2026-08-16). Every mark-paid branch below used `now` for both the row's
     stamp and its ledger entry, so a bill settled last month landed in this month's column on the
     month grid and could never be corrected — the grid exists to say WHEN money moved.
     ⚠ THE DEFAULT IS THE ORG'S TODAY, not a UTC instant: a Toronto club marking a bill paid at 8pm
     is still on today's date, while UTC has already rolled over.
     ⚠ The row keeps a TIMESTAMP when the answer is today, so nothing about an ordinary same-day
     mark-paid changes; only a back-dated one stores a bare date, which is all it can honestly know. */
  const today = tournamentToday();
  const paidDateRaw = typeof body.paidDate === 'string' ? body.paidDate : today;
  if (action && action.startsWith('mark')) {
    const refusal = whyPaidDateIsRefused(paidDateRaw, today);
    if (refusal) return NextResponse.json({ error: refusal }, { status: 400 });
  }
  const paidDate = paidDateRaw;
  /* ⚠⚠ EVERY PAID DAY IS STORED AT ORG NOON — including today's (/review, 2026-08-16).
     The first version kept the real `now()` when the answer was today, to leave an ordinary
     same-day mark-paid byte-for-byte unchanged. That preservation was the bug: several readers
     take the calendar day off this column by slicing the ISO string, so a coach in Toronto marking
     a bill paid at 9:30 PM on Aug 31 stored `2026-09-01T01:30Z` and put the cost in SEPTEMBER on
     Budget vs. Actual. Org noon cannot cross a UTC day boundary from any zone the platform serves,
     so one rule for both cases is both simpler and the only correct one.
     ⚠ No time-of-day is lost that anything reads: this column answers WHICH DAY money moved, and
     every reader treats it as a date or as a null check. */
  const paidStamp = orgDayAsStoredInstant(paidDate);
  if (!paidStamp) {
    return NextResponse.json({ error: 'Enter the date this was paid.' }, { status: 400 });
  }

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
    /* ⚠⚠ A PAYABLE CANNOT BE SETTLED THROUGH THIS DOOR (/review, 2026-08-16 — pre-existing gap,
       not introduced by the paid-date work, but reached through the same branch).
       Its two siblings below both refuse the wrong record type; this one never did. A payable sent
       here posted a ledger entry for its FULL amount under the plain description, and then stayed
       invisible: `paidLedgerLegs` reads only the deposit and balance stamps for a payable, so the
       total never locked, both halves could still be marked paid afterwards — posting the money a
       second and third time — and deleting the record reversed $0 while the first entry stayed on
       the books forever with no screen able to find it. The UI never offers this combination; a
       stale tab or a direct caller does. */
    if (expense.expenseType === 'tournament_payable') {
      return NextResponse.json(
        { error: 'A payable is settled by paying its deposit and its balance, not all at once.' },
        { status: 400 },
      );
    }
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
        entryDate: paidDate,
        description: expense.description,
        amount: effectiveAmount,
        entryType: 'expense',
        status: 'posted',
        category: expense.category ?? 'Team Expense',
      },
      ctx!.user.id,
    );
    patch.expensePaidAt = paidStamp;
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
        entryDate: paidDate,
        description: `${expense.description} — Deposit`,
        amount: depositAmt,
        entryType: 'expense',
        status: 'posted',
        category: expense.category ?? 'Tournament Payable',
      },
      ctx!.user.id,
    );
    patch.depositPaidAt = paidStamp;
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
        entryDate: paidDate,
        description: `${expense.description} — Balance`,
        amount: balanceAmt,
        entryType: 'expense',
        status: 'posted',
        category: expense.category ?? 'Tournament Payable',
      },
      ctx!.user.id,
    );
    patch.balancePaidAt = paidStamp;
    patch.balanceEntryId = balanceEntry.id;
  }

  if (!Object.keys(patch).length && !tagsUpdated) {
    return NextResponse.json({ error: 'No valid action or fields provided' }, { status: 400 });
  }

  /* ⚠⚠ THE BOOKS MOVE FIRST, THEN THE ROW (owner ruling 2026-08-16). Both orders leave a window
     where the two could disagree, and this is the one that RECOVERS: every write the sync makes is
     an absolute value, so a coach who hits an error and saves again converges on the right answer.
     Persisting the row first would break that — the retry would compare the new row against itself,
     find nothing changed, and leave the books stranded on the old figure with nothing to notice it
     by. The delete path reasons the same way and for the same reason.
     ⚠ Only figures and dates reach the books; a description or a re-filed item posts nothing, which
     is why the sync compares the legs rather than the whole record. */
  const intended = {
    ...expense,
    ...(patch.amount         !== undefined ? { amount: patch.amount } : {}),
    ...(patch.depositAmount  !== undefined ? { depositAmount: patch.depositAmount } : {}),
    ...(patch.balanceAmount  !== undefined ? { balanceAmount: patch.balanceAmount } : {}),
    ...(patch.expensePaidAt  !== undefined ? { expensePaidAt: patch.expensePaidAt } : {}),
    ...(patch.depositPaidAt  !== undefined ? { depositPaidAt: patch.depositPaidAt } : {}),
    ...(patch.balancePaidAt  !== undefined ? { balancePaidAt: patch.balancePaidAt } : {}),
  };
  /* ⚠ IT RUNS ON EVERY REQUEST, INCLUDING A MARK-PAID ONE (/review, 2026-08-16, High). The first
     version skipped the sync whenever an action was present, reasoning that mark-paid POSTS an
     entry rather than correcting one. But this handler happily accepts a figure edit riding along
     with an action — the stale tab its own comments are written about — so a request that marked a
     balance paid AND changed an already-paid deposit wrote the new deposit figure to the row while
     leaving that deposit's entry on the old one, permanently, with a 200. The sync only ever looks
     at legs that had ALREADY posted before this request, so a half being paid right now is invisible
     to it and there is nothing to skip for. */
  try {
    await syncExpenseBooksForEdit({ before: expense, intended, team });
  } catch (e: any) {
    /* The matcher's own sentence is written for a coach ("more than one entry matches it
       exactly…"), so it is shown as-is and the record is left untouched. */
    return NextResponse.json(
      { error: typeof e?.message === 'string' ? e.message : 'Could not update the team’s books for this change.' },
      { status: 409 },
    );
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
  const { team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  /* ⚠⚠ THE RECORD'S OWN SEASON IS RE-ASSERTED, not just its team (/review, 2026-08-16 —
     pre-existing gap, surfaced by the paid-date work because a chosen date is what makes writing
     into a finished season look deliberate rather than obviously wrong).
     Every sibling money route already does this — money-in, dues installments, dues payments,
     payouts all compare the record's `programYearId` to the ACTIVE one. Expenses was the outlier:
     it checked the team and stopped, so a coach who carries on with the team next season could
     still mark paid, re-file or delete a cost belonging to a year that Season's End has already
     reported as final. CLAUDE.md's archive ruling is explicit that anything moving money stays
     live-season-only; this is that rule, enforced where it was missing. */
  const expense = await getRepTeamExpense(expenseId);
  if (!expense || expense.teamId !== teamId || expense.programYearId !== programYear.id) {
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
