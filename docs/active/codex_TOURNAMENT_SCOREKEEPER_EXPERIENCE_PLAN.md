# Tournament Scorekeeper Experience Plan

> Status: Implementation slice 7 complete - shared scoring service now centralizes score submit/finalize/revert rules for admin Results and Scorekeeper APIs; migrations 066 and 068 applied in dev and production
> Created: 2026-05-22
> Parent context: Tournament Experience Excellence
> PM brief: [codex_TOURNAMENT_SCOREKEEPER_EXPERIENCE_PM_BRIEF.md](codex_TOURNAMENT_SCOREKEEPER_EXPERIENCE_PM_BRIEF.md)

## Product Decision

Build a dedicated mobile-first scorekeeper experience instead of asking field scorekeepers to use the full Results & Scoring admin page.

The Results & Scoring admin page remains the organizer review desk: admins can scan all games, export results, finalize pending scores, revert/correct results, and close out the tournament. The scorekeeper route is the day-of field workflow: find the right game quickly, enter the score, and understand whether that submission is final or waiting for review.

## Current System Read

Existing pieces to reuse:

- `app/[orgSlug]/official/score/page.tsx` already provides a focused scorekeeper-like page with today's games, venue/division filters, status messaging, large numeric score entry, and realtime game updates.
- `app/api/official/[orgSlug]/score/route.ts` already reads games through the authenticated member's tournament assignment scope.
- `app/api/admin/games/route.ts` already centralizes score submission, score finalization, and score revert behavior.
- `org_member_tournament_assignments` already restricts staff/official access by tournament.
- The `official` role already defaults to `submit_scores` only and is not intended to use the main admin area.
- `organizations.require_score_finalization` already controls whether official/staff submissions become `submitted` or `completed`.

Remaining gaps after implementation slice 3:

- The user-facing scorekeeper route now exists as `/{orgSlug}/scorekeeper` with a dedicated mobile-first scoring page.
- Score submissions now use the visited org-scoped scorekeeper API path instead of posting to the broad admin games route.
- Event Settings now exposes the tournament score finalization policy as inherit organization default, admin review, or final immediately.
- Score submission audit metadata is still a future decision if Results & Scoring should show submitted by/time.
- Existing tournament assignments restrict by tournament, not by venue/field. That is acceptable for MVP if filters are strong, but larger events may need field-level scorekeeper assignments later.

Implementation slice 4 audit notes:

- Results & Scoring remains the source of truth for Pending Review, Finalize, Revert, exports, standings, and corrections.
- Pending-review games now show their submitted score in admin schedule/results rows instead of appearing unscored until finalization.
- Public schedule/bracket surfaces continue to label pending-review scores as Pending when finalization is required.
- Public standings already include submitted scores with pending markers; that preserves day-of visibility while signaling that the result is not official yet.
- Playoff advancement remains restricted to `completed` games only, so a pending score cannot advance a bracket.
- Admin score submission now rejects cancelled games, missing games, and non-whole/non-negative scores with clearer API responses.

Implementation slice 5 admin entry point:

- Results & Scoring now includes an "Open Scorekeeper View" header action for admins.
- The action opens `/{orgSlug}/scorekeeper` in a new tab so admins keep the review/finalization desk open while testing or using the lightweight day-of route.
- This is an entry point only; permissions continue to come from the existing protected scorekeeper route and capability checks.

Implementation slice 6 score submission audit metadata:

- Migration 068 adds nullable score audit columns to `games`: submitter user id, submitter email snapshot, submitted timestamp, and submission source. Migration 068 was applied in dev and production.
- Scorekeeper submissions write source `scorekeeper`; admin Results score saves write source `admin_results`.
- Reverting a score clears the score audit metadata along with the score.
- Results & Scoring expanded rows and results exports now show submitter/source/time when metadata exists.
- Public tournament game data intentionally does not expose score submitter metadata.

Implementation slice 7 shared scoring service:

- `lib/tournament-scoring-service.ts` now centralizes game lookup, score validation, pending-vs-final status, finalized/cancelled conflicts, audit metadata writes, finalization, and revert behavior.
- Admin Results and Scorekeeper APIs both call the shared service while keeping route-level auth, capability, and tournament-scope checks in the route handlers.
- Admin Results can still correct finalized scores; Scorekeeper View still blocks finalized-score edits.
- Error messages are now shared for invalid scores, missing games, cancelled games, and finalized score conflicts.

## Product Manager UX Summary

A scorekeeper is a trusted day-of user, usually a field official, volunteer, or staff member standing near the field with a phone. They do not need registration tools, exports, billing, branding, schedule generation, or tournament settings. They need to open FieldLogicHQ, see the games they are allowed to score, filter by field or division, tap a game, enter the final score, and move on.

After this feature, an invited scorekeeper lands directly in a lightweight scoring workspace after login. On mobile, the first screen is a compact day view with status counts, filters, and game cards. On desktop, the same workflow remains narrow and task-focused rather than becoming a full admin dashboard.

Scores either become final immediately or enter Pending Review based on tournament scoring settings. Admins continue to use Results & Scoring to review, finalize, revert, export, and close out results.

## Users, Roles, And Permissions

### Primary User: Scorekeeper

Role:

- Current role basis: `official`.
- Product label: Scorekeeper or Field Official.
- Default capability: `submit_scores`.
- No main admin access.

Permissions:

- Can view scorekeeper workspace for the org.
- Can view games in tournaments they are assigned to.
- Can submit scores for visible, non-final games.
- Can correct a submitted score until it is finalized by an admin.
- Cannot finalize a pending score as a separate action.
- Cannot edit a finalized score.
- Cannot manage teams, registrations, schedule structure, settings, members, billing, branding, communication, exports, archives, or post-event summaries.

Access scope:

- MVP uses tournament assignment scope through `org_member_tournament_assignments`.
- If a scorekeeper has assignment rows, they see only those tournaments.
- If a scorekeeper has no assignment rows, existing absence-means-unrestricted behavior would show all active tournaments. For scorekeepers, the product should consider changing the invite/manage flow to encourage explicit tournament assignment, but avoid a breaking semantics change without migration.
- Field/venue-level access is a future enhancement, not required for the MVP unless the product wants officials to see only their field.

### Secondary Users

Owner/admin:

- Can invite scorekeepers, assign tournaments, and manage member status.
- Can open the scorekeeper route for testing or day-of use.
- Can review/finalize/revert scores in Results & Scoring.

Staff:

- Current staff can use admin surfaces based on capabilities.
- Staff may also benefit from the lightweight scorekeeper route for day-of score entry.
- Staff should not automatically gain score finalization unless the product adds a dedicated `finalize_scores` capability.

Coach/team contact/public visitor:

- No scorekeeper access.
- Continue to use public schedule/standings/results.

## Invite And Access Model

MVP:

- Admin opens Staff & Access / Members.
- Admin invites a user as Field Official (scorekeeper).
- Invite email explains that the user gets a scorekeeper workspace, not admin access.
- After accepting the invite, official users redirect to the scorekeeper landing route.
- Admin can manage tournament assignments from the existing member management modal.

Recommended product language changes:

- Rename visible "Official" wording to "Scorekeeper" where the workflow is score-entry-only.
- Keep "Field Official" as a parenthetical label if sports organizations expect that language.
- Change capability label from "Submit & finalize scores" to "Submit scores" for scorekeeper-facing documentation. Admin finalization should be described separately.

Not in MVP:

- Public no-login scoring links.
- Shared field PINs.
- QR-code token scoring.

Those options are convenient but weaken score integrity and auditability. Revisit only after authenticated scorekeeper UX is solid.

## Landing After Login

Recommended canonical route:

- `/{orgSlug}/scorekeeper`

Compatibility routes:

- Keep `/{orgSlug}/official` and `/{orgSlug}/official/score` as redirects or aliases during migration.

Landing behavior:

- Official/scorekeeper after invite acceptance: `/{orgSlug}/scorekeeper`.
- Official/scorekeeper after normal login: `/{orgSlug}/scorekeeper`.
- Staff/admin/owner opening a scorekeeper link: allowed if they have `submit_scores`.
- Unauthenticated user opening a scorekeeper link: redirect to `/auth/login?next=/{orgSlug}/scorekeeper`.
- User without scorekeeper capability: access-denied state with org contact/admin guidance.

## Desktop And Mobile Experience

Mobile is the primary operating surface.

Mobile layout:

- Sticky compact header with org/tournament context, date, and sign-out/menu action.
- Status strip: To Score, Pending Review, Finalized.
- Filter row: date/today, field, division, team search, status.
- Game cards grouped by time or field.
- Large tap target for each scoreable game.
- Bottom-sheet score entry with team names, large numeric inputs, and clear submit action.
- Result state after save: "Submitted for review" or "Final score saved" depending on policy.

Desktop layout:

- Same content in a centered, narrow workspace.
- Optional two-column layout only if it improves scanning: filters/status left, games right.
- No admin sidebar, export menus, billing prompts, or dense Results page controls.

Visual direction:

- Use existing product tokens/components where practical instead of hardcoded inline styles.
- Keep the route operational, not decorative.
- Avoid nested cards; use a clean list surface with individual game cards.

## Routes And Boundaries

Scorekeepers can access:

- `/{orgSlug}/scorekeeper`
- `/{orgSlug}/scorekeeper/help` or inline help if added later
- Auth routes needed for login, logout, and invite acceptance
- Public tournament pages that any visitor can access

Scorekeepers cannot access:

- `/{orgSlug}/admin/**`
- `/{orgSlug}/admin/tournaments/results`
- `/{orgSlug}/admin/tournaments/schedule`
- `/{orgSlug}/admin/tournaments/teams`
- `/{orgSlug}/admin/tournaments/settings/**`
- `/{orgSlug}/admin/org/**`
- `/platform-admin/**`

Implementation note:

- Update `proxy.ts`, not `middleware.ts`, if request interception needs to include the new route. This repo uses the Next.js 16 `proxy.ts` convention.

## Finding Games

Default:

- Load today's games for accessible active tournaments.
- Show non-final games first.
- Keep finalized games hidden by default but reachable.

Primary filters:

- Today/date selector.
- Venue/field.
- Division.
- Team search.
- Status: To Score, Pending Review, Finalized, Cancelled.

Useful grouping:

- Upcoming / In Progress / Completed if enough time data exists.
- Otherwise group by time, then field.
- If multiple accessible tournaments are active, show tournament name on each card and include a tournament filter.

Search behavior:

- Team search matches home team, away team, placeholders, and possibly pool-slot display names.
- Empty filtered result tells the user how to widen the list.

## Score Entry Workflow

1. Scorekeeper taps a scoreable game card.
2. Bottom sheet opens with teams, field, time, division, and current status.
3. Scorekeeper enters non-negative integer scores.
4. Save button label reflects policy:
   - `Submit for Review` when finalization is required.
   - `Save Final Score` when finalization is not required.
5. UI validates both scores are present.
6. API checks auth, org, tournament assignment, capability, game status, and score policy.
7. Game updates:
   - Finalization required: status becomes `submitted`.
   - Finalization not required: status becomes `completed`.
8. Scorekeeper returns to the list with a clear success state.

Conflict handling:

- If an admin finalizes the game while the scorekeeper has the sheet open, save should fail with "This score has already been finalized."
- If another scorekeeper updates a pending score, realtime/polling should refresh the card and the edit sheet should warn before overwriting.
- If the game has missing teams/TBD placeholders, allow score entry only if the game is valid for scoring by current business rules; otherwise show a disabled card.

## Final, Pending Review, And Public Results

Recommended policy model:

- `require_score_finalization = true`: scorekeeper submissions become `submitted`.
- `require_score_finalization = false`: scorekeeper submissions become `completed`.

Product behavior:

- Pending Review scores can be visible on public standings/results but should be labelled as not final where applicable.
- Completed scores are final and can trigger playoff advancement.
- Admin finalization moves `submitted` to `completed` and triggers any dependent bracket/standings behavior.

Data-model decision:

- The codebase currently persists `require_score_finalization` on `organizations`.
- The Event Settings page presents score finalization as tournament-specific.
- Recommended fix: add nullable `tournaments.require_score_finalization` and compute an effective policy:
  - `tournaments.require_score_finalization` when non-null.
  - Otherwise fall back to `organizations.require_score_finalization`.
- Alternative: keep org-level only and update Event Settings copy/UI to make that explicit.
- Because the request references tournament settings, this plan recommends the tournament-level override.

## Editing Submitted Scores

Scorekeeper:

- Can edit/correct a `submitted` score before admin finalization.
- Cannot edit `completed` scores.
- If finalization is disabled and their submission becomes `completed`, they cannot edit afterward from the scorekeeper route.

Admin:

- Can finalize pending review scores in Results & Scoring.
- Can revert a scored game to scheduled from Results & Scoring when correction is needed.
- Any final score correction should remain an admin action, not a scorekeeper action.

Recommended audit behavior:

- Record who submitted, corrected, finalized, and reverted each score.
- The game row remains the source of truth for current standings.
- A score event/submission log preserves accountability.

## Empty, Loading, And Error States

Loading:

- "Loading today's games" with skeleton game cards.
- Save state on the bottom sheet with disabled submit button.

Empty:

- No tournament access: "No tournaments are assigned to your scorekeeper account."
- No active tournaments: "There are no active tournaments available for scorekeeping right now."
- No games today: "No assigned games today."
- All done: "All assigned games are finalized."
- Filters no match: "No games match these filters" with Clear filters action.
- Only finalized hidden: "Matching games are finalized" with Show finalized action.

Error:

- Sign in required.
- Access denied.
- Network/load failure with Retry.
- Save failure with preserved entered scores.
- Conflict/finalized during edit.
- Invalid score input.
- Wrong org link.

## Interaction With Results & Scoring Admin

Results & Scoring remains the authoritative admin surface.

Admin Results should:

- Show `submitted` games under Pending Review.
- Show submitter/time metadata if score audit data exists.
- Let eligible admins finalize pending scores.
- Let eligible admins revert scores for corrections.
- Continue exports/PDFs from the current game data.
- Continue public standings/result behavior from the current game statuses.

Scorekeeper route should:

- Reuse the same scoring service/API rules as Results.
- Never duplicate finalization logic.
- Refresh when admin finalizes or reverts a game.
- Link no deeper than "Contact your admin" for scorekeepers; no admin route links for official users.

## Plan-Tier Implications

Core scorekeeper route:

- Available on free Tournament and Tournament Plus.
- Score entry is part of a complete starter tournament.

Tournament Plus value:

- Officials do not count against seats on Tournament Plus and higher, based on `PLAN_CONFIG.officialsFreeSeats`.
- Plus already offers more staff capacity and serious operations tools around the scoring workflow: exports, PDF exports, post-event summaries, results notification, and repeat-event workflow.

Do not Plus-gate:

- Authenticated scorekeeper route.
- Basic score submission.
- Pending review/finalization policy.

Possible future Plus enhancements:

- Field-level scorekeeper assignment at scale.
- Score submission audit exports.
- SMS/email scorekeeper reminders.
- Scorekeeper check-in dashboard.

## Required Data Model And API Changes

### Data Model

Required:

- Add nullable `tournaments.require_score_finalization boolean` if tournament-level policy is confirmed.
- Add an effective policy helper that resolves tournament override then org default.

Implemented current-score audit metadata:

- Add nullable `games` score audit metadata for the current visible score:
  - `score_submitted_by_user_id`
  - `score_submitted_by_email`
  - `score_submitted_at`
  - `score_submission_source`

Optional future event history:

- Add `game_score_events` or `game_score_submissions` to track:
  - game id
  - tournament id
  - submitted by member/user
  - source (`scorekeeper`, `admin_results`, `system`)
  - action (`submitted`, `corrected`, `finalized`, `reverted`)
  - home score
  - away score
  - status before/after
  - created/reviewed timestamps

Optional future:

- Add field/venue assignment scope if tournaments need scorekeepers restricted to specific diamonds/venues:
  - member id
  - tournament id
  - diamond id
  - active date or date range

### APIs

Recommended:

- Create scorekeeper-specific API routes, for example:
  - `GET /api/scorekeeper/[orgSlug]/games?date=YYYY-MM-DD`
  - `PATCH /api/scorekeeper/[orgSlug]/games/[gameId]/score`
- Keep `/api/official/[orgSlug]/score` as a compatibility alias or migrate it.
- Shared scoring logic now lives in `lib/tournament-scoring-service.ts` so admin and scorekeeper submissions cannot diverge.
- Ensure every scorekeeper/admin score request resolves auth with the visited `orgSlug`.
- Add clear 401/403/409 responses for login, capability, scope, and finalized-conflict states.

### App/Auth Routing

Required:

- Update invite acceptance so official/scorekeeper users land on the scorekeeper route.
- Update login destination logic for the official role.
- Update official layout/routes to redirect to or wrap the new scorekeeper route.
- Update `proxy.ts` matchers if the new route needs request interception/session refresh.

## Suggested Implementation Phases

### Phase 0 - Plan Sign-Off

- [x] Create this dedicated plan.
- [x] Create the PM brief.
- [x] Confirm canonical route name: `/{orgSlug}/scorekeeper`.
- [x] Confirm tournament-level score policy override vs org-level only: nullable tournament override with org-level fallback.
- [x] Confirm whether field-level assignment is MVP or future: future enhancement.

### Phase 1 - Foundation And Policy

- [x] Add/fix effective score finalization policy.
- [x] Add migration if tournament-level override is approved. Migration 066 applied in dev and production.
- [x] Extract shared score submission/finalization service.
- [x] Add scorekeeper API routes or harden existing official routes with visited `orgSlug`.
- [x] Add tournament-level score finalization override UI in Event Settings.
- [x] Add score submission audit metadata for the current visible score. Migration 068 applied in dev and production.
- [x] Update auth destination for official users.

### Phase 2 - Scorekeeper Route MVP

- [x] Build `/{orgSlug}/scorekeeper` route and mobile-first layout shell.
- [x] Reuse existing official score page behavior where possible.
- [x] Replace hardcoded inline styling with maintainable module/shared styles for the canonical scorekeeper page.
- [x] Add filters: date/today, field, division, team search, status.
- [x] Add bottom-sheet score entry with policy-aware submit labels.
- [x] Add loading, empty, access denied, save error, and conflict states.
- [x] Keep old official routes as redirects/aliases.

### Phase 3 - Admin Integration

- [x] Add "Open Scorekeeper View" entry point for eligible users.
- [x] Improve Members/Staff & Access copy for scorekeeper invites and assignments.
- [x] Show submitter/time metadata in Results & Scoring if audit metadata exists.
- [x] Confirm Pending Review, Finalize, Revert, exports, standings, and playoff advancement continue to use one shared source of truth.
- [x] Update tournament help content.

### Phase 4 - Hardening And UAT Prep

- [ ] Add focused unit/integration coverage for score policy and access scope.
- [ ] Add UAT seed data for free and Plus scorekeeper users.
- [ ] Run TypeScript, focused lint, and whitespace checks.
- [ ] Restart dev server only if implementation changes route files, shared modules, `proxy.ts`, migrations, or config.
- [ ] Prepare browser sign-off checklist for the user.

### Phase 5 - Future Enhancements

- [ ] Field/venue-level scorekeeper assignments.
- [ ] Scorekeeper assignment reminders.
- [ ] Score event audit exports.
- [ ] Scorekeeper manager dashboard for large events.
- [ ] Optional public display/scoreboard mode.

## UAT And Browser Verification Plan

Per project rule, user browser verification is expected unless explicitly requested otherwise. Agent verification should cover static checks and API/unit tests added by implementation.

### UAT Data Needed

- Free Tournament org with:
  - active tournament
  - accepted teams
  - games scheduled today across at least two fields and two divisions
  - one scheduled game, one submitted game, one completed game
  - one scorekeeper assigned to the tournament
- Tournament Plus org with the same shape.
- One scorekeeper with no tournament assignment.
- One scorekeeper assigned to a tournament with no games today.
- One staff/admin user with score submission access.

### Browser Matrix

Viewports:

- Mobile: 390x844
- Desktop: about 1440x1000

Routes:

- `/{orgSlug}/scorekeeper`
- `/{orgSlug}/official` compatibility route
- `/{orgSlug}/official/score` compatibility route
- `/{orgSlug}/admin/tournaments/results`
- `/{orgSlug}/admin/tournaments/settings/event`
- `/{orgSlug}/admin/tournaments/settings/members` or org Members route

### Acceptance Scenarios

- Scorekeeper accepts invite and lands in the scorekeeper workspace.
- Scorekeeper with valid tournament access sees today's assigned games.
- Scorekeeper can filter by field, division, team, and status.
- Score submission with finalization disabled becomes Completed immediately.
- Score submission with finalization enabled becomes Pending Review.
- Scorekeeper can correct a Pending Review score before admin finalization.
- Scorekeeper cannot edit a finalized score.
- Admin sees Pending Review in Results & Scoring and can finalize.
- Admin can revert a score and scorekeeper sees it return to To Score.
- Public standings/results reflect pending/final status as designed.
- Empty states are distinct for no access, no active tournaments, no games today, all finalized, and filters no match.
- Wrong-org, no-capability, and unauthenticated users do not see score data.
- Mobile has no page-level horizontal overflow and score inputs/buttons meet touch target expectations.

### Non-Browser Verification

- TypeScript passes.
- Focused lint on touched scorekeeper/admin/API files passes or has only existing accepted warnings.
- `git diff --check` passes.
- API tests or manual API probes confirm 401/403/409/200 behavior.
- If `proxy.ts`, shared auth, route files, migrations, or config change, restart the dev server with network access and verify `/platform-admin/login?next=%2Fplatform-admin` returns HTTP 200 with no Supabase `EACCES` failures.

## Open Decisions

- Should the canonical route be `/{orgSlug}/scorekeeper` or should `/{orgSlug}/official/score` remain canonical?
- Should score finalization be tournament-level with org fallback, or organization-level only?
- Should staff users be allowed into the scorekeeper route by capability, or should it remain official-only?
- Should a scorer manager role/capability exist separately from tournament sealing/archive permissions?
- Is field-level assignment needed for MVP, or are tournament-level assignments plus filters sufficient?
- Should pending review scores be visible publicly immediately, or should public standings hide them until finalization for some tournaments?
