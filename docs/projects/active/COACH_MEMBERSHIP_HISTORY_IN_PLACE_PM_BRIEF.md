# PM brief — The team is the account

**Approved 2026-08-16 · Design A on M1 · plan: `COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md` ·
mockups: artifact `aa758bcb` (R1)**

## What changes for a coach

- **Staff becomes one list — the team's.** No more "staff of the season you're looking at."
  Removing someone removes them everywhere, immediately, and the dialog says so plainly. Every past
  season still names the people who really coached it, and re-adding someone restores their access
  because nothing was destroyed. A coach's permissions are their current ones, applied everywhere
  they can look — and customized permissions finally survive the turn of a season instead of
  silently resetting every year.
- **The season dial disappears.** A coach is always on their team, in its current chapter. When a
  season ends, the portal lands on Season's End: the recap, Season Wrapped to share with families,
  settling up, and starting the next season. The awkward in-between weeks stop breaking screens
  (today two pages flatly tell a current coach they don't belong).
- **Looking back gets one honest home.** Season's End, Season Wrapped, and the every-season compare
  list carry the "what happened in 2024?" questions — for all current staff, not just the head
  coach. The ten-door read-only copy of the whole portal goes away.
- **Referencing while working arrives inside the tools, quietly.** v1 brings exactly two pieces,
  both owner-named: past practice plans (read-only, copy forward) inside Practice Plans, and last
  season's closed money book (budget vs. actual, read-only) inside Money for staff with money
  access today. Everything else has no historical access until a real moment earns it.

## Why it matters

Removing a coach today doesn't actually remove them — an assistant dropped in January keeps reading
last year's roster, money and results indefinitely. That defect, the yearly permission reset, the
between-seasons dead screens, and the entire archive access maze all share one root: the product
attached "belonging to a team" to a season's paperwork. Moving membership to the team kills all of
them at once, and the in-place history model matches the six surfaces already shipped that have
never produced a wrong-season bug.

## Owner-set guardrails

- **Every history shelf gets its own planning session with mockups before build** (practice plans
  and money included). The current season is always the primary focus — a shelf that adds noise to
  the live screen fails, regardless of usefulness.
- Trade-offs accepted with eyes open: past-season browsing pages go away; reprinting an old award
  certificate is homeless for now (revisit if the moment shows up); this year's treasurer can read
  prior years' closed books (follows "current permissions everywhere").

## Success criteria

- A removed coach can open nothing, anywhere, the moment they're removed — and QA proves it with
  three sign-ins (head coach, current assistant, removed coach).
- A coach between seasons keeps every screen working, lands on Season's End, and can start or await
  the next season without a dead end.
- The two v1 shelves pass their mockup gates and ship without making the live screens busier.
- The coach demo's finished-season story still lands, re-scripted around "the season's story is
  kept."
