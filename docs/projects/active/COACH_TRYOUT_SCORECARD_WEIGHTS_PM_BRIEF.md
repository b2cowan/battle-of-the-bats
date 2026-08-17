# PM brief — Tryout scorecard: weights that read

**One line:** the scorecard builder stops showing coaches a column of unexplained `1`s and starts
showing each category's share of a player's score.

## What a coach sees differently

Opening **Get set up → Evaluation scorecard → Edit** in Tryouts:

- A switch at the top — **Count every category equally** — on by default. While it's on there are no
  weight controls at all; each category simply reads **20%**, and the footer says
  *Weighted equally · 20% each*.
- Turn it off and each row gets a small stepper with a bar and a live percentage. Change one and the
  others move — the shares always total 100.
- Step a category down to zero and it says **Notes only · not ranked**: helpers still score it and it
  still shows on the player's card, but it no longer affects the ranking. That was always how the
  product behaved; it was reachable only by guessing.
- Turn the switch back on and you're asked to confirm — *"Start over with an even split?"* — which is
  the fast way to reset a scorecard you've over-tuned. It only asks when there's something to lose.
- Notes are hidden behind a link instead of an always-open box on every row, categories can be moved
  up and down, and the whole thing now has a pinned Save button with a running summary beside it.
- A preview shows what a helper's phone will show — the categories, the notes, and the tap row at the
  scale you picked.

## Why it matters

The ranking divides by the total weight, so only a category's **share** ever reaches a player's score
— six 1s and six 3s are the same scorecard. The old screen showed the one number that couldn't mean
anything on its own. Three real behaviours were also invisible: a zero-weighted category (useful for
"Attitude"), the silent fallback when everything is zeroed, and the fact that reweighting mid-tryout
re-orders a board the coach has been reading all morning. All three now say so.

It also closes an accessibility defect: the weight field had **no name at all** for screen-reader
users — a hover tooltip and nothing else.

## Who it affects

Head coaches running rep tryouts. Evaluators see no change — the builder's output is the same
scorecard, and shares were never shown to them. No pricing or plan implications.

## Tradeoffs taken

- **Weighting kept** rather than removed, on the judgement that the switch costs the common path one
  row and removing a live capability is harder to undo than hiding it.
- **Steppers, not typed percentages** — typed percentages have to total 100, which means either
  rejecting arithmetic a coach thinks is fine, or silently re-scaling what they typed.
- **The reset discards, it doesn't remember** (owner ruling). Remembering would mean the screen could
  show numbers that aren't what gets saved, which is the exact problem this work exists to fix.

## Success criteria

- A coach can say what a category is worth without being taught.
- Nobody has to guess to reach "score it but don't rank on it".
- No coach is surprised by a re-ordered board after editing a scorecard mid-tryout.

## Status

Built on dev 2026-08-17, no database change and no migration. **✅ Owner QA passed 2026-08-17**
(ledger §50) — awaiting a production release. This screen lives inside a modal the automated
rendered sweep never opens, and the volunteer scoring screen is in no sweep at all, so that walk was
the only coverage either one has.
