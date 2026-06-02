# No-Cost Automated Schedule Generator PM Brief

## Objective

Make the Round-Robin Generator feel like a practical scheduling assistant, not just a fixture creator. Organizers should be able to generate a schedule, understand its quality, compare options, and save the best version without FieldLogicHQ depending on paid mapping, routing, or optimization services.

## Why It Matters

The current generator is useful, but it can produce schedules that still require organizer cleanup: back-to-backs, uneven daily load, too many venue changes, and uneven early/late games. A stronger automated scheduler increases Tournament Plus value by saving real organizer time and making generated schedules easier to trust.

## Product Shape

- The existing Schedule Generator remains the entry point.
- The first major visible addition is a Schedule Health report in the draft preview.
- The same Schedule Health report appears on the saved schedule page after games are committed.
- The generator gains practical no-cost constraints: minimum rest, max games per day, facility selection, back-to-back preferences, and venue-change minimization.
- Later phases add multiple draft options, partial regeneration, and manual travel buffers entered by the organizer.

## No-Cost Boundary

This project excludes:

- Paid map APIs.
- Paid geocoding.
- Paid route matrix or drive-time APIs.
- Paid optimization services.
- Commercial solver licenses.

Travel quality is handled through venue/facility change counts and optional organizer-entered buffer values. The product should not claim to know real drive time unless a future paid or self-hosted routing project is approved separately.

## Role and Plan Behavior

Free Tournament:

- Continues to see upgrade messaging for automated generation.
- May still benefit indirectly from saved schedule conflict indicators already available elsewhere, depending on existing gates.

Tournament Plus, League, and Club:

- Get the improved generator under the existing auto-schedule feature gate.
- Can review draft health before committing.
- Can review saved schedule health after committing.

## Expected Customer Impact

- Less manual cleanup after schedule generation.
- More confidence before publishing.
- Better schedules for teams: fewer unnecessary back-to-backs, better rest, better daily balance, and fewer venue/facility jumps.
- Clearer explanation when constraints cannot all be satisfied.

## Current Progress

- Schedule Health is available before commit and after save.
- Schedule Health can be collapsed on schedule views to preserve list space.
- Dashboard now includes a compact Schedule Health summary.
- The generator now evaluates multiple deterministic draft candidates and selects the best scored result.
- Scheduler controls now cover minimum rest, max games per day, back-to-back avoidance, venue movement reduction, early/late balancing, and optimization effort.
- Scheduler controls now separate hard limits from scoring preferences, with plain-language effort descriptions.
- The generator can now select individual facilities under a parent venue, so different divisions can use different subsets of the same venue's diamonds/courts/fields.
- The generator can now create schedules without real venues by using temporary Facility lanes, then resolve those lanes to real venues/facilities later so all linked games update together. Migration 104 is applied in dev + prod.
- Slot-based generation now supports division-wide placeholder schedules without requiring pools. Pool-based slot assignment remains available when pools exist.
- Schedule Health now flags unresolved temporary facilities and the dashboard summary can surface TBD facilities as a compact warning.

## Priority

High for Tournament Plus differentiation.

Recommended build order:

1. Metrics foundation and draft health.
2. Saved schedule health.
3. Facility-level generation.
4. Internal scored generator.
5. Constraint controls and presets.
6. Draft comparison.
7. Partial regeneration.
8. Manual travel buffers.

## Success Criteria

- Organizers can see a Schedule Health score before committing generated games.
- Saved schedules show the same health view after commit.
- Generator respects minimum rest and max games/day settings.
- Generator uses facilities, not just parent venues.
- Drafts explain problems and tradeoffs in plain language.
- No paid third-party services are required.
