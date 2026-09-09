# PM Brief — the item names a money-in row too

**Plan:** [COACH_MONEY_IN_ITEM_NAMES_THE_ROW_PLAN.md](COACH_MONEY_IN_ITEM_NAMES_THE_ROW_PLAN.md)
**Status:** direction approved 2026-09-09 · not built · mockups owed
**Priority:** medium-high — small build, but it closes a live reporting inconsistency and an export
defect, and it removes a screen that lies to the coach.

## The problem, in one sentence

The Budget Plan's list calls a fundraising row one thing, the report calls it another, the export
prints two rows that look identical, and the editor tells the coach the item names the line when for
money-in it does not.

## What a coach sees differently

**Before.** A fundraising line can carry a hidden word from before the form changed — and there is no
field anywhere to read it, change it, or get rid of it. The same line reads as *"Chocolate sale"* on
the plan list, *"Fundraising drive"* on the by-period grid, and *"Chocolate sale"* again on Budget vs.
Actual. Two fundraising lines filed on the same word export as two rows with the same name and no way
to tell them apart.

**After.** Every screen calls a money-in row by the **word it is filed against**, exactly as costs
already work. A coach who is happy with the standard *Fundraising drive* does nothing. A coach who
wants their plan to say *Chocolate sale* **creates that word** — from the line editor's own picker,
or from the fundraiser's *Raising for* field — and it then names the row on the plan, on the report
and in the export, and is offered to the next drive they set up.

Where two lines sit on one word, they become a single row that sums them and opens to show both —
identical to how costs behave today. The distinguishing word for each is its **note**, which already
renders under the row.

## Why it matters

- **The two reports finally line up on the money-in side.** That is the entire reason budget items are
  selectable, and it has only ever been true for spending.
- **It removes a screen that is wrong.** The editor's own helper sentence — *"These name this line
  everywhere"* — becomes true.
- **A coach's own vocabulary becomes real.** Today a typed word is invisible to the fundraiser tab,
  to the report and to next season. A created word is a record: it can be reused, renamed once, and
  linked to a drive.

## Access and roles

No change. Money write access is unchanged; read-only money assistants see the same rows without the
edit affordances.

## Tradeoffs taken

- **A three-day-old ruling is reversed.** On 2026-09-06 the report was amended to show a fundraising
  row's typed word. That amendment could never fire for anything a coach creates — the field that
  produced the word had been deleted three weeks earlier — so it is being retired rather than fixed.
- **No data is rewritten.** Old typed words stay in the database and simply stop being displayed. The
  alternative, silently rewriting text a coach typed, is a line the product already refuses to cross.
- **The demo and UAT worlds get real custom words** instead of typed ones, so the public coach demo
  keeps its sentence ("Raffle proceeds") *and* starts demonstrating the custom-word path.

## Success criteria

1. One money-in line reads by the **same name** on the plan list, the by-period grid, Budget vs.
   Actual and both exports.
2. Two money-in lines on one word render as **one summed, openable row** on the list and in the
   export — no identical twins anywhere.
3. Creating a word from the line editor, then from a fundraiser's *Raising for* field, produces the
   same word, usable from both.
4. Changing a money-in line's word **renames its row** on every surface.
5. The public coach demo still reads *"Raffle proceeds"* on its fundraising row, now as a team-owned
   word; `check:demos` green.

## Out of scope

Linking drives and sponsors to standard or custom budget words — **already shipped and on production**
(2026-09-08). This work only makes that link name the row.
