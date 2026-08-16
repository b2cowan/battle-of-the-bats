# PM brief — the budget speaks in category + item

**Plan:** [COACH_BUDGET_ITEM_ALIGNMENT_PLAN.md](COACH_BUDGET_ITEM_ALIGNMENT_PLAN.md)
**Status:** **built on dev 2026-08-15** · owner QA = ledger **§29** · one database change (240,
applied to dev; production application is a release step)
**Mockups:** https://claude.ai/code/artifact/945391e9-3c17-46ff-b855-8c67fcd5f117
**Raised by:** the owner, 2026-08-15, from the Edit Budget Line form

## The problem, on one screen

A coach picks the item **Entry Fees** from the list. Their budget then shows a row called **"test"**
— the free text they happened to type. The thing they chose from a shared list is invisible; the
thing nobody else can recognise is the identity.

That single screen is why the budget report and the spending report have never lined up. You cannot
match two reports on words somebody typed.

## What changes

**A budget groups two levels: category, then item. The item names the row.**

> **TOURNAMENTS** · $2,700
> Entry fees · 2 lines — $2,700

Two lines on the same item **sum into one row**. Whatever was typed on each line becomes a note —
kept, readable when you open the line, and never on a report.

**Spending records the same two things.** Which means the report can finally show this:

> **OFFICIALS** · not budgeted
> Umpire fees · 3 costs — budgeted **—** · actual **$600** · **−$600**

*Every item the team spent on, planned or not, in one list.* An item with a plan compares against it.
An item with no plan says so. That's the question that started this — **what did we get charged for
that we never budgeted?** — and today it has no answer.

## What a coach stops having to do

The form no longer asks *"What is this against?"*, and there is no more **"Not in the budget"**
choice. **Whether something was planned is now worked out for you**: if a budget line exists for that
category and item, it was planned; if not, it wasn't. The coach says what the cost *is*, and never
has to declare where it belongs.

That's a control removed from the busiest money form, one week after it was added — see "The
trade-off we're accepting" below.

## Item vs. description, settled

This confused the owner, which means it confuses everyone:

- **Item** — which standard thing this is, from a list your club shares. It's the name of the budget
  row and the key both reports line up on.
- **Description** — what you call one particular purchase. Six entry fees share an item; no two share
  a description.

So **description leaves the budget line** (Notes covers anything worth saying) and **stays on an
expense**, where it names one real transaction on your books. One exception, and it's a rule you
already made: a **fundraising or sponsorship line** has no category and no item, so its description
is its name and stays required.

## Where the words come from

Making the item the name only works if the list is worth picking from — and right now **no club has
ever added an item to it**, because nothing depended on it. So the library gets an owner at each
level:

| | Who adds it | Who sees it |
|---|---|---|
| **Platform** | us | everyone |
| **Club** | an org admin | every team in the club |
| **Team** | a coach | **that team only** |

**A team's item never lands in another team's list.** The club can see every team's items and
**publish** one to all teams when it notices the same thing invented twice — one direction, always a
decision, never automatic.

## Who is affected

| Role | Change |
|---|---|
| Head coach / treasurer | Budget rows are named by item, not by their own words. One fewer question when recording a cost. A report that finally shows unplanned spending. |
| Club admin | A new view of every team's budget items, and the ability to publish one club-wide. |
| Assistant with read-only money | Sees the better report. |
| Families / players | None. |

## The trade-off we're accepting

**This replaces something built the same week.** The budget-line picker shipped to dev on
2026-08-15; this removes it. The reason is that its whole justification was *"two lines sharing an
item are ambiguous"* — and the ruling that two such lines simply **sum** dissolves the ambiguity, so
the finer link stops earning its place.

It has never reached production, so no coach has seen it. The recommendation is to **fold both into
one release** rather than ship a control we'd take away a fortnight later.

**Every plan changes shape on the day it lands** — rows renamed from a coach's words to their item.
Today that costs nothing: the 37 budget lines in the database are all seeded test data. It gets
expensive the moment real clubs have real budgets, which is the argument for doing it now.

## Priority

**High, and time-sensitive rather than urgent.** Nothing breaks if it waits, but the cost of doing it
rises with every real budget written. It also unblocks the reporting question the owner has now asked
twice.

## Success criteria

1. Two budget lines on the same item show as **one row**, named by the item, on the plan and on
   Budget vs. Actual.
2. An item the team **spent on but never budgeted** appears as its own row on the report, flagged,
   with no budget figure — not buried in a list.
3. A coach's own item appears in **their team's** picker and **no other team's**, and a club admin
   can publish it to everyone.
