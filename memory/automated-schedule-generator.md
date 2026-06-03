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
- 2026-06-02: Playoff Bracket Builder scheduling slice implemented: optional auto-assign dates/times/facilities, dependency-aware playoff round rest, temporary playoff facility lanes, playoff Draft Health before save, and Saved Playoff Health on the schedule page. Dependency support was added to `lib/schedule-generator.ts` without introducing paid maps, routing, solver, or drive-time services.
- 2026-06-02: Playoff protected regeneration hardening implemented. The Playoff Wizard now offers Replace bracket vs Build from current, scheduled playoff games can be manually kept/released, protected playoff games are passed as fixed assignments, Build from current deletes only unlocked scheduled playoff IDs, and round-robin `delete-division-games` no longer clears playoff rows.
- 2026-06-02: Playoff scheduling browser verification completed by the user and delete-policy API coverage added in `tests/unit/game-delete-policy.test.ts`. The playoff scheduling plan/PM brief were archived after completion.
- 2026-06-02: Schedule presets implemented in the generator: Balanced, Rest-friendly, Compact, Facility-friendly, and Younger earlier. Manual edits switch the control state to Custom.
- 2026-06-02: Draft comparison implemented: the scheduler now returns up to 3 top unique draft options, labels their strongest tradeoff, and lets the user select one before commit.
- 2026-06-02: Generate Another Set implemented: draft comparison can rerun the same settings with a shifted deterministic seed and replace the selectable draft options without returning to the form.
- 2026-06-02: Partial Regeneration V1 implemented. The Schedule Generator now offers Replace all vs Build from current; Build from current treats submitted, completed, cancelled, and playoff games as fixed protected assignments, filters out already-preserved matchups, previews the combined schedule, and commits by deleting only selected scheduled non-playoff game IDs before saving newly generated games.
- 2026-06-02: Manual travel/setup buffer V1 implemented without paid services. Event Settings persists `schedule_travel_venue_buffer_minutes` and `schedule_travel_facility_buffer_minutes` in tournament settings; Schedule Health counts tight travel/setup moves, dashboard health can surface them, and round-robin/playoff generators penalize drafts that give teams less rest than the organizer-entered buffer.
- 2026-06-02: Durable manual generator locks implemented. Migration 105 applied dev + prod and adds `games.generator_locked`; schedule rows expose a Keep/Release action; Build from current treats locked scheduled round-robin games as fixed and deletes only unlocked scheduled round-robin games.

## Active Docs

- `docs/projects/active/AUTOMATED_SCHEDULE_GENERATOR_PLAN.md`
- `docs/projects/active/AUTOMATED_SCHEDULE_GENERATOR_PM_BRIEF.md`
