# PM brief — Money back on a cost

**Plan:** `COACH_MONEY_BACK_ON_A_COST_PLAN.md` · **Status:** approved 2026-08-16, not started ·
**Priority:** high — it removes a workaround that currently corrupts the budget

## The problem, in one sentence

A team can record money going out and money coming in as fundraising, but **there is no way to say
"we paid for this and some of it came back"** — so every refund a coach receives is recorded as
something it isn't.

## Why it matters

Refunds are ordinary. A tournament is cancelled. A vendor short-ships. A sponsor covers one cost after
the fact. A club pays back a permit the coach fronted out of the team account.

Right now a coach has two options and both damage the books:

- **Delete the expense** — which erases the fact the team ever paid, and takes the money out of the
  month it actually left in.
- **Log it as fundraising or funding** — which tells the budget that families need to fund less, when
  nothing of the sort happened.

The second is the likelier one, because it looks tidy. It quietly inflates what the season appears to
have raised and understates what a cost actually was, and next season's plan gets built on top of it.

## Who it's for

**Every paid team**, not just club-run ones. This was originally scoped inside the club-money work and
the owner pulled it out on 2026-08-16 for exactly this reason: a coach on a standalone workspace,
whose club isn't on the platform at all, still gets reimbursed and still needs to record it.

## What changes for the coach

- **A third kind on the money form**, beside Expense and Payable: **Money back**. Same form, same
  two questions about what it's against.
- **It lands on the row it repaid.** A $600 permit with $325 back reads as $275 for the season, on
  one line — not two rows to add up.
- **It's dated when it arrived**, so a September refund doesn't rewrite July.
- **Optionally, who it came from** — club, vendor, sponsor, family — as a label on the record, so the
  history reads properly a year later.
- **Cash on hand goes up**, correctly, on the day it arrived.

## What deliberately does *not* change

- **Nobody's dues.** Money coming back doesn't mean families owe less; a coach who wants to pass it on
  does that themselves on the dues screen. Extra money usually gets spent on extra things.
- **It is not "a family paid out of pocket."** That already exists and means the opposite — the family
  paid the vendor directly and the *team owes them*. These two are described identically in plain
  English and mixing them up would either credit a family twice or lose a credit. The plan treats
  keeping them apart as a correctness requirement, not a nicety.

## Success criteria

1. A coach can record a refund without deleting anything and without touching a fundraising figure.
2. The item's row shows what the thing actually cost, net, in one number.
3. A standalone coach with no club anywhere in the picture can use it.

## Risks

- **Confusion with out-of-pocket.** The single biggest one; it moves real money in a family's ledger.
- **A line going negative** reading as good news, if the over/under-budget styling isn't taught to
  handle it.
- **Collision.** It shares a form, a picker and a report with the category+item work in flight, so it
  waits for that release rather than running beside it.
