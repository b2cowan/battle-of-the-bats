# PM Brief — Fixing a money record you got wrong

**Plan:** `COACH_EXPENSES_EDIT_DELETE_PLAN.md` · **Owner QA:** ledger §27 · **Status:** on dev
2026-08-15, awaiting QA · **Carries a database change** (must reach production before the code)

---

## The problem, in one line

A coach who typed **$1,300 instead of $130** had that number on the team's books permanently.

Expenses were the only money record in the coaches portal with no way to edit and no way to delete.
Dues payments, dues credits, payouts, payment requests and budget lines all had both. The only thing
a coach could change on a saved expense was its tags.

---

## What a coach can do now

**Fix anything.** A pencil on every row — or tap the row itself — reopens the record. Names,
categories, notes and tags can always be corrected.

**Delete anything, and be told what it costs.** Delete sits in the form, and if the record was
already paid the confirmation states the money consequence in dollars before you can agree to it:
*"This has already posted $1,300.00 out of the team's books. Deleting it will reverse that, so cash
on hand goes back up by $1,300.00."* If a family paid out of pocket, it also says their credit
disappears with it.

**⚖ Correct anything, and the books follow** *(revised 2026-08-16 — this replaces "see why something
can't change")*. The first version of this screen locked a paid record's amount: the figure was on
the team's books and nothing could carry a correction through to them, so the form showed the amount
with a reason and told the coach to delete and re-enter. The owner reversed that — a mistyped amount
should be a two-second fix, not a reversal of real money. **Now every figure is editable, including
after it has posted**, and saving moves the matching entry on the books with it: cash on hand
follows the new figure and the cost lands in the month you dated it. Where a family paid out of
pocket, what the team owes them moves too. The form says what the change will do instead of
preventing it. Two things still can't be corrected in place — a small number of costs paid before
mid-August whose entry can't be matched unambiguously, and *who* paid a cost out of pocket, which
moves a debt between households.

**Add without choosing a door first.** Two lime buttons became one. The Expense-or-Payable choice
now sits at the top of the form, already set to whichever list you were looking at, and switching it
keeps everything you've typed. The comparison — *money already spent* versus *money promised but not
paid* — travels with the switch, so the distinction is explained where the decision happens rather
than only on an empty screen.

**Stop three spellings of the same thing.** Payment method suggests what your teams have used
before, on a seeded list of the common ones, so "E-Transfer" stops competing with "etransfer" and
"e transfer". Free text still works.

---

## Why it matters

Money records are the one place in the portal where being wrong is expensive and invisible. A
mistyped figure flows into the budget, into Budget vs. Actual, into what families are asked to pay,
and into the season settlement. Until now the only remedy was to work around it.

The delete-and-reverse behaviour is the part worth defending: **it tells the coach the size of what
they're about to undo, in dollars, before they agree.** A treasurer who can't see that consequence
either doesn't correct the mistake, or corrects it and quietly puts the books out of step with the
club ledger.

---

## Trade-offs made

- **Tagging got slower.** It used to be two clicks in place; it's now open-the-record, edit, save.
  Accepted because tagging mostly happens at entry time, and a row offering both "edit everything"
  and "edit only tags" is two doors to the same record.
- **A paid amount cannot be edited at all** — the correction is delete and re-enter. The alternative
  (editing the figure and adjusting the books underneath) is the kind of silent rewrite a money
  field must not do.
- **A saved record can't switch between expense and payable.** Tempting, because an unpaid expense
  really is a payable without a due date — but conversion means fields appearing on an existing
  record and schedules silently disappearing. Deleting and re-adding is now cheap.
- **No Tags column** on the table, despite tags being newly visible on every row. Tags are sparse,
  and Category already occupies that slot.

---

## Access

Everything here needs **money edit** access, the same as logging an expense. A read-only money
assistant sees the records and can still export, but is offered no pencil, no Add and no Delete —
they are never shown a door the server would refuse.

---

## How to check it

Owner QA ledger **§27** carries the walk-through. The three things worth most attention:

1. ⚖ *(revised 2026-08-16)* Edit a **paid** expense's amount — it should save, and **cash on hand
   should move by the difference**. Change its date too and check the cost lands in that month on
   Budget vs. Actual. Nothing should be greyed out.
2. Delete a **paid** expense — read the dollar figure before confirming, then check cash on hand
   moved by exactly that amount.
3. Open a **part-paid payable** — both halves are editable; changing the paid one moves the books,
   changing the open one does not.
4. ⚖ *(new)* Edit the amount of a cost a **family paid out of pocket** — what the team owes that
   family on Player Dues must move with it, and no team cash should move at all.

---

## What this unblocks

**Recurring payables** (its own plan, a parallel session) is waiting on this: its "Repeats" group
lives in the Add Payable form and must be absent from the Expense side of the new switch, and its
editable-series sheet is a convenience over rows that must each be fixable on their own first.
