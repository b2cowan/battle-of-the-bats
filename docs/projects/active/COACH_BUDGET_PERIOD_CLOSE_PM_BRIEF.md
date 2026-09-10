# The By-Period Close — PM brief

**Plan:** `COACH_BUDGET_PERIOD_CLOSE_PLAN.md` · **Mockup:** rounds 1–3, owner-approved 2026-09-09.

## What a coach sees differently

**The Budget plan's "By period" view finishes the story it used to start.** Today it spreads what
the season costs and what fundraising brings in, then stops — the coach has to go back to the List
to find out what the players are scheduled to pay, and whether the plan is covered.

After this change the grid closes the same way the List does, but period by period:

- **Player installments** appear as their own row, spread across the periods the dues actually fall
  due in.
- **Shortfall (Buffer)** closes the table — a plain figure is what that period still needs, a
  figure in brackets is that period covered with room to spare.
- The season Total on that last row is the same buffer or shortfall the List already shows.

**Negative money now reads the way it does everywhere else in the portal — in brackets.** The two
money grids were the only screens printing a bare minus sign; they now match the rest of the coach's
money screens. On the plan, a bracketed figure is money arriving ahead of the bills, so it is green.
On Budget vs. Actual's balance rows, a bracketed figure is the account below zero, so it stays red.

**Two figures that used to disagree now agree.** A coach who set a season estimate saw one
"Costs less funding" on the List and a different one on the grid; the grid now shows the part of the
estimate not yet itemized, so both views reach the same number. A team whose fundraising covers the
whole season saw $0.00 on one view and a negative on the other; the List now shows the surplus in
brackets rather than hiding it.

## Why it matters

The By-period view existed to answer "when does the money go out?" and could not answer the obvious
follow-up — "and does what comes in line up?" — without sending the coach to a different tab. For a
treasurer building next season's dues schedule against a plan, those two questions are one question.

The disagreeing figures are the quieter problem: a coach reading a number off one screen and
quoting it from another was, in two real states, quoting two different numbers under one name.

## Role-based access

None. This is a read-only view of the plan; the same coaches who can see the Budget plan today see
these rows. Nothing new is editable here — every edit still happens in the List's own form.

## Priority

Medium-high. It closes two live figure-disagreement defects and completes a screen the owner
described as "a partial report that makes me need to look elsewhere".

## Success criteria

1. The By-period grid's last row's Total matches the List's buffer / shortfall figure, on the same
   plan, in every state.
2. "Costs less funding" shows the same number on both views — with an estimate set, with funding
   above costs, and in the ordinary case.
3. Every column on the grid still adds up: costs − funding − installments = the close.
4. No bare minus sign remains on either money grid.
5. Before dues are set, the two new rows are absent and the coach is offered *Set dues for all
   players* instead.

## Known trade-off, accepted

The plan grid has no running balance, so a period where dues land and no bills fall due shows a
large bracketed figure — correct, but it reads as a swing rather than a state. The owner accepted
this over sending coaches to another screen, and deferred balances to a later piece of work.
