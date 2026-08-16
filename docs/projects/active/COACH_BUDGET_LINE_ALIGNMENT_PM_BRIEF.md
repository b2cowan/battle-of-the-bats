# PM brief — spending points at a budget line

**Plan:** [COACH_BUDGET_LINE_ALIGNMENT_PLAN.md](COACH_BUDGET_LINE_ALIGNMENT_PLAN.md)
**Status:** **built on dev 2026-08-15** · owner QA = ledger **§29** · one database change (238,
applied to dev; production application is a release step)
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

**"What is this against?"** — the team's own budget lines, by name, grouped by category:

> **FACILITIES**
> Dome rental
> Field rental
> **TOURNAMENTS**
> Spring classic entry
> ─────────────
> *Not in the budget*

It's the **first question on the form**, and picking a line fills in **both the category and the
description** — the line's own name, ready to type over. One decision instead of two, the category
can't disagree with the plan, and most costs now need nothing typed but the amount.

**Names only, deliberately** (owner ruling 2026-08-15, after seeing it built with "$4,000 planned ·
$1,190 left" on every option). A coach on this form is **logging money already spent or already
promised, not deciding whether to incur it** — budget figures can't change that decision, so they're
noise in the one control that has to be read to file the cost correctly. Overspending is Budget vs.
Actual's news to deliver, and after this change it delivers it **line by line**.

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

1. Recording a cost against a budget line takes **one choice**, and the category follows from it.
2. Budget vs. Actual reports each line's own spending — and a line with no spending against it shows
   nothing, rather than its neighbour's money.
3. A team with no budget plan, and every record made before this shipped, behave exactly as they do
   today.

## What changed while building it

**A dash on the report now means one thing, and the report says what.** The original write-up left a
line with nothing spent against it showing a dash forever. As built it shows **$0.00** — because
once every cost in a category is pointed at a line, "nothing was spent on field rental" is a fact,
not a gap. A dash survives only where there is money in the category that doesn't say which line it
belongs to, and the report names that money in dollars underneath: *"$200 of Facilities spending
isn't against a budget line."* That sentence doubles as the instruction — re-file those costs and
the dashes fill in.

**Fixing a mis-filed cost never costs you money.** Which line something is against stays editable
after it's been paid, unlike the amount. Re-filing is bookkeeping; the alternative would have been
delete-and-re-enter, which moves real money on the team's books to correct a label.

**Description stays required, but you rarely type it.** It reads like a note, but it's the record's
name: it's what gets written onto the team's books when a cost is marked paid, it's how deleting a
paid record finds the entry to reverse, and it's the only thing identifying the row in every list,
the payment schedule and the exports. Making it optional would leave nameless rows and paid records
that are awkward to reverse. Instead the budget line is now asked **first** and fills the
description in with the line's name — so the common case is no typing at all, and anything you've
written yourself is never overwritten.

**The picker shows names only.** It was built with the planned and remaining figures on every
option, per the original write-up, and the owner cut them the same day — see "What a coach does
differently" above for the reasoning, which is a rule about this form rather than a preference about
this control.

**The demo had to be re-filed too.** A line reports its own spending only where a cost points at it,
so the sandbox's seeded season needed the same treatment — otherwise the report a prospect is most
likely to open would show a dash beside every budget line on a team 18 games into its season.
