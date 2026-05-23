# Tournament Scorekeeper Experience

## Current decision

Plan a dedicated mobile-first tournament scorekeeper experience instead of relying on the full admin Results & Scoring page for day-of score entry.

Detailed plan: `docs/active/codex_TOURNAMENT_SCOREKEEPER_EXPERIENCE_PLAN.md`.
PM brief: `docs/active/codex_TOURNAMENT_SCOREKEEPER_EXPERIENCE_PM_BRIEF.md`.

## Product shape

- Scorekeepers are authenticated day-of users, currently closest to the `official` role.
- The product label should become Scorekeeper or Field Official (scorekeeper).
- Scorekeepers submit scores for assigned tournaments and do not access the main admin area.
- Admin Results & Scoring remains the review/finalization/export/correction surface.
- Basic scorekeeper routing should be available on free Tournament and Tournament Plus.
- Tournament Plus value remains staff capacity, free official seats, exports, PDFs, summaries, and results notification.

## Implementation notes

- Existing route `app/[orgSlug]/official/score/page.tsx` is a useful starting point but should be productized into a canonical scorekeeper route, recommended as `/{orgSlug}/scorekeeper`.
- Existing API `app/api/official/[orgSlug]/score/route.ts` already reads scorekeeper games through tournament assignment scope.
- Score submission currently uses `/api/admin/games`; a dedicated scorekeeper API or shared score service should ensure all score writes resolve auth against the visited `orgSlug`.
- The Event Settings UI implies tournament-level score finalization, but the persisted setting found during planning is organization-level. The plan recommends adding a nullable tournament-level override with org fallback, or revising UX copy if the policy stays org-wide.
- Existing tournament assignment scope is tournament-level, not field-level. Field/venue assignments are optional future scope unless product requires scorekeepers to see only their assigned field.
