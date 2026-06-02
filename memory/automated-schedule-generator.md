# Automated Schedule Generator

Created: 2026-06-01

## Decision

The automated schedule generator project is scoped to no-cost, build-ourselves capabilities. It must not depend on paid map, geocoding, route matrix, drive-time, commercial solver, or hosted optimization services.

## Planned Direction

- Add schedule health metrics before commit and after save.
- Build reusable pure TypeScript metrics and generator libraries.
- Improve generation with internal hard constraints, soft scoring, deterministic multi-pass drafts, and local repair.
- Prefer facility-level scheduling over parent-venue scheduling.
- Use venue/facility change counts and optional organizer-entered travel buffers instead of paid drive-time estimates.

## Progress

- 2026-06-01: First Schedule Health slice implemented with `lib/schedule-metrics.ts`, focused Node tests, draft preview health panel, and saved Round Robin schedule health panel.
- 2026-06-01: Schedule Health UI compacted into a dense summary strip with expandable team detail; tournament dashboard now exposes a compact schedule health summary panel backed by the dashboard API.
- 2026-06-01: Schedule Health panel made collapsible on schedule views; collapsed state keeps only the header, horizontal health score, and toggle visible.
- 2026-06-01: Scored generator V1 implemented with `lib/schedule-generator.ts`, deterministic multi-candidate draft selection, facility-level slot expansion, scheduling priority controls, and focused unit tests.
- 2026-06-01: Long-term temporary facility lane model implemented and migration 104 applied to dev + prod: `schedule_facility_lanes` plus `games.schedule_facility_lane_id`; generator can draft against Facility 1/2 when venues are TBD; schedule UI can resolve lanes to real venues/facilities and bulk-update linked games.
- 2026-06-01: Generator modal now selects individual facilities grouped under venues, separates schedule limits from scoring preferences, explains Fast/Balanced/Deep effort, and allows slot-based division-wide placeholder schedules when no pools exist.

## Active Docs

- `docs/projects/active/AUTOMATED_SCHEDULE_GENERATOR_PLAN.md`
- `docs/projects/active/AUTOMATED_SCHEDULE_GENERATOR_PM_BRIEF.md`
