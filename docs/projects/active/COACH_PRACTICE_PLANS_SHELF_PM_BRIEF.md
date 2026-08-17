# PM brief — The practices you ran

**Approved 2026-08-16 · P3 of history-in-place · plan: `COACH_PRACTICE_PLANS_SHELF_PLAN.md` ·
mockups: artifact `f42be4f3`**

## What changes for a coach

- **The product stops denying it kept their plans.** Today, a coach whose season has finished opens
  Practice plans and is told the plans are *not* kept and to switch back to their current season.
  Both statements are wrong — every plan is kept in full, and there is no longer a season to switch
  to. That screen gets rewritten to say the true thing and to hand over a door that works.
- **Reusing an old practice takes two steps instead of five.** When a coach starts a plan, they can
  already begin from a template or from another practice this season. A third choice appears —
  *a past season* — each row named with the season it came from. Today the only way to reach last
  October is to import it into the template library first, which permanently grows a library the
  coach may not have wanted to grow.
- **Every finished season keeps a list of the practices that were run.** On that season's own
  Season's End page, below the recap and the existing doors, a quiet collapsed section opens to the
  practices from that year — and each one opens the plan exactly as it was written, read-only.
  Today that list disappears the day the next season starts.

## Why it matters

The gap was narrower than it looked, and the loudest part of it was a defect rather than a missing
feature: a coach between seasons asks the product for their old plans and is told they don't exist.
Fixing the sentence closes most of the complaint on its own.

What genuinely goes missing is narrow and real — the day a new season opens, last year's practices
and the notes a coach wrote about how they went become unreachable. Putting them on Season's End is
the cheapest honest home: that page is already about one named season, so nobody can be confused
about which year they're reading, and it never appears during a live season, so the Tuesday-night
screens cost nothing at all.

## The tradeoffs taken, with eyes open

- **The busiest screens gain nothing.** The Practice plans hub and a single practice plan are
  pixel-for-pixel unchanged in a live season. That was the binding constraint, and it ruled out the
  most obvious idea — a "past seasons" drawer on the Practice plans hub. It would have added about
  one and a half rows of clutter to the screen a coach opens on a Tuesday, and it would have been a
  second door to a library that already has one.
- **Looking back stays in one place.** Nothing here points the portal at a past year or brings back
  a season switcher. The one page that already reads a named season is the one that gets the new
  section.
- **The libraries stay live-season tools.** Drills, plan templates and the tag vocabulary are
  unchanged. Only the words of a past practice can be copied forward, never edited in place.
- **A helper still can't read last season.** Someone brought in to run one station on a Tuesday has
  no business in the team's record, and the new door carries the same restriction as the existing
  one.

## Priority

**The correction ships first, on its own** — it's a false sentence on a live screen and needs no
design decision. The picker and the Season's End section follow together.

## Success criteria

- A coach between seasons opens Practice plans and is told something true, with a door that works.
- A head coach planning a Tuesday in the new season can start from a practice they ran last year in
  two steps, without adding anything to their template library.
- After a season rolls over, a coach can still find and read what they ran last year and what they
  wrote about it — from that season's own page, and never by accident from a live screen.
- A helper with schedule access but no record access is refused, and a cancelled practice never
  appears in the record.
- Every live-season practice screen measures identical before and after.
