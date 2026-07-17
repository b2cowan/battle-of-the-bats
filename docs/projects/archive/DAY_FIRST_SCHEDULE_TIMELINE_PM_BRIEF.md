# PM Brief — Day-First Schedule Timeline (Tournament Mobile Polish, Round 4) — rev 2

**Status (2026-07-17): BUILT + verified on dev, uncommitted — awaiting your phone pass and
commit OK.** Every success criterion below was met, including the ride-along zoom-out fix
(the schedule now renders at true size on phones, confirmed by the measurement harness).

**One-liner:** The schedule opens on the day that matters — today during the event, the
first day before it, the last day after — showing just that day's games across all pools in
time order, with every other day one tap away.

**Rev 2 (2026-07-14):** driven directly by feedback from the two test tournaments — on game
day, fans only cared about that day's games and had to scroll too much to find them.

## What changes for a fan

Today, a fan opening the Schedule on a two-pool tournament sees A Pool's Friday, then
A Pool's Saturday, then — a full screen later — B Pool's Saturday. The same day appears
twice, and today's live game can sit five cards down.

After Round 4, the schedule opens on **one day — the right one** (today, mid-event), with a
row of date chips to hop to any other day or an "All days" overview. Inside the day, every
pool's games run in start-time order with a small quiet pool tag per row. Zero scrolling
past other days or other pools' history to find what's on now. Everything fans already rely
on stays put: the day header with the TODAY badge, the "games done today" counter (now
honestly counting the whole day), live cards, follow stars, and the Pool Play / Playoffs
toggle. Searching a team or tapping My Games shows that team's whole weekend regardless of
the selected day — never a false "no games today".

## Why it matters

This was the single biggest structural gap between the live product and the approved mockup
baseline (the review scored it the largest divergence of the ~55 findings). Game-day
usability is the product's marquee promise; day-first grouping is how every broadcast-style
schedule reads.

## Why it's Round 4 (last)

The pool tag needs to land inside the row design Round 1 finalizes (venue line, label
conventions). Building it after the mockup rounds means it's built once, on the final row
anatomy — not rebuilt when the rows change under it. It's also lower risk than it sounds:
the day-first rendering machinery already exists in the product (single-pool divisions and
other paths already use it); the work is routing multi-pool schedules through it and adding
the tag.

## What you'll review

A mockup artifact (rev 2) with phone frames: the game-day landing with the date-chip strip
beside the current pool-first layout, the smart-landing rule illustrated for before/during/
after the event, two options for where the pool tag sits, and the edge cases (single-pool
divisions, the Playoffs stage). Seven decisions are called out — pool-tag placement, desktop
parity, strict time ordering, the whole-day progress count, keeping the "All days" chip,
filters expanding to the whole event, and (the bold one, decided together with Round 1)
whether the day view should merge pool and playoff games into one timeline.

## Ride-along fix (added 2026-07-16)

While photographing the pages for Round 3, we found the Schedule renders slightly **zoomed
out on phones** — something on the page is wider than the screen, so phones shrink the whole
page ~13% to fit (text and buttons render smaller than designed on this one page). Since
Round 4 rebuilds the schedule's layout anyway, the fix rides along here. After Round 4, the
schedule renders at true size like every other page.

## Success criteria

- A fan opening the schedule on game day lands on today's games with **zero scrolling** past
  other days or other pools' history — the test-tournament complaint, eliminated.
- The page renders at true size on phones (no forced zoom-out — the ride-along fix above),
  confirmed by the same measurement harness.
- The landing is right in all four states: before the event (first day), each event day
  (that day), a gap day (next day with games), after the event (last day).
- Each calendar day appears exactly once; the "All days" view keeps the weekend overview.
- No fan-visible feature regresses (follow loop, live cards, search, alerts) — search and
  My Games always find a team's games regardless of the selected day.
- Verified with the same measurement harness the polish project already uses.

**Priority:** after Rounds 1–3 of Tournament Mobile Polish. **Size:** small-to-medium — a
regrouping plus a row tag, not a schedule rebuild. **Risk:** low; no data or backend changes.
