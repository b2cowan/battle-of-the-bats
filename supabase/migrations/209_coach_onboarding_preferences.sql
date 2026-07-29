-- 209_coach_onboarding_preferences.sql
--
-- Coach Onboarding Quiet Mode, Phase C2 — move the two coach onboarding preferences off
-- device-local storage and onto the account.
--
-- Phase A shipped both as localStorage keys (coach-setup-hints-off, coach-portal-tour-seen)
-- with the seam documented as "Phase C moves these". The tour one CANNOT stay device-local
-- and still meet its owner requirement: "skip ends it permanently for that coach, across
-- every team they hold" — a new device would re-offer a tour they explicitly killed. The
-- hints one rides along because it has the same shape (per coach, never per team) and the
-- Phase A review logged shared-device preference bleed as accepted-until-Phase-C.
--
-- Columns, not a new table: user_preferences (mig 195) was built deliberately general for
-- exactly this — "future account-synced UI prefs join as COLUMNS instead of spawning more
-- single-column tables" (see that migration's header). Both stay identity-scoped: keyed on
-- user_id alone, never forked per org or per team.
--
-- NOT NULL-able semantics:
--   coach_tour_dismissed_at — NULL = never finished/skipped the tour (still offer it).
--     A timestamp rather than a bool so we can tell "skipped in the first week" from
--     "skipped a year later" without a second column, and so it self-documents when.
--   coach_setup_hints_off  — false = show hints (the default a brand-new coach gets).
--     Plain bool with a NOT NULL default: unlike theme there is no third "unset" meaning,
--     and defaulting to false keeps the read path free of null-coalescing.
--
-- Per-team setup-step SKIPS deliberately stay device-local (flhq.coachSetupSkips.<teamId>):
-- those record a fact about a season, not a preference about the coach, and they already
-- reset with the season.
--
-- RELEASE ORDER — apply to prod (apply-migration-api.mjs --prod) BEFORE promoting this code:
--   * READ path is guarded. getCoachOnboardingPrefs() catches "column does not exist" like any
--     other error and returns the show-guidance defaults, so the coaches layout still renders.
--     A missed apply is a soft degradation (tour re-offered, hints stay on), not an outage.
--   * WRITE path is NOT. The upsert throws, withObservability re-throws, and the route 500s.
--     The client applied the choice optimistically and swallows the failure, so the coach
--     believes it saved and is silently reverted on their next load. Order matters.
-- `npm run check:migrations` DOES catch this: check-prod-migration-drift.mjs diffs
-- information_schema.columns per table, not merely table existence, and fails on missingColumns.
-- Run it before any promote.
--
-- ROLLBACK IS DESTRUCTIVE OF USER CHOICE. Dropping either column erases every coach's decision:
-- the tour is re-offered to people who deliberately skipped it, and setup hints come back for
-- everyone who turned them off. Nothing sensitive is lost, but do not treat a revert as free.

alter table public.user_preferences
  add column if not exists coach_tour_dismissed_at timestamptz,
  add column if not exists coach_setup_hints_off   boolean not null default false;

comment on column public.user_preferences.coach_tour_dismissed_at is
  'When this coach finished or skipped the Premium coach-portal tour. NULL = never decided, so the tour is still offered. Account-scoped on purpose: skipping ends the offer across every team the coach holds AND every device they sign in on (owner requirement). The tour stays reachable on demand from the help button and the season-setup chip regardless of this value.';

comment on column public.user_preferences.coach_setup_hints_off is
  'Whether this coach turned off Premium season-setup guidance (the header chip''s count + the next-action line under the page header). false = show guidance (default for a new coach). Per COACH, not per team — a coach with three teams dismisses once. Reversible from the season-setup chip; nothing is destroyed when it is true.';
