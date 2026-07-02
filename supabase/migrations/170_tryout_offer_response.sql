-- Migration 170: guardian offer-response + deadline fields on rep_tryout_registrations (Phase 2B.5).
--
-- Adds the columns behind org-branded offer emails with a secure, no-login Accept/Decline link:
--   offer_token_hash    → SHA-256 of the guardian response token (raw token travels only in the email
--                         URL; we store only the hash — same posture as rep_tryout_evaluator_sessions
--                         / team_workspace_claims). Partial-unique where not null.
--   offer_sent_at       → when the offer email went out (drives the "respond by" display).
--   offer_expires_at    → the 7-day (adjustable) deadline; expiry is enforced LAZILY on board view
--                         (no scheduler) and NEVER auto-mutates status (D2: flag the coach).
--   offer_response      → the family's self-serve answer via the token page: 'accepted' | 'declined'.
--                         DISTINCT from status — the coach still finalizes (D1: accept = coach confirms).
--   offer_responded_at  → stamp of that response; also the single-use guard on the token page.
--
-- All columns nullable + additive (no default backfill needed). Non-destructive. Function-free.
-- Apply to dev; keep prod-pending; promotes with tryout migs 164-169 at release.

alter table public.rep_tryout_registrations
  add column if not exists offer_token_hash   text,
  add column if not exists offer_sent_at       timestamptz,
  add column if not exists offer_expires_at     timestamptz,
  add column if not exists offer_response       text,
  add column if not exists offer_responded_at   timestamptz;

-- The family's response is a small, closed set (mirrors the app-enforced values).
alter table public.rep_tryout_registrations
  drop constraint if exists rep_tryout_registrations_offer_response_check;
alter table public.rep_tryout_registrations
  add constraint rep_tryout_registrations_offer_response_check
  check (offer_response is null or offer_response in ('accepted', 'declined'));

-- One live token per registration; NULLs (no active offer) may repeat.
create unique index if not exists rep_tryout_registrations_offer_token_uq
  on public.rep_tryout_registrations (offer_token_hash)
  where offer_token_hash is not null;
