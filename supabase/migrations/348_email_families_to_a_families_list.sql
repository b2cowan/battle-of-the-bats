-- ---------------------------------------------------------------
-- Migration 348 — Club Tier Stage 7c: Email families can go to one of the Families lists (owner 2026-10-22)
--
-- WHY: a club that sees "Owes money 5" on Families wants to email just those families. The send window's Who gains
-- "Families from a list" (Owes money, Missing forms, No consent on file, Not back this season), and the send log must
-- be able to record it.
--
-- WHAT CHANGES: ONE constraint. family_email_sends.audience_kind accepts a fourth kind, 'list'; which list is in
-- audience_label ("Families · Owes money"), as a team's name is for kind teams. No column, no function change
-- (family_email_claim passes p_kind through). Safe to re-run.
-- ---------------------------------------------------------------
BEGIN;

ALTER TABLE public.family_email_sends DROP CONSTRAINT IF EXISTS family_email_sends_audience_kind_check;
ALTER TABLE public.family_email_sends
  ADD CONSTRAINT family_email_sends_audience_kind_check CHECK (audience_kind IN ('every', 'teams', 'season', 'list'));

COMMENT ON COLUMN public.family_email_sends.audience_kind IS
  'every = every family with a child on a live team or in an open season; teams = the families of the rep teams in team_ids; season = the families of the house-league season season_id; list = the families on one Families list (Owes money, Missing forms, No consent on file, Not back this season), named in audience_label.';

COMMIT;
