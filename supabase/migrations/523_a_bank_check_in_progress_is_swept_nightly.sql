-- 523_a_bank_check_in_progress_is_swept_nightly.sql
--
-- WATCHED AUTOMATION — the owner's yes 2026-11-22 (Bank check through a volunteer's eyes, S7 Part 1: "Yes, nightly job";
-- AGENCY_RULES: shared automation changes only on the owner's word in the conversation; its own commit). Schedules the
-- nightly run of mig 522's public.bank_check_drafts_sweep().
--
-- What it does each night: deletes every unfinished bank check (bank_check_drafts) whose 30 days from its person's last
-- change have run out (ruling 2, plan BANK_CHECK_NOVICE_UX_PLAN.md §0 A18). Pure SQL inside the database (no app call, no
-- email), idempotent, and it touches only bank_check_drafts. The routes also ignore and delete an expired row on sight;
-- this job is what removes one on an account nobody opens again.
--
-- Adds NO tables and NO columns: **the check:migrations drift gate CANNOT detect prod missing this migration**; it is
-- tracked in MANUAL_PROD_STEPS.json. ⚠ ORDER ON PRODUCTION: after mig 522. The pattern is mig 493's.
--
-- 08:55 GMT = 4:55 a.m. in Toronto in summer, 3:55 a.m. in winter (ten minutes after mig 493's job). cron.schedule(name,
-- ...) upserts by (jobname, username), so re-applying is idempotent.

select cron.schedule(
  'bank-check-drafts-sweep',
  '55 8 * * *',
  $job$ set statement_timeout = '30s'; select public.bank_check_drafts_sweep(); $job$
);
