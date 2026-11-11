-- ---------------------------------------------------------------
-- Migration 469 — Board Ready · two-step sign-in, Part 3: support's reset waits for the person's confirmation.
-- Plan of record docs/projects/active/BOARD_READY_PLAN.md §5 Stage 0a "Part 3"; build prompt
-- BOARD_READY_TWO_STEP_BUILD_PROMPTS.md Part 3; drawings BOARD_READY_TWO_STEP_SIGNIN_DRAWINGS.html tab 7.
--
-- WHY: mig 463 made two_step_owner_resets for support's reset of a club owner (who asked, how, why, confirmed, runs,
-- held, cancelled, done). Building it showed three facts the table could not hold:
--   (1) the CONFIRMATION LINK emailed to the account's address. Only its SHA-256 is stored (the raw token is in the email
--       alone, the no-login token scheme of lib/no-login-token.ts), with the time it stops working;
--   (2) how many of the club's other owners, admins and treasurers were told once the person confirmed. 0 is the known
--       sole-owner gap (ask 3): the record then says no club notice was sent;
--   (3) who cancelled it: a staff email, or 'signed_in_with_code' when the person signed in with a real code during the wait.
-- And one widening: the "Lost your phone?" screen (Part 2) already promises the support version — "we confirm by email and
-- reset it 24 hours later" — to EVERYONE the club cannot reset (a parent, a coach's own team, an account in two clubs).
-- So a reset need not name a club: organization_id becomes nullable (set when the person owns a club, which is when the
-- club is told).
-- One waiting reset per person (a partial unique index), so a second request never runs twice.
--
-- Additive and re-runnable. The schedule that runs a due reset is migration 470, apart (watched automation).
-- ⚠ ORDER ON PRODUCTION: this migration first, then the code.
-- ---------------------------------------------------------------

begin;

alter table public.two_step_owner_resets
  alter column organization_id drop not null;

alter table public.two_step_owner_resets
  add column if not exists confirm_token_hash text,
  add column if not exists confirm_expires_at timestamptz,
  add column if not exists club_notice_count integer,
  add column if not exists cancelled_by text;

create unique index if not exists two_step_owner_resets_token_idx
  on public.two_step_owner_resets (confirm_token_hash) where confirm_token_hash is not null;

create unique index if not exists two_step_owner_resets_one_open_idx
  on public.two_step_owner_resets (user_id) where completed_at is null and cancelled_at is null;

comment on column public.two_step_owner_resets.organization_id is
  'The club the person owns, whose other owners, admins and treasurer are told once they confirm. NULL for a person who owns no club (support still resets them, with the same confirmation and wait). Mig 463; nullable since mig 469.';
comment on column public.two_step_owner_resets.confirm_token_hash is
  'SHA-256 (hex) of the confirmation link''s token, emailed to the account''s address. The raw token is never stored. Mig 469.';
comment on column public.two_step_owner_resets.confirm_expires_at is
  'When the confirmation link stops working (3 days after it is sent). Mig 469.';
comment on column public.two_step_owner_resets.club_notice_count is
  'How many of the club''s other owners, admins and treasurers were emailed on confirmation. 0 = no club notice was sent (a sole owner, ask 3). NULL until confirmed. Mig 469.';
comment on column public.two_step_owner_resets.cancelled_by is
  'Who cancelled it: a staff email, ''signed_in_with_code'' (the person signed in with a real code during the wait), ''email_not_sent'' or ''link_expired''. Mig 469.';

commit;
