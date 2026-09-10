# PM Brief — One Word, One Line (Budget plan)

> **Plan:** `docs/projects/active/COACH_BUDGET_ONE_WORD_ONE_LINE_PLAN.md`
> **Mockup:** Artifact `a6a3b078` (round 1, 2026-09-09)
> **Status:** awaiting owner rulings Q1–Q5

## What it does

A coach's season budget is written in categories (Tournaments), budget words (Entry Fee), and money
against those words. Today a coach can put the same word on the plan twice, and the form asks them to
invent a phrase that tells the two apart. This change makes **one budget word carry one line per
season**. Pick a word that is already on the plan and the form says what is there and adds to it —
"Entry Fee is already on this plan, $600.00 planned · Nov" — showing the new total before they save.

## Why it matters

The extra level looks like detail and behaves like decoration:

- **It never reaches a figure.** What a team actually spends is matched to the word, never to the
  piece. Two pieces of one word cannot be told apart by any variance, report or total the product
  prints.
- **It is invisible on the view that matters most.** The month-by-month cash-flow view has never been
  able to show it, and no one has asked it to.
- **It goes wrong quietly.** A piece with no distinguishing phrase gets named after its own month —
  which is already printed in the column next to it. On our own test team one word printed three times
  in a single column for weeks and nobody noticed, because the numbers still added up.
- **It is why the exported plan keeps breaking.** The file has to nest, and nested rows have been
  hidden by Excel and read back in as budget lines the coach never wrote.

## Who benefits

Every coach and money assistant who keeps a season budget. No plan-tier difference; no change for club
admins or families. Head coach and standalone coaches see it first because they are the ones who write
the plan.

## Expected impact

- **Adding money to something already budgeted becomes one obvious step** instead of a second row plus
  a question the coach did not expect.
- **Every row on the plan becomes the same kind of thing.** Today some rows are summaries with no edit
  door and others are real lines, at the same indent. After, they are all lines: open one to see when
  its money moves, click the pencil to change it.
- **The plan reads the same on all four surfaces** — the list, the months view, the report and the
  file.
- **The exported plan becomes a flat table** the coach, the spreadsheet and the import all agree on.
- **Not one total changes.** Planned costs, Planned funding and Player installments are identical
  before and after.

## Tradeoffs, stated plainly

- **A coach loses the ability to delete one piece of a word's money.** They edit the word's total and
  its dates instead.
- **Per-piece phrases become a note on the word** ("Regional qualifier") rather than a row of their
  own.
- **Plans already holding two pieces of one word have to be dealt with.** Leaving them readable is the
  safe option and means nothing actually gets simpler — the nesting stays in the product permanently.
  Joining them once is the version worth doing, and it is one-way. This is the single decision that
  determines whether the change is worth building.

## Priority

**Medium — but time-sensitive on one piece.** The form change stands on its own. The one-time tidy of
existing plans will never be cheaper than it is now, while no customer keeps a real budget on
production.

## Success criteria

1. A coach adding money to a word already on the plan sees what is there and the new total **before**
   they save, and can get to the existing line in one click if they meant to correct it rather than add.
2. The plan list, the months view, the report and the exported file all describe the plan at the same
   depth.
3. Every season total is unchanged, before and after — verified on a real plan, not only in tests.
4. A plan exported and read straight back in produces the same plan.
5. No coach can create two lines on one word through any door — the form, "bring last season's plan",
   or the spreadsheet import.
