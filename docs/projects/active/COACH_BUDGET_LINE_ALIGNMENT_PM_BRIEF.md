# PM brief — spending points at a budget line

**Plan:** [COACH_BUDGET_LINE_ALIGNMENT_PLAN.md](COACH_BUDGET_LINE_ALIGNMENT_PLAN.md)
**Status:** planned 2026-08-15, **not built** — awaiting approval · one database change
**Raised by:** the owner, 2026-08-15, from the Add Expense / Add Payable form
**Mockup:** https://claude.ai/code/artifact/dffa11b7-14a1-4182-afb7-e327985d7443

## The gap, in one line

When a coach builds a budget they choose a **category and an item** — "Facilities / Dome rental".
When they record what they actually spent, they choose **only a category**. So the budget knows
what it planned line by line, and the ledger only knows roughly what bucket the money came out of.

## ⚠ And it's producing a wrong number today

This is worth reading before deciding priority, because it isn't a missing feature — it's a report
that overstates.

Because spending is only matched to a **category**, Budget vs. Actual has nothing to put against an
individual budget line. The line row is honest about that: it shows a dash. But **expand a line and
its monthly rows show money, in green, with a favourable variance — and that money is the whole
category's, not the line's.**

Concretely: Facilities holds *Dome rental* and *Field rental*. A $340 dome invoice is paid. Expand
Dome rental — November shows $340, correct. **Expand Field rental — it also shows $340**, against a
month with no field spending at all. Three lines in a category, and the same dollar is counted three
times.

It only happens when a category holds more than one line, which is what a real budget looks like. It
has the same root cause as the owner's question, so it's fixed in the same work rather than patched.

## What a coach does differently

On **both** Add Expense and Add Payable, the "Category" dropdown becomes one field:

**"What is this against?"** — the team's own budget lines, grouped by category, each showing what's
left on it:

> **FACILITIES**
> Dome rental — $4,000 planned · **$1,190 left**
> Field rental — $1,200 planned · **$1,200 left**
> **TOURNAMENTS**
> Spring classic entry — $850 planned · **$0 left** ⚠
> ─────────────
> *Not in the budget*

Picking a line fills in the category automatically — one decision instead of two, and it can't
disagree with the plan.

**The quiet win is the "left" figure.** The coach finds out they're about to overspend a line at the
moment they record the cost, rather than next month on a report they may not open.

## What stays the same

- **"Not in the budget" is a first-class choice**, not an error. Unbudgeted spending is real, and
  picking it keeps today's category picker and today's honest warning that it'll show as Unbudgeted.
- **A team with no budget plan sees exactly what it sees today** — the plain category picker.
- **Existing records are untouched.** Nothing is guessed retroactively: history keeps matching the
  way it always has. Trying to infer which line a past expense belonged to would be confident and
  wrong, which is worse than a dash.

## What it unlocks

| Today | After |
|---|---|
| Budget vs. Actual shows a dash for every line's actual | Real spent-vs-planned, line by line |
| Expanded line months show the category's money | Show that line's money — the defect above, gone |
| The export leaves line actuals blank by design | The export carries them |
| "Unbudgeted" means "the category name didn't match" | "Unbudgeted" means the coach said it wasn't in the plan |

## Who is affected

| Role | Change |
|---|---|
| Head coach / treasurer | One clearer field when recording money; a budget report that finally works line by line. |
| Assistant with read-only money | Sees the better report. Records nothing. |
| Teams with no budget plan | No change at all. |
| Families / players | None. |

## Trade-offs

- **One field, two jobs.** The picker has to carry both "pick a line" and "not in the budget", or
  coaches would be forced to file real spending against a line that doesn't fit.
- **A season of mixed records.** Rows recorded before this land keep matching by category name.
  Both kinds roll up to the same category totals throughout, so no total ever disagrees with itself
  during the changeover — that's what makes shipping it without rewriting history safe.
- **The spreadsheet importer stays category-level for now.** Its template has a category column;
  giving it a budget-line column is a clean follow-up rather than a reason to hold this.

## Priority

**High — higher than recurring payables.** It fixes a number that is currently wrong on a report
coaches use to make decisions, and it improves the two most-used forms in Money. It has no
dependency on anything in flight.

## Success criteria

1. Recording a cost against a budget line takes one choice, and shows what's left on that line
   before it's saved.
2. Budget vs. Actual reports each line's own spending — and a line with no spending against it shows
   nothing, rather than its neighbour's money.
3. A team with no budget plan, and every record made before this shipped, behave exactly as they do
   today.
