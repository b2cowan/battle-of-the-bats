# Free Tier Strategy Project Memory

Canonical execution lives in `docs/projects/active/FREE_TIER_COACHES_UNIFIED_PLAN.md`.
Strategy detail lives in `docs/projects/active/FREE_TIER_STRATEGY_PLAN.md`.

## Current Model

- The free-floor model is "separate scoped floors, one account."
- The Basic Coaches Portal free floor is org-less (`basic_coach_teams`), not an org subscription.
- Free Basic coach floor includes team profile, multi-team, master roster, basic schedule, basic comms, manual fee ledger, and standalone Team HQ.
- Premium keeps lineups, attendance, documents, budget, dues automation, power-calendar, and online collection.
- Payment processing is deferred. Manual fee tracking is the only money handling in the free-floor rollout.

## Build State

- Phase 3 master roster is built locally on `feat/free-tier-coaches`: `basic_coach_team_players` migration 114, owner-gated CRUD, `RosterEditor`, dictionary sealed.
- Phase 4 Slice 4a schedule is built and browser-verified: `basic_coach_team_events` migration 115, owner-gated CRUD, `ScheduleEditor`, dictionary sealed.
- Phase 4 Slice 4b manual fee ledger is built and browser-verified: `basic_coach_team_fees` migration 116 applied to dev only, owner-gated CRUD, `FeeEditor`, dictionary sealed.
- Phase 4 Slice 4c basic team comms is built and browser-verified: `basic_coach_team_announcements` migration 117 applied to dev only, owner-gated send/log route, `AnnouncementEditor`, dictionary sealed.
- Phase 4 Slice 4d standalone Team HQ is built locally and awaiting browser verification: Team HQ stat strip, scope-ceiling express-interest capture via existing `early_access_leads`, and standalone Basic welcome email. No migration.

## Slice 4b Notes

- `basic_coach_team_fees.amount` uses `numeric(10,2)` dollars, matching the app's tournament/league/accounting/rep-dues money convention. It intentionally does not use integer cents.
- `player_id` is nullable and uses `ON DELETE SET NULL`, so deleting a player keeps the ledger entry as team-wide/unassigned history.
- Fee status is binary V1: `unpaid` or `paid`. The manual paid toggle stamps `marked_paid_at`; toggling unpaid clears it.
- No Stripe, online collection, partial payments, installments, reminders, dues automation, budget, or accounting integration belong in the Basic manual ledger.
- Access uses `requireBasicCoachTeamOwner`; mutations also scope by `basic_coach_team_id`. The server validates that any supplied `player_id` belongs to the same team to close the cross-team player-link IDOR seam.

## Slice 4c Notes

- `basic_coach_team_announcements` is a one-way send log, not a parent-account/chat system. It stores subject/body plus recipient/sent/failed counts and status, but not recipient email addresses.
- Recipients are recomputed from the owned team's `basic_coach_team_players.contact_email` values on every send, normalized, basic-validity checked, and deduped. The API never accepts arbitrary recipient input.
- The send path uses the existing `sendEmail` helper sequentially; `sent_count` means provider-accepted send, while missing API key / provider rejection / thrown errors count as failed. 4c caps each send at 100 deduped contacts and 10 announcements per team per rolling 24 hours.
- No SMS/push, replies inbox, read receipts, payment reminders, dues automation, or Premium pitch copy belongs in the Basic comms slice.
- Access uses `requireBasicCoachTeamOwner`; every query is scoped by `basic_coach_team_id`. Platform-admin sessions are rejected by the shared guard.

## Slice 4d Notes

- The Team HQ strip summarizes the owned standalone team's roster count, next non-cancelled future event, unpaid manual fees, announcement-ready contacts, and tournament history without exposing data to signed-out or platform-admin sessions. The next-event timestamp is formatted in the coach's browser so Amplify/Node timezone does not skew the display.
- Scope-ceiling interest is an owner-gated POST only. It does not create checkout sessions, unlock Premium, mutate entitlements, or touch Stripe. It appends/updates the existing `early_access_leads` row for the signed-in coach email with `plan_interest=['team']`, `coach_portal`, and the selected team tool interests; it preserves existing release-notification opt-outs and does not silently opt new leads into release emails.
- The standalone Basic welcome email is best-effort after team creation. Missing provider keys or provider errors do not block team creation.

## Next

- Browser-verify Phase 4 Slice 4d, then move to Phase 5 tournament coach experience.
