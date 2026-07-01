-- Migration 168: add 'waitlisted' to the rep_tryout_registrations status set (Phase 2B.3).
--
-- The ranked decision board lets a coach sort each candidate into Offer / Waitlist / Not this season.
-- Offer→'offered', Not this season→'declined' already exist; Waitlist needs a new state distinct from
-- 'pending_review' (undecided) so 2B.5 can auto-promote from the waitlist on a lapse.
--
-- Additive to the CHECK: drop + recreate the named constraint with the extra value. Non-destructive
-- (no existing row changes; no column change). Idempotent via the drop-if-exists.

alter table public.rep_tryout_registrations
  drop constraint if exists rep_tryout_registrations_status_check;

alter table public.rep_tryout_registrations
  add constraint rep_tryout_registrations_status_check
  check (status in ('pending_review','offered','waitlisted','accepted','declined','withdrawn'));
