# Coach Portal Chunk H — Money by Month — PM Brief

**Status:** Planned, awaiting your approval of the mockups and ten decisions.
**Plan:** `COACH_PORTAL_CHUNK_H_MONEY_BY_MONTH_PLAN.md`
**Mockups:** `claude.ai/code/artifact/ab72877e-c0e7-4a46-a1ce-89e6982c104e`
**Who it's for:** the treasurer-coach on a paid team. No change for free coaches, fans, or org admins.

---

## The problem in one sentence

A coach runs the season in a spreadsheet with months across the top — *what do we pay, when, and how
did it land* — and the portal calculates every one of those numbers but shows almost none of them.

Today the monthly maths feeds a single cumulative line chart. There is no month view, no forward
look at cash, no way to get a spreadsheet in or out in that shape, and "payables" are framed as a
tournament-only thing when the machinery handles any commitment.

---

## What the coach sees and does differently

**1. A month view of their budget.** Budget vs. Actual gains a second view: rows are their budget
lines grouped by category, columns are the months of their season, and the totals add up both ways
— the shape of their own spreadsheet. It remembers which view they prefer.

**2. Four ways to read the same grid.** One toggle switches every cell between:
- **Budget** — what they planned for that month
- **Scheduled** — what they've actually committed to pay that month (deposits, balances, due dates)
- **Actual** — what has genuinely been paid
- **Difference** — plan minus reality, and only for months that have already happened. A future
  month shows a dash, never a flattering "under budget" for money nobody has spent yet.

Scheduled and Budget stay separate on purpose. A commitment never quietly becomes part of the
estimate, so nothing is ever counted twice.

**3. "Do we run dry in July?"** Three rows under the grid: money in, money out, running balance —
by month. If the balance dips below zero, the page says which month and by how much, in words. It
projects using whichever lens they're reading, so it's always clear whether they're looking at the
plan or at real commitments.

**4. A "last season" column.** Teams in their second season or later get last year's figure beside
this year's plan, and — more usefully — a quiet list of lines they had last season and have not
planned this season. That's the "what am I forgetting?" question answered with their own history.

**5. Tap a cell, land in the right form.** A budget cell opens the budget line they already know,
with its payment dates open. An actual cell lists that month's paid expenses. Nothing is edited in
the grid itself — it's a way of *getting to* the tools, not a new tool to learn.

**6. Payables stop pretending to be a tournament thing.** "Expenses & Tournament Payables" becomes
"Expenses & Payables". The same form now honestly covers a dome booking, an umpire invoice or an
equipment order — anything with a due date. Nothing changes about how existing records behave.

**7. One place to see everything they owe.** A new "Payment schedule" tab lists every commitment by
due date — deposits, balances and, on club-run teams, the org's allocations — filterable by unpaid
/ paid / all, with overdue flagged. The Money hub's existing "due soon" panel gains a link to it.

**8. Spreadsheets in and out.** Three downloadable templates — a month grid, a simple list, and a
payables schedule — that import back in. Uploading (or pasting) shows a preview first, with a
per-row verdict: this one is new, this one updates an existing line, this one can't be read and
why. Nothing is written until they confirm, and they can fix rows in the preview. Today's export is
tomorrow's import: the columns match.

**Every template ships with the amount cells empty.** A template with example dollars in it is the
product suggesting a number, which the budget-starter decision forbids outright. Structure, never
amounts.

---

## Access and roles

- **Head coach / assistant with money-write:** everything above.
- **Assistant with money-read:** sees the grid, every lens, the cash-flow rows, the prior-season
  column and the payment schedule — all of it read-only. No drill-in to an editor, no import, no
  mark-paid. Money reading is already granted separately from money writing, and this keeps that
  line exactly where it is.
- **Free (Basic) coaches:** unchanged — none of this exists on the free tier.

---

## Why it matters

This is the paid tier's most demanding user doing their most demanding job. The season budget is
already there; what's missing is the *shape* they think in. Every number in the month grid is
already computed and thrown away. The gap is presentation, and closing it turns "I keep my real
budget in Excel and copy it in" into "the portal is where the budget lives."

The import half is the other half of that sentence — a coach with three seasons of history in a
spreadsheet currently has no way in short of retyping it.

---

## Tradeoffs made

- **The grid is desktop-first and scrolls sideways on a phone.** A month grid is a comparison, and
  stacking it into cards would destroy the thing that makes it useful. Same treatment Budget vs.
  Actual already got: the line name stays pinned, a visible cue says there's more to the right.
- **No new database work, and no link between a commitment and a budget line.** Keeping "Scheduled"
  as a separate lens rather than merging it into the plan avoids both a schema change and a whole
  class of double-counting. If flipping between lenses turns out to be annoying in real use, that's
  the moment to revisit linking — not before.
- **The chart on the same page gets a small correction.** Budget lines with no dates are currently
  spread evenly across every month in the cumulative chart. In a grid that would be a visible lie
  ("we budgeted $300 in a month I never chose"), so undated money now gets its own honest "No date
  yet" column — and the chart is corrected to match, or the same page would tell two stories.
- **Nothing is auto-guessed on import.** Names and numbers only. If a row can't be read confidently,
  it's flagged for the coach rather than interpreted.

---

## Priority and sequencing

Medium-high. It follows Chunk G naturally — G creates the budget, H is where the coach lives with it.

**One decision worth taking deliberately:** the view half and the import half are independently
shippable, and I'd recommend shipping the view first, then import immediately after against the same
approved mockups. The month grid reaches you sooner, and the import — which is a brand-new way of
writing data into the books — gets its own undivided adversarial review rather than sharing one with
a large presentation change. Both are designed and mocked up now either way; this is only about
whether they land in one pass or two.

---

## Success criteria

1. A treasurer can answer "what do we owe in March?" without opening a spreadsheet.
2. A coach who is going to run short of cash finds out from the portal, in the month it happens,
   before it happens.
3. A second-season coach can see, in one column, what they budgeted for last year and haven't this
   year.
4. A coach with an existing spreadsheet can get it in — and get it back out in the same shape.
5. No number anywhere in Money originates from the product. Not in a template, not in a placeholder,
   not in a projection label.
6. A money-read assistant can read all of it and change none of it.
