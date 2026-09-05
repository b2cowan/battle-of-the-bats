# PM brief — Budget dates, and the "to date" reading

**One line:** every budget line has to say *when* the money moves, in months — and because it does,
the money report can finally answer *"are we on track right now?"* instead of *"has the season
finished yet?"*

**Plan:** `COACH_BUDGET_DATES_PLAN.md` · **Owner QA:** ledger §145 — ✅ PASSED 2026-09-05, 42/42, zero defects
**Approved mockups:** https://claude.ai/code/artifact/91368ba1-0e89-4f30-a7e9-422b782976e3

---

## The problem, in one number

A coach opens Budget vs Actual in September. It says the season is **$8,690.02 under budget**.

That reads as an achievement. It is nothing of the kind — it is a whole season's plan set against
five months of spending. The report has no way to compare like with like, because most plan money
carries no date at all: today the form never asks, so undated is what a coach gets by doing nothing.

Under the new reading the same team is **$1,690.02 under**, which is a figure a treasurer can act on.

## What a coach sees change

**Adding a budget line asks one more question.** After the amount: *"When does this money move?"* —
one month, split across periods, or **no date yet**. Nothing is chosen for them and no month is
pre-filled; **Add Line stays off until they answer.** It is the same rule Category & Item already
follow: a line says what it is and when it happens.

We ask for a **month, never a day**. A coach in January knows the tournament is in July; they do not
know it is due the 14th. Demanding a day manufactures precision that isn't there — and a guessed
date is indistinguishable from a known one, so the report would confidently say "over budget in
March" for a fee actually due in July.

**"No date yet" stays a real, respectable answer** — but it is now an exception rather than the
default. Choosing it shows one line saying what it costs: this money counts in the season total and
in no month, and a To-date comparison leaves it out. Said once, never nagged. It has to stay
legitimate, because a coach who sets a season estimate before itemising anything has plan money that
can never carry a month — and a form that scolds will simply teach people to guess, trading an
honest gap for a confident lie.

**The optional "Split by period" checkbox disappears.** Splitting stops being an extra a coach opts
into and becomes one of the three answers. The form loses a control and gains a decision.

**The budget plan list answers "when" at a glance.** Its `Schedule` column becomes **When** and
names months instead of counting chunks. A new filter and a one-tap bar — *"2 lines have no date.
Show just those →"* — let a coach clear a season's unknowns in one sitting instead of one line at a
time. On a phone the answer rides under the line's name, so it stops being invisible there, which it
is today.

**Budget vs Actual gains a Compare control.** Beside View: **Whole season** (unchanged, still the
default) or **To date**. On To date the plan column counts only money dated on or before today, and
its heading says **Plan to date**.

## The trade-offs we took deliberately

**We did not flip the default.** Whole season is what five other screens quote and what a build gate
pins. Changing it is its own decision, taken after the owner has used To date for real.

**The closing row is renamed under the new reading.** Under To date, "Season net" would be a
cash-timing figure wearing a profitability name — a team whose costs run early and whose dues start
in October reads deeply under water while its bank balance is fine. It becomes **Net to date** on
that basis only, so one row never carries two meanings.

**The excluded figure can never reach zero.** A season estimate set before any lines exist has no
lines to date. The report says so plainly rather than pretending otherwise.

**Two sentences under the report had to be settled together.** One of them currently apologises for
comparing a whole season against part of one. Under Whole season it becomes a door to the new
control; under To date it is deleted, because there it is simply untrue. Its neighbour keeps its
figure and changes one verb — from *"sits in the season total but in no month"* to *"is not
compared here"*.

## Who it affects

Any coach or team treasurer with money-write access on a team. No admin-side change; no plan-gating
change; nothing a family or player sees.

## Success criteria

- A coach cannot save a budget line without saying when — and has not been nudged into guessing.
- A season's unknowns can be cleared from one screen, in one sitting, on a phone or a desktop.
- In mid-season, **To date** answers "are we on track?" and the sentence underneath says honestly how
  much plan that answer had to leave out.
- The two demo worlds show a dated plan, so the shop window demonstrates the fix rather than the
  problem.
