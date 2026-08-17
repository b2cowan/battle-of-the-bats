# PM Brief — one home for the money arithmetic

**Status: all three phases built on dev 2026-08-17. Awaiting owner QA — Owner QA Ledger §51.**
No migration.
**Plan:** [COACH_MONEY_ONE_ARITHMETIC_PLAN.md](COACH_MONEY_ONE_ARITHMETIC_PLAN.md) (§1c is the
re-verification, §4b is what shipped)
**Evidence + diagrams:** https://claude.ai/code/artifact/bd12805c-98a5-465a-931b-1273b8adcb70

⚠ **THREE numbers changed, not two.** The section below was written before the work and said two.
Re-deriving the plan's evidence from the code found the split-commitment collapse in a third place —
**the statement's own expand-a-row payment schedule**, which reported a July balance against an April
period beneath a row whose season total was correct. It is corrected the same way, and it is the third
figure a coach could notice.

⚠ **And two things a coach could see that nobody had reported.** Spending with no category at all
appeared as **two rows** on the Months grid: the statement called the bucket *No category*, the grid
filed the money under *Uncategorized*, so a club cost and the refund netting against it sat under two
headings that never met. Clicking that cell for detail did nothing at all. Both fixed.

## The idea in one sentence

Budget vs. Actual currently works out "what we spent" three separate times and two of the answers
disagree — so the chart a coach reads is wrong for anyone who has had a refund, and wrong about
*when* for anyone who pays a deposit and a balance.

## What a coach sees differently

Almost nothing, and that is deliberate. No screen moves, no button changes, no new step. **Two
numbers get corrected:**

- **The cumulative spending chart will subtract money that came back.** Today it never has. A team
  with a refunded tournament entry has been reading a curve that overstates its season, sitting
  directly above a statement that has it right.
- **A commitment paid in two parts will show in the two months it was actually paid.** Today the
  whole amount lands in the month of the deposit — on the one chart whose entire job is showing
  spending over time.

Everything else is invisible: the same figures, arrived at once instead of three times.

## Why it matters

A coach reading the chart and the statement sees them on the same screen, one above the other. When
they disagree, the coach has no way to know which to trust — and the honest answer today is "the one
lower down". For a treasurer reconciling a season, that is the difference between a report they can
hand to their club and one they have to check by hand.

The deeper reason is the one the owner named: **there should be a standard place where these
calculations live.** Right now adding a new kind of money to this screen means finding three places
by memory, and getting two of three produces no error and no failing test — just a number that reads
low. That is exactly how the club's money went missing from the chart, and it was caught by review
rather than by anything automatic.

## Tradeoffs made honestly

- **The chart's numbers change.** That is the fix, not a side effect, but it means a figure a coach
  may have looked at last week reads differently — always lower where a refund exists, and shifted
  later where a commitment was split.
- **Work is sequenced check-first, deliberately.** The safety net ships before the refactor so the
  refactor can prove it moved nothing else. It costs an extra step and is worth it on money code.
- **One honest exception stays.** The "scheduled" column on the Months view keeps its own source,
  because the shared arithmetic only knows about money that has actually moved. Forcing it in would
  make the shared thing worse to serve one caller.
- **The season close-out sheet is deliberately left alone.** It is a self-contained calculation that
  is the best-tested money code in the product precisely because it depends on nothing. Folding it
  in was considered and rejected.

## Priority

**Medium-high, and it should follow the money QA walk rather than precede it.** Nothing here is
urgent for a customer this week; the two wrong figures are old and quiet. But it is the kind of debt
that gets more expensive with every money feature added on top, and there is already a queue of
those.

## Success criteria

The three views of the report agree — provably, on every release, on a fixture rich enough that they
*could* disagree. A future money kind added to this screen reaches all three or fails the build.
And no figure other than the two named above moves.
