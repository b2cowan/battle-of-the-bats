-- 504_a_run_out_invitation_is_swept_nightly.sql
--
-- SCHEDULER AUTOMATION, its own commit (owner's go required in conversation, AGENCY_RULES 2026-09-26). Board Ready trust
-- close-out 13, open call (b) (owner ruling 2026-11-18, "as recommended"; queue P2c in
-- docs/projects/active/BOARD_READY_TRUST_FIX_PROMPTS.md): an unaccepted club invitation runs out 30 days after it was
-- last sent, and a run-out one is removed. Lapsing itself is read at use by the app (lib/invitation-lapse.ts) and needs
-- no job; this schedules only the REMOVAL. Once a night the database calls
-- POST /api/platform-admin/invitation-sweep-nightly on the app, the same way migrations 395, 408, 422 and 470 call theirs,
-- through migration 502's receipt-carrying tick.
--
-- What it does each night (lib/invitation-sweep.ts `sweepRunOutInvitations`): every invitation last sent more than 60
-- days ago (30 days live + 30 days shown as run out on Members): a board role waiting on a club's coach is cleared (the
-- coach row is never deleted); a pending row is deleted (its assignments and group scopes cascade); and the account a new
-- person's invitation made is deleted only when it was never confirmed, never signed in to, and has no other use
-- (lib/member-account-keep.ts). Each removal is a club audit line. Idempotent.
--
-- Adds NO tables and NO columns: **the check:migrations drift gate CANNOT detect prod missing this migration**; it is
-- tracked in MANUAL_PROD_STEPS.json. ORDER, load-bearing: mig 502 first, then the code serving on production, THEN this
-- (before the route exists the tick is a harmless 404). cron.schedule(name, ...) upserts by (jobname, username), so
-- re-applying is idempotent.
--
-- At 09:25 UTC (early morning across Canada), clear of the daily jobs' quarter hours and the club-email sweep at 08:45.

select cron.schedule(
  'invitation-sweep-nightly',
  '25 9 * * *',
  $job$ set statement_timeout = '60s'; select public.app_cron_http_tick('invitation_sweep_tick', '/api/platform-admin/invitation-sweep-nightly'); $job$
);
