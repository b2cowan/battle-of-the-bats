# Playoff Bracket Scheduling Plan

## Goal

Bring the Playoff Bracket Builder up to the same scheduling standard as the Round-Robin Generator: optional automated date/time/facility assignment, temporary facility lanes, schedule health metrics before save, and saved health metrics after submission.

## UX Summary

Admins configure the bracket structure first, then choose whether playoff games should be auto-assigned into available slots or left for manual scheduling later. When auto-assignment is enabled, admins choose playoff dates, game duration, turnover time, facilities, temporary facility count, minimum rest, max games per day, and scoring preferences. The generated bracket shows a Draft Health panel before commit. After saving, the Playoffs schedule view shows Saved Playoff Health.

Protected regeneration now follows the round-robin generator model. Admins can replace the whole playoff bracket or build from the current bracket. Build from current keeps submitted, completed, cancelled, and manually kept playoff games fixed while replacing only unlocked scheduled playoff rows.

## Implementation Scope

- Add optional playoff slot assignment controls to `PlayoffWizard`.
- Reuse the existing scored schedule generator and schedule health model.
- Extend the generator with dependency-aware matchup ordering and dependency rest enforcement.
- Preserve the existing manual bracket-builder workflow.
- Preserve playoff placeholders and bracket IDs so existing advancement logic still works.
- Carry temporary facility lanes through the bracket builder and bulk-save payload.
- Show saved health metrics for playoff views on the admin Schedule page.
- Add safe playoff regeneration semantics that preserve protected playoff games.
- Keep round-robin replacement from clearing playoff games.

## Current Implementation

- `lib/schedule-generator.ts` now supports optional `matchupId`, `dependsOnMatchupIds`, and `dependencyMinRestMinutes` fields.
- Dependency source games are biased toward earlier slots so downstream rounds can still be scheduled.
- `PlayoffWizard` now has a `Schedule playoff windows` / `Create bracket only` toggle.
- Auto-scheduled playoff drafts use selected dates, facilities, duration, turnover, max games/day, min rest, back-to-back, facility-move, early/late, and effort settings.
- `BracketBuilder` preserves `scheduleFacilityLaneId` and `scheduleFacilityLaneLabel`.
- Playoff Draft Health appears before save when rows have dates and times.
- Saved Schedule Health now appears in Playoffs view with `includePlayoffs: true`.
- Focused unit coverage added for dependency-aware playoff scheduling.
- The Schedule row Keep/Release control now applies to scheduled playoff games.
- Playoff Wizard now has Replace bracket vs Build from current.
- Build from current passes protected playoff games as fixed assignments, displays them in the preview, deletes only unlocked scheduled playoff IDs, and saves only newly generated rows.
- Round-robin `delete-division-games` now clears round-robin games only, leaving playoffs intact.
- Focused unit coverage now includes dependent playoff rounds after a fixed protected source game.
- Delete-policy coverage now verifies round-robin delete scoping, playoff replaceability, protected playoff rejection, and game ID sanitization.
- Browser verification completed by the user.

## Remaining Work

- Add a future manual travel-buffer matrix if product chooses to support organizer-entered travel estimates.
- Consider a championship-window preference and facility priority by round.
- Consider scheduling only first-round playoff games until pool standings are final.

## Verification

Automated:

- `node --test tests\unit\schedule-generator.test.ts`
- `node --test tests\unit\game-delete-policy.test.ts`
- `node --test tests\unit\schedule-generator.test.ts tests\unit\schedule-metrics.test.ts`
- `npx.cmd tsc --noEmit --pretty false`

Browser verification completed by the user.
