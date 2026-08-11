# PM Brief — Money Overview: One-Screen Dashboard

**Status:** approved (mockups signed off 2026-08-11), not started
**Mockups (binding spec):** <https://claude.ai/code/artifact/8eac5808-b803-4d97-85df-73eed0722fb8>
(use the latest version, "calm-footers-no-cta" — the reminder button in earlier
versions was deliberately removed)
**Plan:** `COACH_MONEY_OVERVIEW_DASHBOARD_PLAN.md`

## What the coach sees differently

Today, the first screen of Money is about three screens tall: an alert banner, four
stat tiles, a three-column "upcoming payables" table, and then seven navigation
cards grouped 1·Plan → 4·Review — even though the new tab bar right above them
already goes to all seven places. The same numbers repeat as you scroll: the
overdue count appears three times, "collected of expected" three times, headroom
up to three times.

After this change, a coach running their season opens Money and sees **everything
on one screen, each fact exactly once**:

- **Collections** — how much is in, how much is expected, a progress bar with the
  overdue slice visibly marked, and a chip that says "1 overdue" / "3 unpaid" /
  "on track".
- **Cash on hand** — the real bottom line (money actually received minus money
  actually paid) as the headline, with small In and Out bars you can compare at a
  glance instead of doing mental subtraction across tiles.
- **Budget** — headroom as the headline, a spent-vs-planned bar, and the
  per-player figure.
- **Next 30 days** — one date-ordered money timeline instead of three columns.
  Identical dues installments collapse into a single row ("Installment #2 —
  12 players · +$1,800"), so thirteen near-identical entries become one line.
  Empty categories cost one sentence, not a third of the page.
- **More in Money** — a slim list with one line and one live stat for everything
  else (Fundraisers, Allocations, Payment Requests, Budget Plan, Budget vs.
  Actual), each a tap away.

A coach who hasn't finished setting up keeps today's guided walk-through layout —
the dashboard only takes over once the season is actually running money.

## Deliberate calls (owner-ratified in the mockup review)

- **No big call-to-action button on the dashboard.** The overview reports; it
  doesn't shout. Sending payment reminders lives where the work lives — the
  Player Dues screen — with a small per-row "Remind" shortcut on any overdue line
  in the timeline.
- **All card footer links sit in matching bottom bands** at the same height, so
  the screen reads as one calm grid.

## Why it matters

Money is a daily-glance screen for a treasurer-coach in season. Right now the
glance costs three screens of scrolling and re-reads the same facts; that's
friction on the exact surface where premium coaches spend routine time — and it's
the screen the public coach demo lands on, so it's also a shop-window surface.

## Customer impact

Premium rep-team coaches (and the coach demo sandbox, which shows this screen to
prospects). No pricing, gating, data, or permissions change — presentation only.
Nothing moves for admins or families.

## Priority

Medium-high: polish on a shipped, QA-passed feature (the Money tabs), high daily
visibility, no new risk surface. Natural next unit of work in the Money hub while
it's warm.

## Success criteria

- Operating-season Overview fits one laptop screen; no duplicated stat remains.
- Overdue/unpaid state is visible within one second of landing (chip + red edge +
  timeline row), and acting on it takes at most two taps.
- The dues timeline shows grouped installments (one row per installment batch),
  never a per-player wall.
- Setup-stage coaches still get the guided layout; archived seasons and
  org-features gating behave exactly as today.
- In-app help for Money matches the new screen, and the coach demo's narration
  about this screen still tells the truth.