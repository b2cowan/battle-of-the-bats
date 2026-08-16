# PM brief — Club money belongs in the team's plan

**Plan:** `COACH_ORG_MONEY_IN_THE_BUDGET_PLAN.md` · **Status:** approved 2026-08-15, not started
(waits on the budget-line alignment work) · **Priority:** high — it makes an existing report wrong

## The problem, in one sentence

A coach whose team is run by a club can see what the club has billed them, and can see it leave the
bank account — but their **budget report pretends none of it exists**.

## Why it matters

Budget vs. Actual and the headroom figure on the Money hub are what a coach reads to answer *"can we
afford this?"*. On a club-run team those numbers are currently missing every dollar the club charges
and every dollar the club contributes.

On our own QA team the gap is $2,120 against a $5,000 season — the report says there is $1,930 of
room when a fifth of the season's costs are invisible to it. Cash on hand, which does count club
money, quietly disagrees with the budget card sitting beside it. A coach has no way to tell which
one to believe, and the answer is the less prominent one.

This is not a missing nicety. It is a report that is confidently wrong for every club-run team, and
club-run teams are the Club-plan customer.

## What changes for the coach

- **Club bills join the plan.** Each allocation instalment counts as real spending against the
  budget, and unpaid ones show as commitments coming due — the same way a payable already does.
- **Club contributions join the plan too**, and the coach says what they were: **new money** from the
  club, which gives the season more to work with, or **money back** on something the team already
  paid for, which lowers that cost instead. Only the coach knows which, so only the coach decides.
- **Money nobody planned for still gets a name.** A club sponsorship this team never budgeted has no
  line to file against, so the coach builds one right there — a funding category (Sponsorship,
  Fundraising, or a new one they name) and an item. It appears on the report as its own row with
  nothing in the Budget column, the same way the report already shows a cost that was charged but
  never planned. **Money in ends up shaped exactly like money out**, so there is nothing new to learn
  on either side of the ledger.
- **Neither choice changes anybody's dues.** A coach who gets extra funding usually spends it on
  extra things — more equipment, another tournament — so the product never decides on their behalf
  that families should pay less. Passing it on is a deliberate act, made on the dues screen.
- **Nothing has to be filed to be visible.** Club money lands in a "Club costs" or "Club funding"
  bucket immediately; pointing it at a specific budget line is a refinement, not homework.
- **Headroom stops lying**, and stops contradicting Cash on hand.

## What deliberately does *not* change

- **A coach still cannot alter what the club has billed them.** They choose which of *their own*
  budget lines it counts against — nothing more.
- **A request the club hasn't approved stays out of the budget.** It might be declined; money you
  might not get has no business in a report people plan against.
- **We are not adding an "include pending" switch.** The report already has a *Scheduled* lens
  meaning exactly "committed but not yet paid", and unpaid club instalments belong in it. A second
  control saying the same thing in different words is how a product ends up with five ways to do one
  job — the mistake the table pass spent a day undoing.

## Success criteria

1. On a club-run team, the budget headroom figure and Cash on hand no longer disagree about club
   money.
2. Every dollar the club has billed appears somewhere on Budget vs. Actual without the coach doing
   anything first.
3. A coach can record a reimbursement in a way that lowers the cost it repaid, and record a club
   grant as money the season has gained — and **neither one moves a single family's dues**.

## Risks

- **Double counting.** Club money already moves Cash on hand. If the plan counts an arrival as both
  funding *and* a cost reversal, a season looks twice as healthy as it is. The plan makes this an
  explicit either/or.
- **A negative reading as good news.** A cost line can now go below zero. Left alone, the existing
  "under budget" styling would render that as a success rather than a filing mistake.
- **Collision.** This sits on top of the budget-line work currently in flight. Building both at once
  would put two chats in the same rule, the same report and the same picker.
- **A ruling changed under a built feature.** Giving money in a category and an item reverses the
  2026-08-13 decision that money-in lines have neither — a decision already shipped to dev. It has to
  be folded into that work rather than bolted on, and it raises a question only the owner should
  answer: whether "Sponsorship" being a category means the separate sponsorship *kind* should go
  away. It sits in a dozen places, and the last time this enum changed it broke nineteen readers
  silently, in a way that would have over-billed families. Plan §3.2b sets it out.
