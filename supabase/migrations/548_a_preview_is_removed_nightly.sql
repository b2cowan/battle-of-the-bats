-- 548_a_preview_is_removed_nightly.sql
--
-- SCHEDULER AUTOMATION, its own commit (the owner's go given in conversation 2026-11-26, AGENCY_RULES 2026-09-26: "Yes,
-- build the job"). Club Website Track P, Session P4 (owner ruling T11, 2026-11-25): a preview is removed by itself 30
-- days after its meeting. Once a night the database calls POST /api/platform-admin/preview-removal-nightly on the app,
-- the same way migrations 395, 408, 422, 470 and 504 call theirs, through migration 502's receipt-carrying tick.
--
-- What it does each night (lib/preview-removal-server.ts `removeDuePreviews`): every preview whose removal day has come
-- and that is still unclaimed is removed through `remove_due_preview` (mig 547) — one database step under the claim's own
-- locks that re-checks "a preview, unclaimed, not removed, past its day" before it deletes anything — then its stored
-- files; the files of previews removed in the last 7 days are cleared again; the one email's consent records are deleted
-- three years after their send. Nothing emails the club. A failure is an alert email, a `preview_removal_tick` audit row,
-- the heartbeat, and Today's "Removal overdue (N)". At most five previews are ever open (T6). Idempotent.
--
-- Adds NO tables and NO columns: **the check:migrations drift gate CANNOT detect prod missing this migration**; it is
-- tracked in MANUAL_PROD_STEPS.json. ORDER, load-bearing: mig 502 and mig 547 first, then the code serving on production,
-- THEN this (before the route exists the tick is a harmless 404). cron.schedule(name, ...) upserts by (jobname,
-- username), so re-applying is idempotent.
--
-- At 08:05 UTC: 3:05 a.m. Toronto in winter, 4:05 a.m. in summer, so a preview comes down early on its removal day (the
-- day the room window, the email and the ended page name). Clear of the 08:15–08:55 sweeps.

select cron.schedule(
  'preview-removal-nightly',
  '5 8 * * *',
  $job$ set statement_timeout = '60s'; select public.app_cron_http_tick('preview_removal_tick', '/api/platform-admin/preview-removal-nightly'); $job$
);
