-- 493_club_emails_are_cleared_nightly.sql
--
-- WATCHED AUTOMATION (owner's go 2026-11-17, Club Communications Stage 1 Session 1, the retention ruling: "12 / 24 months,
-- nightly" — plan CLUB_COMMUNICATIONS_PLAN.md §8). Schedules the nightly run of the sent-email clock.
--
-- What it does each night: public.club_email_retention_sweep() (mig 492) deletes the subject and message of every club email
-- (to families, coaches or the board) sent more than 12 months ago, and the list of who it reached for every one sent more than
-- 24 months ago. The sender, date, group and counts stay. Pure SQL inside the database (no app call, no email), idempotent (a
-- swept send is marked and never swept again), and it touches only family_email_sends, family_email_recipients and the three
-- club_group_email_* tables. The family log began 2026-10-22, so the first run that blanks anything is in October 2027.
--
-- Adds NO tables and NO columns: **the check:migrations drift gate CANNOT detect prod missing this migration**; it is tracked in
-- MANUAL_PROD_STEPS.json. ⚠ ORDER ON PRODUCTION: after mig 492. The pattern is mig 472's.
--
-- 08:45 GMT = 4:45 a.m. in Toronto in summer, 3:45 a.m. in winter (ten minutes after mig 477's job). cron.schedule(name, ...)
-- upserts by (jobname, username), so re-applying is idempotent.

select cron.schedule(
  'club-email-retention-sweep',
  '45 8 * * *',
  $job$ set statement_timeout = '60s'; select public.club_email_retention_sweep(); $job$
);
