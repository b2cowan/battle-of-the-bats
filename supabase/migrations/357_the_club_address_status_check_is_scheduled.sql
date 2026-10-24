-- 357_the_club_address_status_check_is_scheduled.sql
--
-- WATCHED AUTOMATION. Schedules the status check for a club's own web address (Club Tier Stage 4e, Part 6): every 15 minutes
-- the database calls POST /api/platform-admin/club-domains-tick on the app, the same way the dues reminders and the demo
-- sandbox ticks are called. Owner's yes for THIS job, given in the close-out chat 2026-10-24, for the DEV database only; the
-- production job is a manual prod step (MANUAL_PROD_STEPS.json), created at the Club release, after the 4e code and the app's
-- AWS keys are on production.
--
-- What it does each wake (lib/club-domain-tick.ts): READS ONLY against AWS and DNS, never a write to either.
--   - no connected clubs: one read of a tiny table, nothing written, no audit row;
--   - per connected club: 24 DNS lookups a day for record 2 (hourly), plus once a day one DNS lookup (record 1), one host read,
--     one certificate read and one HTTP request;
--   - a waiting address is looked at every wake until it is live or gives up after two days; a broken one every wake so a fix
--     clears itself within a quarter of an hour.
-- It moves a connection between connected / needs attention / not working / not connected and emails the OWNER once per stretch.
--
-- Adds NO tables and NO columns. Like migs 122/183/224/226, that means **the check:migrations drift gate CANNOT detect prod
-- missing this migration**: it is tracked in MANUAL_PROD_STEPS.json.
--
-- Reuses migration 183's public.app_cron_http_tick(job, path): Vault-held base URL + shared secret, async dispatch through pg_net,
-- and a dispatch heartbeat row. Until the Vault secrets exist, or while the deployed app does not yet carry the route, the tick
-- is harmless (a heartbeat error / a 404 nobody consults).
--
-- cron.schedule(name, ...) upserts by (jobname, username), so re-applying is idempotent. Schedules are GMT on Supabase.

select cron.schedule(
  'club-domains-tick',
  '*/15 * * * *',
  $job$ set statement_timeout = '60s'; select public.app_cron_http_tick('club_domains_tick', '/api/platform-admin/club-domains-tick'); $job$
);
