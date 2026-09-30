-- Migration 314: an email keeps who it reached.
-- (Tournament admin redesign Stage 2, Part 0 — F42 "All accepted teams · 18" emailed every
--  registered team; owner rulings A15 "fix now, as a defect" and P3 "add it", 2026-09-30.
--  Plan: docs/projects/active/TOURNAMENT_ADMIN_REDESIGN_PLAN.md §3 F42, §6b C2;
--  build prompt: docs/projects/active/TOURNAMENT_ADMIN_REDESIGN_STAGE2_BUILD_PROMPT.md Part 0.)
--
-- An announcement email's record ("Recipients") was REBUILT when it was opened, from the teams
-- that were accepted at that moment — not from the send. So a team accepted a week after the
-- email read as one of its recipients, and (before this change) the send itself reached every
-- registered team while the record listed only the accepted ones. From this migration the send
-- writes down the addresses it sent to, with the team(s) each address stood for AT SEND TIME, in
-- the same post-send update that writes the counters. The record reads this list and nothing else.
--
-- Shape (jsonb array, one element per address — an address two teams share is ONE element):
--   [{ "email": "coach@example.com", "teams": [{ "id": "<teams.id>", "name": "Storm U11 Girls" }] }]
-- A failed address is ALSO in email_failed_addresses (the list is who the send tried; delivered =
-- this list minus the failed ones). NULL on every email sent before this migration and on every
-- site-only post: the list was never kept, and the record says so rather than guessing.
--
-- Additive and nullable: the code that writes it and the code that ignores it both run against it,
-- so it can be applied to prod any time before the promote that ships the writer. Visible to the
-- schema drift check (a column), so no MANUAL_PROD_STEPS entry.

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS email_recipients jsonb;

COMMENT ON COLUMN public.announcements.email_recipients IS
  'Who an announcement email was sent to, written by the send (mig 314): [{email, teams:[{id,name}]}], one element per address, team names as they were at send time. Failed addresses are also in email_failed_addresses. NULL = a site-only post, or an email sent before mig 314 (the list was not kept).';

-- Verify (expect one row, jsonb, nullable):
--   SELECT data_type, is_nullable FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = 'email_recipients';
