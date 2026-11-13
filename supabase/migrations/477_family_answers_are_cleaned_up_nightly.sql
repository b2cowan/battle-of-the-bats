-- 477_family_answers_are_cleaned_up_nightly.sql
--
-- WATCHED AUTOMATION (owner's go 2026-11-13, Stage 4b build Session 1, O4: "60 days after the season's last event"). Schedules the
-- nightly run of the family-answer clean-up (Signed-in family accounts Stage 4b Part 1, ask 15).
--
-- What it does each night: public.event_availability_purge() (mig 476) clears the note's words on every family answer whose event
-- ended more than 30 days ago, and deletes every family answer (and Remind log row) of a season whose last event was more than 60 days
-- ago. Pure SQL inside the database (no app call, no email), idempotent, and it never touches the coach's attendance book.
--
-- Adds NO tables and NO columns: **the check:migrations drift gate CANNOT detect prod missing this migration**; it is tracked in
-- MANUAL_PROD_STEPS.json. ⚠ ORDER ON PRODUCTION: after mig 476. The pattern is mig 472's.
--
-- 08:35 GMT = 4:35 a.m. in Toronto in summer, 3:35 a.m. in winter (ten minutes after mig 472's job). cron.schedule(name, ...) upserts
-- by (jobname, username), so re-applying is idempotent.

select cron.schedule(
  'family-answers-purge',
  '35 8 * * *',
  $job$ set statement_timeout = '60s'; select public.event_availability_purge(); $job$
);
