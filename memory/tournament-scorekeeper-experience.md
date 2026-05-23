# Tournament Scorekeeper Experience

## Current decision

Build a dedicated mobile-first tournament scorekeeper experience instead of relying on the full admin Results & Scoring page for day-of score entry.

Detailed plan: `docs/active/codex_TOURNAMENT_SCOREKEEPER_EXPERIENCE_PLAN.md`.
PM brief: `docs/active/codex_TOURNAMENT_SCOREKEEPER_EXPERIENCE_PM_BRIEF.md`.

## Product shape

- Scorekeepers are authenticated day-of users backed internally by the `official` role.
- The product label is Scorekeeper.
- Scorekeepers submit scores for assigned tournaments and do not access the main admin area.
- Admin Results & Scoring remains the review/finalization/export/correction surface.
- Basic scorekeeper routing should be available on free Tournament and Tournament Plus.
- Tournament Plus value remains staff capacity, free official seats, exports, PDFs, summaries, and results notification.

## Implementation notes

- Implementation slice 2 added the canonical route `/{orgSlug}/scorekeeper` as a dedicated mobile-first scoring page with date/today, field, division, team search, status filters, policy-aware score entry, and loading/empty/error states.
- Existing API `app/api/official/[orgSlug]/score/route.ts` reads scorekeeper games through tournament assignment scope and now resolves auth against the visited `orgSlug`.
- Score submission now uses `app/api/scorekeeper/[orgSlug]/score/route.ts`, validates `submit_scores`, scopes the game to the visited org, and avoids the broad admin games route for scorekeeper writes.
- Score finalization policy now has a nullable tournament-level override via `tournaments.require_score_finalization`, with org fallback. Migration 066 was applied in dev and production. Event Settings exposes the override as inherit, admin review, or final immediately.
- Legacy `/{orgSlug}/official` and `/{orgSlug}/official/score` routes now redirect to `/{orgSlug}/scorekeeper`; visible product copy is scorekeeper-first.
- Results/public scoring integration audit is complete: pending-review scores are visible with pending labels, admin Results shows submitted scores for review/finalization, public standings include pending markers, and playoff advancement remains limited to finalized `completed` games.
- Admin score submission validation now rejects cancelled games, missing games, and non-whole/non-negative scores before changing game state.
- Results & Scoring now has an admin "Open Scorekeeper View" action that opens `/{orgSlug}/scorekeeper` in a new tab for day-of testing/use without changing scorekeeper permissions.
- Score submission audit metadata is implemented via migration 068, which was applied in dev and production: games record submitter user id, submitter email snapshot, submitted timestamp, and source (`scorekeeper` or `admin_results`). Results & Scoring expanded rows and exports show this metadata when present.
- Shared scoring rules now live in `lib/tournament-scoring-service.ts`; admin Results and Scorekeeper APIs use it for score validation, finalization policy, audit metadata, finalized/cancelled conflicts, finalize, and revert. Admin Results still permits finalized-score correction while Scorekeeper View blocks finalized-score edits.
- Existing tournament assignment scope is tournament-level, not field-level. Field/venue assignments are optional future scope unless product requires scorekeepers to see only their assigned field.
