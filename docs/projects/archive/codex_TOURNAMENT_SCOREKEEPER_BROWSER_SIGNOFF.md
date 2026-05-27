# Tournament Scorekeeper Browser Sign-Off Checklist

> Status: Manual sign-off complete
> Created: 2026-05-23
> Parent plan: [codex_TOURNAMENT_SCOREKEEPER_EXPERIENCE_PLAN.md](codex_TOURNAMENT_SCOREKEEPER_EXPERIENCE_PLAN.md)

## Purpose

Use this checklist to manually accept the dedicated scorekeeper experience after the automated UAT smoke passes. The automated smoke covers the critical data path; this checklist covers human workflow, mobile ergonomics, copy, and permission boundaries.

## Test Setup

- Use one active tournament with accepted teams and at least three games today:
  - one unscored scheduled game
  - one scorekeeper-submitted Pending Review game
  - one completed/final game
- Use one tournament where score finalization is required.
- Use one tournament where score finalization is disabled.
- Use one scorekeeper assigned to the tournament.
- Use one scorekeeper with no relevant tournament assignment if available.
- Use one owner/admin account with Results & Scoring access.
- Use one non-scorekeeper/non-admin account if available for access-denied checks.

## Viewports

- Mobile: `390x844`
- Desktop: about `1440x1000`

## Routes

- `/{orgSlug}/scorekeeper`
- `/{orgSlug}/official`
- `/{orgSlug}/official/score`
- `/{orgSlug}/admin/tournaments/results`
- `/{orgSlug}/admin/tournaments/settings/event`
- `/{orgSlug}/admin/org/members` or the current Members route

## Scorekeeper Mobile

- Scorekeeper login lands in or can navigate directly to `/{orgSlug}/scorekeeper`.
- Page has no admin sidebar, exports, billing, registration, schedule-builder, or settings controls.
- Page has no horizontal overflow at `390x844`.
- Header, date control, counts, and filters fit without overlapping.
- Game cards are easy to tap and show teams, time, field, division, and status.
- Today/date, field, division, team search, and status filters are usable on mobile.
- Empty states are distinct:
  - no assigned tournaments
  - no active tournaments
  - no games today
  - filters no match
  - all matching games finalized
- Loading and error states do not trap the user on a blank page.

## Score Entry

- Scorekeeper opens a scheduled game and sees large numeric score inputs.
- Non-negative whole-number scores submit successfully.
- Missing, negative, decimal, or non-number scores are rejected clearly.
- When finalization is required, submit label communicates review and result becomes Pending Review.
- When finalization is disabled, submit label communicates final save and result becomes Final/Completed.
- Scorekeeper can correct a Pending Review score before admin finalization.
- Scorekeeper cannot edit a finalized score.
- If an admin finalizes while the scorekeeper is looking at the game, the next attempted save fails with a finalized/conflict message.

## Admin Review

- Results & Scoring shows Pending Review games from scorekeeper submissions.
- Expanded row or details show score submission metadata:
  - submitted by
  - submitted at
  - source
- Admin can finalize a Pending Review game.
- Admin can correct a finalized score from Results & Scoring.
- Admin can revert a scored game to scheduled, clearing score and current submission metadata.
- Results export includes Submitted By, Submitted At, and Submission Source.
- Public standings/results behavior matches product policy for pending vs final scores.
- Playoff advancement happens only from finalized completed games.

## Settings And Access

- Event Settings offers the score finalization policy:
  - inherit organization setting
  - require admin review
  - final immediately
- Members/help copy refers to Scorekeeper as the product role.
- Scorekeeper tournament assignment scope is clear to admins.
- Scorekeepers do not get access to main admin routes.
- Staff/admin/owner users with the scoring capability can open Scorekeeper View for day-of use or testing.
- Users without scorekeeper capability cannot see score data.
- Unauthenticated users opening the route are redirected to login with the intended next URL.

## Compatibility

- `/{orgSlug}/official` redirects to `/{orgSlug}/scorekeeper`.
- `/{orgSlug}/official/score` redirects to `/{orgSlug}/scorekeeper`.
- Existing scorekeeper API behavior remains scoped to the visited organization.

## Automated Evidence

- `pnpm.cmd exec playwright test --config playwright.config.ts --project=uat tests/uat/scenarios/tournament-scorekeeper-smoke.spec.ts`
- `pnpm.cmd exec playwright test --config playwright.config.ts --project=uat --no-deps tests/uat/scenarios/tournament-scoring-service.spec.ts`
