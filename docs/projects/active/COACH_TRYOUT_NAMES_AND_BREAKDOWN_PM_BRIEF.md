# PM brief — Tryout names switch + score breakdown

**Built on dev 2026-08-25 · ✅ owner QA passed 2026-08-26 (§103) · plan:**
`COACH_TRYOUT_NAMES_AND_BREAKDOWN_PLAN.md`

## What a coach can do that they couldn't before

**Show or hide player names, from wherever they are standing.** Blind evaluation used to be a
one-way door: on by default, switchable off exactly once, from a screen three stages further on. A
coach who simply wanted names and bib numbers together had to go hunting, and the words telling them
names were hidden pointed nowhere. Those words are now the switch itself, and it appears on all four
screens that report the state — check-in, the live board, the Tryout dates row, and Decide. It
switches both ways, with no confirmation dialog.

**See what made a player's score.** On the Decide board, each player's rating now leads the row as a
large number. Tap it and the breakdown opens: every scorecard category with the player's average and
the share the coach gave that category, the weakest one marked — then **each helper's own number for
that player**. That last line is the point. A 4.1 built from a 4.6 and a 3.5 is not the same player
as a 4.1 three helpers agreed on, and the average cannot tell them apart. Rows where the helpers
disagree by a fifth of the scale say so on the row.

## Why it matters

The first change removes a dead end that was making coaches feel the product was hiding a setting
from them. The second turns the ranked list from a verdict into something a coach can interrogate
before they offer a kid a spot — which is when they most want to.

## What it affects elsewhere

- **Helpers and paper follow the switch.** It changes the tryout, not one person's view: evaluator
  phones and the printed check-in sheet show whatever the switch says. Only the head coach can move
  it; assistants see which way it is set.
- **The tryout report stays honest.** Because the switch is now reversible, "this tryout was blind"
  stopped being provable from the setting alone. The tryout permanently records whether names were
  ever shown, and the fairness receipt a coach hands a board or a parent can only claim *blind start
  to finish* when that is true. Tryouts revealed under the old rule were backfilled, so none of them
  falsely claims it.
- **In-app help and the demo narration** were rewritten in the same pass — both promised the old
  one-way behaviour.

## Tradeoffs taken

- **No confirmation on the switch.** The old warning ("can't be undone") became untrue; a dialog
  that overstates a reversible action trains people to click through dialogs. The honesty moved into
  the permanent record instead.
- **The reveal stayed a tryout-wide setting**, not a per-coach view. A head-coach-only peek was
  considered and put aside as a different feature.
- **One breakdown open at a time.** The Decide board's job is scanning a ranked list; several open
  panels would defeat it.

## Success criteria

- A head coach can change the names setting from whichever tryout screen they are on, without being
  told to go somewhere else.
- A coach can answer "why is this player ahead of that one?" without leaving Decide.
- A coach who scores a tryout with names visible cannot produce a report claiming it was blind.

## Priority

Medium-high. Small surface, high friction removed, and the fairness-record half is a correctness
issue the moment the switch ships — the two cannot be separated.
