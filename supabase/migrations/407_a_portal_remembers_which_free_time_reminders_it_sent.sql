-- ---------------------------------------------------------------
-- Migration 407 — Support console Stage 4b: a staff-given Coaches Portal remembers which free-time reminders it sent.
-- Owner 2026-10-28: a coach whose free Premium time is ending is emailed 14 days and 3 days before it runs out (this
-- reverses Stage 4b's Q7, "in the product only, no email"). Each reminder goes once per end.
--
-- WHAT CHANGES (two nullable columns on team_workspaces, no back-fill, no index, re-runnable):
--   free_time_reminded_14_for  date — the LAST FREE DAY the 14-day reminder was sent for.
--   free_time_reminded_3_for   date — the LAST FREE DAY the 3-day reminder was sent for.
-- Keyed on the last free day (not "sent: yes/no") so staff moving the end re-arms both, and the daily job can claim a
-- reminder with one conditional update that only one run can win.
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.team_workspaces
  ADD COLUMN IF NOT EXISTS free_time_reminded_14_for date,
  ADD COLUMN IF NOT EXISTS free_time_reminded_3_for date;

COMMENT ON COLUMN public.team_workspaces.free_time_reminded_14_for IS
  'The last free day (Eastern) the 14-day "free time is ending" email was sent for (Support console Stage 4b, owner 2026-10-28). Claimed by the portal-free-time daily job before it sends; a different end re-arms it. Null = never sent.';
COMMENT ON COLUMN public.team_workspaces.free_time_reminded_3_for IS
  'The last free day (Eastern) the 3-day "free time is ending" email was sent for (Support console Stage 4b, owner 2026-10-28). Claimed before it is sent; a different end re-arms it. Null = never sent.';

COMMIT;
