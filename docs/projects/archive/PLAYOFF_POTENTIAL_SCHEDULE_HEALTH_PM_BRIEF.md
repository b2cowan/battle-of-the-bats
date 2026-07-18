# PM Brief — Playoff Schedule Health "What Could Happen" Metrics

## What changes for the organizer

Today, the Schedule Health card on the Playoffs tab shows a "Teams" number that doesn't mean
what it looks like it means — it's counting bracket slots that happen to have a game row, which
over- or under-counts depending on how far the bracket has progressed (seen live: 15 on one
tournament, 0 on another, neither the real team count).

After this change, "Teams" on Playoffs always shows the number of teams actually seeded into the
bracket — the same number the organizer set when building it. It will match what they'd expect
to see, and it won't swing around as games get played.

## Why it matters

Organizers use this card as a quick trust signal ("is my schedule healthy?"). A wrong or
confusing team count undermines that trust, and a health score that reads "100/100, no teams"
is actively misleading — it looks clean when it's actually just not counting anything.

## What's included now vs. later

- **Now (Phase 1, shipped):** the Teams count is fixed for every bracket type. For the
  manually-seeded case, the day-load/rest/back-to-back numbers also improve, because the tool
  now knows which real team occupies an early bracket slot instead of treating it as an
  anonymous placeholder. A `/review` pass caught and fixed a handful of edge cases this
  introduced (a zero-team division reading wrong, a contradiction in the schedule Generator's
  preview panel, two teams sharing one seed number silently confusing their stats) — all fixed
  before this shipped.
- **Just shipped (Phase 2A, 2026-07-09, uncommitted):** seeds now resolve for
  standings-based brackets too — the more common setup, where "Seed #6" means "whoever
  currently sits 6th in round-robin standings," not a number the organizer typed in. The
  moment a live ranking exists, that seed's real team shows up in the health card's team
  detail with a small **"Current"** tag (with a tooltip explaining it can still shift while
  round-robin games remain) — matching the owner decision to show it live rather than waiting
  for round robin to fully finish. Spot-checked against a live tournament: 11 of 12 teams
  now resolve to their real name and stats, versus 0 before this session's work.
- **Just shipped (Phase 2B, 2026-07-09, uncommitted, redesigned after owner feedback):** the
  health card now shows a bracket slot's rest/back-to-back/day-load all the way to a hypothetical
  final, not just its next confirmed game — every round's venue/time is already fixed the moment
  the bracket is built, only the opponent (and sometimes the occupant's name) is unknown. The
  first version of this only projected forward once a seed's real team was already known; an
  owner review caught two problems and both are fixed: (1) a live screenshot showed every seed
  resolving to a real name before a single round-robin game had been played — a pre-existing
  standings quirk where a total tie doesn't trigger the "needs a coin toss" flag, so an arbitrary
  fallback order was being shown as if it were live and current; resolving a seed's name from
  standings now waits for at least one round-robin result to actually exist. (2) More
  fundamentally: a bracket slot's schedule-risk numbers don't depend on which team ends up there
  — only on which slot it is — so projection no longer waits on knowing the team's name at all.
  Any bracket entry now gets projected forward from the moment the bracket is built, labeled
  **"Seed #N"** until a real team resolves (manual seed, or standings once genuinely current),
  at which point the row's label simply upgrades to that team's name — same numbers either way.
  Any row whose numbers include a hypothetical round gets an amber **"Projected"** tag (matching
  the existing "Current" tag's visual pattern) with a tooltip explaining it assumes that slot
  keeps winning — so a scheduling conflict two rounds away is never mistaken for one that's
  already locked in. The walk also correctly stops the moment a slot is actually eliminated by a
  real result, using only the game's score (no team identity needed at all). Scoped to standard
  single-elimination brackets only — double-elimination/consolation/placement formats keep
  today's behavior unchanged, since a team could legitimately land in either bracket there and
  guessing which would be worse than not projecting.

## Risk / testing notes

No pricing, gating, or data-model change. Purely a health-metric calculation fix inside the
existing Schedule Health card — safe to verify by opening the Playoffs tab on a seeded bracket
and confirming the Teams number matches the number of seeds you built the bracket for, and that
undetermined future rounds show a "Seed #N" or team-name row with a "Projected" tag as soon as
the bracket exists — even before any games have been played.
