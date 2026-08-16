# PM brief — money in, money out, money back

**Plan:** [COACH_MONEY_IN_TAXONOMY_PLAN.md](COACH_MONEY_IN_TAXONOMY_PLAN.md) (absorbs
[COACH_MONEY_BACK_ON_A_COST_PLAN.md](COACH_MONEY_BACK_ON_A_COST_PLAN.md))
**Mockup:** https://claude.ai/code/artifact/ee76cc79-ef74-4b78-8b03-5cf28a7f4d37
**Status:** approved 2026-08-16 · **built on dev 2026-08-16** · owner QA **§38**
**Raised by:** the owner, 2026-08-16, reading a real club budget

## The gap

Money going **out** has a shared vocabulary — a plan and a set of books line up row for row. Money
coming **in** is still whatever a coach typed, there is no way to record money arriving at all
unless it came through a fundraiser, and there is no way to say *"we spent this and some of it came
back."*

So a coach who budgets $8,700 of income and takes $9,280 gets two totals with no idea which stream
moved. And a refunded tournament entry has only wrong answers available: delete the expense (erasing
that the team ever paid) or log it as income (claiming the team earned money it didn't).

## What changes for a coach

**One question at the top of a form they already know: what kind of entry is this?**

- **A cost** — money the team spent
- **Income** — money the team earned or was given
- **Money back on something** — a refund, credit or reimbursement of something already recorded

Everything below is unchanged: category, item, amount, optional note. Same form on a budget line and
on a logged entry, so they learn it once and use it four ways.

**Three answers, because accounting has three.** A refund is not income — when a tournament refunds a
cancelled entry the team didn't *earn* $150, it *spent* $150 less. Booking it as income overstates
both what came in and what went out, and every per-item cost figure downstream goes wrong. And only
the coach can tell a club grant from a club reimbursement; they arrive as the same amount, from the
same place, on the same day.

## Budget vs. Actual gets a proper shape

**The default becomes a statement: Revenue, then Expenses, then the season net**, with categories and
items inside each. The shape every treasurer, board and parent already knows, and the one that
answers *"are we going to be short?"*

**A second lens groups by activity instead** — one block per category showing what it earned, what it
cost, and what it netted. That's the one that answers *"did hosting the tournament pay for itself?"*,
which a statement structurally cannot, because a category appears in both its sections.

Both come off the same records and end on the same number.

⚠ **Why sections and not a direction column:** over budget is *good news* on income and *bad news* on
a cost. A single mixed table with an in/out tag was already running two different formulas behind one
column heading, and the only thing distinguishing them was a two-letter tag the eye skips. A section
heading carries that; a column can't.

## Money back never gets its own row

A refund reduces the thing it repaid. Entry fees show **$2,250 on one line** — $2,400 paid, $150
back — with the detail underneath for anyone who wants it. Two rows would make a coach do arithmetic
to answer the question the row exists for.

## The risks worth naming

**Double-counting.** Fundraisers and sponsors already report their own actuals, and player rebates
depend on them, so a category whose actual is already known won't accept a typed one — and the screen
says so. One row, one source.

**The confusable pair.** *"Money back"* is not *"paid out of pocket"*, even though a coach describes
both as "a parent paid me back". One returns money the team spent; the other means the team owes a
family a credit. Confusing them either credits a family twice or loses a credit entirely.

**Nothing here ever changes anyone's dues.** Not on any of the three answers. A coach who receives
extra money usually spends it on extra things — passing it on is a deliberate edit they make on the
screen that owns it.

## Who is affected

| Role | Change |
|---|---|
| Head coach / treasurer | Logs income and refunds as easily as costs; sees expected-vs-actual per stream; gets a real statement and a per-activity view. |
| Standalone premium team | Gets refunds outright, with no club anywhere near them — the case that motivated the money-back half. |
| Club admin | Can publish income words club-wide, same as cost items. |
| Families / players | None. Dues and fundraiser rebates are untouched. |

## What we are deliberately not doing yet

A tournament run on this platform already holds its own entry fees, so that revenue row could fill
itself in. It stays the most valuable idea here — but the vocabulary ships first, and the row won't
change shape to receive the automatic figure later.

## Priority

**High.** This turns the budget from a spending plan into a set of books, and it clears the way for
club money to land in the plan — the item behind it in the queue.

## What shipped, and what is still your call

Everything above is built. Money in has its own list beside Expenses and Payables, the form asks the
three questions, and Budget vs. Actual opens on the statement with **By activity** beside it.

**Two decisions were left with you rather than made quietly:**

1. **The screen is still called *Expenses & Payables*** even though it now holds a *Money in* tab.
   Renaming it touches the Money hub tab, the money rail, the help guide, the demo tour and the
   layout baseline — worth deciding on its own.
2. **Three things this brief's plan asserted turned out not to be true**, and the build corrected
   them: two of the categories §3.6 said already existed did not (*Fundraising Costs* was renamed
   *Fundraising*, and *Sponsorship* was added), the report view is remembered per device rather than
   in the address bar, and one library item ships as **Officials** instead of "Umpires & officials"
   because the platform serves eight sports.

**Before this reaches customers:** migration 243 must be applied to production ahead of the code,
and it sits behind the category + item migrations (238/240/241/242) doing the same.
