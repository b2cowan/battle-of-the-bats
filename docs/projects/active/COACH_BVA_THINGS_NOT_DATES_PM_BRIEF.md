# PM brief — Things, not dates

**One line:** take dates off the Statement and By Activity, and let every figure open onto the things
behind it — including Player dues, which today opens onto nothing.

**Status:** **built on dev 2026-09-10**, no migration, owner QA owed (§167).
**Plan:** `COACH_BVA_THINGS_NOT_DATES_PLAN.md` · **Mockup:** artifact `e2264b06`

---

## What a coach sees differently

**Today.** Opening a line on the Statement unfolds it into the budget's own schedule with real money
placed against it. On a line planned across several months that reads fine. On a line with one planned
month it reads *Feb 2027 · $1,228.60* — against money that arrived in August and September. And on
that same report, the largest figure of the season, Player dues, is the one row a coach cannot open at
all: a −$6,166.67 variance with no way to ask *who?*.

**After.** No line on either report carries a date. Every figure is a door onto what made it — the
plan on one side, the actual records on the other, with drives and sponsors named and clickable as
they already are. And **Player dues folds open to the players**, exactly the way Fundraising folds
open to its lines: one row each, with what that family was billed, what has come in, and what they
still owe, in the report's own three columns. Opening a family's Actual explains how their money got
there — cash, team bills they paid, fundraising credited — which is the panel the report already has,
moved down from the category to where it says something.

## Why it matters

The report's job is *are we on track*. Timing is a different question with a screen of its own — the
Months view, where both the plan and the money are dated the same way. The fold was the only place on
the report where those two bases were mixed, and mixing them is what produced a February row full of
September money. Removing it doesn't lose an answer: it stops a third, weaker answer from crowding the
two good ones the row already has.

## The tradeoff we're accepting

One question leaves the product: *"we're over on ice time — which month?"* Months answers by category,
not by line. We judge that an analyst's question rather than a coach's, and worth trading for a report
that never dates money it can't date honestly — but it is a real loss, not a technicality.

## The judgement call on privacy

The Statement exports to a file that boards and parents read. We're recommending the per-family list
stay **screen-only**, with the export keeping its single Player dues row. Drives and sponsors stay
named in the export — they're businesses and events, not children.

## Success criteria

- Neither report shows a date anywhere, at any width.
- Every figure on the report opens onto the records behind it, with no exceptions left.
- A coach can answer *"who still owes us money?"* without leaving the report.
- No figure on any team changes.
- The exported file names no family.

## Priority

**Medium-high** — higher than the fundraiser proposal it arrived beside. This one removes a live
misreading on a report a treasurer takes to a board, and closes the last gap in the report's grammar.
Best done as one piece: removing the fold without giving Player dues its door leaves the report's
biggest row as the only one with no way in.

---

## Owner ruling, 2026-09-10 — how the dues half changed

The first draft proposed a **modal** listing every family's bill and payments, opened from the Player
dues figure. The owner replaced it: *"just have it open up like the other areas so we see by player
the budgeted/actual/variance just like everything else — the modal repeats what we see in the player
dues page so we don't need that."*

Better on three counts, and worth recording why:

1. **It builds nothing new.** The report already knows how to fold a category into rows with three
   columns. The proposal was a new panel shape; the ruling is the shape that already exists.
2. **It refuses a duplicate.** A modal of families, bills and payments is the Player Dues page wearing
   a different hat — and a second place to read the same thing is a second place for it to go stale.
3. **It fixed a consistency bug the first draft would have entrenched.** Doors on this report live on
   **item** numbers; every category row has plain figures. Player dues was the only category carrying
   a door — and the first proposal would have given it a second one. Folding it to players moves the
   door down to where every other door already is.
