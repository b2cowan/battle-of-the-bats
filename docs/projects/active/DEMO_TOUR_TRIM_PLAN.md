# The demo tour keeps its doors and gives up its prose

**Status:** BUILT on dev 2026-08-28. **No migration.** Owner ruling 2026-08-28.
Before/after the owner approved: `claude.ai/code/artifact/521b8e63-0014-4c1f-bfc4-9fa28226a59d`
(word counts measured from the shipping copy, not estimated).

## The ruling

The owner opened this as *"remove the guided tour from the demos, the pitch-deck slides can do that
job with prospects now"*. Measuring it first changed the answer, and the owner took the revised
shape: **trim the prose, keep the doors.**

## What the measurement found

The tour ran to **1,131 words across 14 steps** — but the weight was not spread across the tour.
**Three steps carried 730 of those words (65%), all three in the coach demo.** The tournament tour
was already lean: six steps averaging 25 words. The longest single step was **390 words** — for
scale, this repo's own help standard says a section over 350 words must be broken into sub-topics
because it reads as a wall, so one demo tooltip was breaking that standard by itself.

## What changed

- **Three long steps trimmed to their hook plus one proof point** — the register (390 → 39), budget
  vs. actual (179 → 32), playing time (161 → 35). Each keeps the claim a prospect came to check and
  drops the feature tour underneath it.
- **Two tournament steps deleted outright** — *"Go back three weeks"* and *"Skip to the morning
  after"*. Both restated jumps the moments dock already owns; the code's own comment said so
  (*"Steps 5–6 are the moments dock wearing its guided handle"*).
- **Result: 12 steps, 457 words** — a 60% cut with 12 of 14 doors kept.

## Why not delete the tour, which is what was originally asked

Two reasons, both argued from the code rather than from preference:

1. **The steps are doing wayfinding, not only narration.** Several are the only signposted route to
   where they point — the tryout decision board lives on `?stage=decide` and a bare `/tryouts` lands
   elsewhere; practice plans have **no address at all** (a schedule event opens a drawer over
   `/schedule`), which is why a step routes around them. Delete the steps and a self-guided visitor
   may never reach the strongest material.
2. **Both demos are public and unaccompanied.** They are linked from the homepage hero, both pricing
   cards and `/for-coaches`, so most visitors arrive with no salesperson and no deck. The deck can
   carry the story in a conversation; it cannot carry it for a stranger at 11pm. Deleting the tour
   optimises the accompanied demo and degrades the unaccompanied one.

## The arrival lines — settled 2026-08-28 (second pass)

Measured after the tour trim, and the measurement changed the answer: **16 lines, 415 words, longest
33** — not a wall, and nothing here needed cutting for length. Two real findings instead, both acted
on:

1. **Five of the sixteen lines were byte-identical duplicates.** Every moment stores a family line
   and an operator line. The tournament’s three genuinely differ; all five coach moments carried the
   same sentence pasted into both slots, because a coach’s world is one seat and there was never a
   second audience. The cost was never the words — it was that every figure lived in two places.
   `saidOperator` is now optional and omitted where a world has one seat.
2. **The figures stay, and are now guarded.** Stripping numbers would have made the demo blander and
   unfalsifiable; instead the demo check verifies the countable ones against the seed
   (`DEMO_SANDBOX_DRIFT_GUARDS_PLAN.md` measure 5).

Mockup the owner ruled from: `claude.ai/code/artifact/45d5a9d5-b8f4-4de5-be6a-db68a22e6ec5`.

## ⚠ Still open — deliberately not done here

**The season-phase arrival lines are a SEPARATE text layer and were not touched.** The owner has not
ruled on them. If the goal is less on-screen text, that layer is the next question — and it is the
one that carries the higher staleness risk, because unlike the tour's verb labels it makes factual
claims about what happened.

## The test that changed sides

`tests/unit/demo-sandbox-moments.test.ts` used to assert the OPPOSITE — that steps 5 and 6 landed on
the two moments and narrated them. Rather than delete it with the steps, it was **inverted into a
guard**: no tour step may land where a dock moment already goes, so re-adding either duplicate fails
the build instead of quietly re-crowding the screen. It also asserts the moment set is non-empty, so
it cannot pass vacuously the day `sandboxMoments` returns nothing.
