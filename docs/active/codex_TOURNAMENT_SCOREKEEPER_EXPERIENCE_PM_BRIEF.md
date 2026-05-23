# Tournament Scorekeeper Experience PM Brief

> Status: Implementation slice 7 complete - shared scoring service now centralizes score submit/finalize/revert rules for admin Results and Scorekeeper APIs; migrations 066 and 068 applied in dev and production
> Created: 2026-05-22
> Detailed plan: [codex_TOURNAMENT_SCOREKEEPER_EXPERIENCE_PLAN.md](codex_TOURNAMENT_SCOREKEEPER_EXPERIENCE_PLAN.md)

## Proposed Functionality

Create a dedicated mobile-first scorekeeper workspace for tournament day. Invited scorekeepers land directly in a focused route where they can see today's accessible games, filter by field/division/team/status, tap a game, enter the score, and understand whether the result is final or waiting for admin review.

Admin Results & Scoring remains the review and closeout surface for organizers. Admins use it to finalize pending scores, correct/revert results, export, and manage the official tournament record.

Pending-review scores are still useful on tournament day, so they remain visible in Results, public schedule/bracket views, and standings where the product already exposes them. The important distinction is labeling and authority: public/day-of views can show "Pending", while Results & Scoring is where an admin makes the result official.

Admins can now open the Scorekeeper View directly from Results & Scoring in a new tab. That gives organizers a fast way to test the field workflow or use it at the venue while preserving Results & Scoring as the review desk.

Score submissions now carry review metadata. Results & Scoring can show who last submitted or corrected the visible score, when it happened, and whether it came from the Scorekeeper View or the admin Results surface.

The admin and scorekeeper score-writing APIs now share one scoring service. The user-facing workflow is intentionally the same, but validation, finalization policy, audit metadata, finalized/cancelled conflicts, and revert behavior are applied consistently no matter where the score is entered.

## Why It Matters

The current Results & Scoring page is now strong for admins, but field scorekeepers have a different job. They are often on a phone, under time pressure, and should not have to navigate exports, review controls, admin filters, or unrelated tournament operations.

A dedicated route makes FieldLogicHQ feel ready for event day, not just setup day.

## Customer Impact

Scorekeepers get a simple, fast workflow:

- Open the scorekeeper link.
- See the right games for today.
- Filter quickly by field, division, team, or status.
- Enter scores with large mobile inputs.
- Know whether the score is final or pending review.

Organizers get better control:

- Invite scorekeepers without giving admin access.
- Decide whether scores are final immediately or require review.
- Review pending scores in Results & Scoring.
- Keep corrections and finalization as admin actions.

## Role And Access Impact

Scorekeepers are authenticated users, not public link holders. The current `official` role is the closest existing role and should be productized as "Scorekeeper" or "Field Official (scorekeeper)".

Scorekeepers can submit scores for assigned tournaments. They cannot access the main admin area, registration management, settings, billing, communication, exports, or post-event summary tools.

Owners/admins continue to manage invites, assignments, review, finalization, and corrections.

## Plan-Tier Impact

The scorekeeper route should be available on both free Tournament and Tournament Plus. Basic score entry is core to running a tournament.

Tournament Plus still has relevant paid value around the workflow: officials are free seats on Plus and higher, Plus includes more staff capacity, and Plus owns advanced operations such as exports, PDFs, post-event summaries, and results notification.

## Priority

High for tournament-day readiness.

This should come after the core admin Results page is stable, which it now is, and before deeper public/mobile polish claims the tournament experience is day-of ready.

## Success Criteria

- Scorekeepers land directly in a focused scoring workspace after login.
- Mobile score entry works cleanly at 390x844 with no horizontal overflow.
- Scorekeepers can find games by today/date, field, division, team, and status.
- Score submission respects score finalization settings.
- Pending Review scores appear in admin Results for finalization.
- Scorekeepers can correct pending scores but cannot edit finalized scores.
- Admins can finalize and revert from Results & Scoring.
- Empty, loading, denied, and error states are distinct and understandable.
- Free Tournament and Tournament Plus both pass the scorekeeper UAT flow.

## Key Product Decisions Needed

- Canonical route name: recommended `/{orgSlug}/scorekeeper`.
- Whether score finalization is truly tournament-level or remains organization-level.
- Whether field-level scorekeeper assignment is needed for MVP.
- Whether a scorer manager needs a separate finalization capability later.
