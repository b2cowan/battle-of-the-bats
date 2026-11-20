-- ---------------------------------------------------------------
-- Migration 512 — Free time, the same rules for clubs and coaches (owner rulings 2026-11-19, plan
-- docs/projects/active/FREE_TIME_SAME_RULES_PLAN.md): club free time gets the coach's ending reminders. A club whose
-- free time (a whole plan, sections, or a billing status) has an end date is emailed 14 days and 3 days before its last
-- free day, every active owner, once each per end. A grant with no end date gets neither.
--
-- WHAT CHANGES (two nullable columns on org_overrides, no back-fill, no index, re-runnable):
--   ending_reminded_14_for  date — the LAST FREE DAY the 14-day reminder was sent for.
--   ending_reminded_3_for   date — the LAST FREE DAY the 3-day reminder was sent for.
-- Keyed on the last free day (not "sent: yes/no") so staff moving the end re-arms both, and the daily job can claim a
-- reminder with one conditional update that only one run can win (the shape of migration 407 on team_workspaces).
-- Coaches Portal grants never use these: a portal's reminders keep their stamps on team_workspaces (mig 407).
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.org_overrides
  ADD COLUMN IF NOT EXISTS ending_reminded_14_for date,
  ADD COLUMN IF NOT EXISTS ending_reminded_3_for date;

COMMENT ON COLUMN public.org_overrides.ending_reminded_14_for IS
  'The last free day (Eastern) the club''s 14-day "free time is ending" email was sent for (Free time same rules, owner 2026-11-19). Claimed by the free-time daily job before it sends; a different end re-arms it. Null = never sent. Club grants only.';
COMMENT ON COLUMN public.org_overrides.ending_reminded_3_for IS
  'The last free day (Eastern) the club''s 3-day "free time is ending" email was sent for (Free time same rules, owner 2026-11-19). Claimed before it is sent; a different end re-arms it. Null = never sent. Club grants only.';

COMMIT;
