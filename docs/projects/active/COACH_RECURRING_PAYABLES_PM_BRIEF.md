# PM brief — recurring payables

**Plan:** [COACH_RECURRING_PAYABLES_PLAN.md](COACH_RECURRING_PAYABLES_PLAN.md)
**Status:** planned 2026-08-15, **not built** — awaiting approval · one database change
**Sibling brief:** [COACH_BUDGET_LINE_ALIGNMENT_PM_BRIEF.md](COACH_BUDGET_LINE_ALIGNMENT_PM_BRIEF.md)
**Mockup to build to:** https://claude.ai/code/artifact/97d419b6-b31d-415c-852a-403e25b273fc

## The problem in one sentence

A team's biggest costs are monthly — the winter dome block, field rental, insurance, equipment
financing — and the only way to record one is to add the same payable twelve times by hand, or build
a spreadsheet and import it.

## What a coach does differently

They open **Add Payable**, type it once — "Winter dome block, Facilities, $340" — and open a new
**Repeats** group under it. They say monthly, on the 1st, from November until April.

A list of the six dates appears **inside the form, before anything exists**. Every row shows its due
date and its amount, and every row has a tick. The January row is a rink closure, so they untick it.
The April row is a half month, so they type $170 straight into it. The button at the bottom of the
form now reads **"Add 5 payables"**, and beside it: *creates 5 payables totalling $1,530*.

**And it says what that does to the budget.** A repeat points at a budget line like any other cost
(the change described in the sibling brief), so the same callout adds: *against Dome rental — $2,150
left on that line, so this run leaves $620.* Setting up a repeat is the biggest single money
commitment a coach makes in one action, and it's the one place the product can check a whole run
against the plan before any of it exists.

They press it. Five separate payables land on the Payment schedule, each with its own due date and
its own **Mark paid**. From that moment they behave exactly like any payable added by hand — because
that is precisely what they are.

## Why it is built this way

**Nothing is created until you've seen it.** This is the same promise the schedule's "repeat weekly"
and the payables importer already make, and it is the reason a wrong end date costs a keystroke
rather than forty rows of cleanup. The button counting what it will actually create is half of that
promise; the list of dates is the other half.

**Each payable is still an ordinary record.** Every occurrence can be opened, edited, marked paid or
deleted on its own, exactly like a payable typed by hand. Nothing is hidden inside a container.

## Changing a run after you've set it up

Added at the owner's request, 2026-08-15. The answer is deliberately **not** the calendar-app
question — "this one / this and future / all occurrences" — which asks a coach to reason about a rule
they can't see, over rows where some of the money has already been paid.

Instead: **the list you approved comes back**. The way in is the row's own **"⋯"** menu — the same
one that holds Edit and Delete — with one more item, *"Edit repeating series"*, on any payment that
belongs to a run. Nothing is added to the payables list itself: no badge, no extra line, no taller
rows. The sheet tells you which run you're in when it opens.

It reopens the same table you saw when you created the run, now showing the payments that actually
exist.

- The dome company raises the price in January? Type the new amount on the remaining rows.
- The season ends a month early? Remove the last payment.
- It's going another three months? **Add more months** — the new dates appear in the same table to
  review before anything is saved.
- Change the description, budget line or payee **for the whole run at once** — and that lands on the
  unpaid payments only.
- Payments you've added but not yet saved are marked **New**, in the same status column as
  everything else.

**Payments you've already marked paid are frozen.** They show in the sheet with their paid stamp and
cannot be re-priced or removed by a series action — money that has moved is not a scheduling
operation. The server enforces that, not just the screen.

Before you save, the sheet says what will happen: *"2 amounts changed, 1 payment removed, 3 added"*.

The honest trade: this adds a small amount of stored information — the run remembers its own shape,
so "add more months" knows what "more" means. **It never creates anything on its own.** Nothing is
written unless you open the sheet and confirm a list you can see.

## Four things the mockup didn't cover, recommended for v1

Each is small, and each closes a hole a coach would otherwise find on day one.

| Addition | Why |
|---|---|
| **Type an amount on any row** | Prorated first and last months are the norm, not the exception. Without this, the coach commits six identical rows and then goes hunting for the one to correct — the very work this feature exists to remove. |
| **Dates already on the schedule arrive unticked** | With no series, nothing stops the same repeat being set up twice. Any date that already has this payable is flagged *"already on the schedule"* and unticked, so a second run adds only what's missing. |
| **"After 6 payments" as well as "Until April"** | Coaches think both ways, and a count can't produce a runaway list at all. |
| **"Last day of month", said plainly** | "The 31st" is a trap — it doesn't exist in February. Picking the 31st still produces every month, with the short ones landing on their last day and **saying so on the row**; and "Last day of month" is offered outright, which is what most invoice terms mean anyway. |

## Who is affected

| Role | Change |
|---|---|
| Head coach | The main beneficiary — the monthly commitments are the ones they carry. |
| Assistant with money access | Same. |
| Assistant with **read-only** money | No change. They never had the Add Payable button. |
| Past seasons | No change, by design. Setting up payments is an instrument, not a record — a finished season doesn't offer it, and can't be reached by it. |
| Families / players | No change. Payables are team costs; nothing here touches anyone's dues. |

## What is deliberately left out

- **Weekly or biweekly repeats.** Monthly is what the money actually does.
- **"This and all future occurrences"** as a question. The sheet shows the actual payments instead,
  which is both simpler to use and safer over money that has already moved.
- **Auto-suggesting a repeat from a budget line.** Real, and a different feature.

## Success criteria

1. A twelve-month commitment is set up in one pass, and the coach can name what will be created
   before it is.
2. Every created payable appears on the Payment schedule with its own due date and its own Mark
   paid — nothing lands as an amount with no date attached.
3. Setting up the same repeat twice does not silently double the season.
4. A repeat on the 31st produces the number of payments it promised, and shows what happened to
   February.
5. A price change part-way through a run is applied to the remaining payments in one pass — and
   cannot touch a payment already marked paid, even by mistake.

## Priority

**Medium-high.** It is the largest remaining gap on the Expenses & Payables screen, it was raised by
the owner from live use, and it depends only on Edit/Delete for payables — already in flight.
