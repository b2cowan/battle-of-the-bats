-- ─────────────────────────────────────────────────────────────────────────────
-- 205 — game_change_notices: the schedule-change alert queue (Free Coach Portal B2.3)
--
-- WHY A QUEUE AND NOT A DIRECT SEND
-- An organizer can touch a dozen published games in ten minutes. Sending on each write
-- would buzz a coach twelve times. Each person-visible change to a PUBLISHED game is
-- recorded here instead; a 5-minute sweep (app route below) groups the pending rows by
-- (tournament, team), waits for a quiet window, and sends ONE push per team.
--
-- The heavy lifting is done by the publish gate, not this table: a game in a division
-- whose schedule_visibility is not 'published' never produces a row at all, because
-- nobody has been shown those times yet. That is where the "twenty edits" case lives.
--
-- LIFECYCLE of a row: created (sent_at NULL, superseded_at NULL)
--   → claimed + sent by the sweep (sent_at set), or
--   → superseded_at set when the organizer posts their OWN announcement covering the
--     same games (the rain-delay hand-off) — their words win, and a rain delay stays
--     one buzz instead of two.
--
-- Service-role only: RLS ENABLED with ZERO policies, same posture as fan_alert_prefs /
-- fan_follows. Read/written exclusively through lib/schedule-change-notices.ts.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.game_change_notices (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  team_id         uuid not null references public.teams(id) on delete cascade,
  game_id         uuid not null references public.games(id) on delete cascade,
  -- 'moved'     — date, time or location changed
  -- 'cancelled' — scheduled → cancelled
  -- 'restored'  — cancelled → scheduled (a coach told it was off must be told it is on)
  kind            text not null check (kind in ('moved', 'cancelled', 'restored')),
  -- The state a follower last had reason to believe. Preserved across repeated edits so two
  -- moves in one sitting read as ONE correction ("was 2:00") rather than a history.
  was_date        date,
  was_time        time,
  was_location    text,
  created_at      timestamptz not null default now(),
  -- Not eligible to send before this instant. Defaults to now() (= immediately) for ordinary
  -- single-game edits; the bulk rain-delay tool pushes it ~10 minutes out to reserve a window in
  -- which the organizer can post their OWN announcement. Without that reservation the urgent
  -- lane can fire before they finish composing, and a follower gets two messages about one
  -- rain delay. NOT NULL so the sweep is a plain `<=` comparison, never a null-or predicate.
  hold_until      timestamptz not null default now(),
  -- NULL = still pending. Claimed atomically by the sweep before the send so two overlapping
  -- sweeps can never double-buzz the same follower.
  sent_at         timestamptz,
  -- NULL = still eligible. Set when the organizer's own announcement covered these games.
  superseded_at   timestamptz
);

-- Idempotent re-apply path (the table above is create-if-not-exists, which cannot add or
-- re-shape a column in an environment that already ran an earlier revision of this file).
alter table public.game_change_notices add column if not exists hold_until timestamptz;
alter table public.game_change_notices alter column hold_until set default now();
update public.game_change_notices set hold_until = created_at where hold_until is null;
alter table public.game_change_notices alter column hold_until set not null;

-- The sweep's only read: pending rows, grouped by tournament + team, oldest first.
create index if not exists game_change_notices_pending_idx
  on public.game_change_notices (tournament_id, team_id, created_at)
  where sent_at is null and superseded_at is null;

-- The rain-delay hand-off supersedes by game id within one tournament.
create index if not exists game_change_notices_game_idx
  on public.game_change_notices (game_id)
  where sent_at is null and superseded_at is null;

-- The sweep's per-team cooldown lookup: "did we already buzz this team in the last N minutes?"
-- Only sent rows matter, so this is the complement of the pending index above.
create index if not exists game_change_notices_recent_sent_idx
  on public.game_change_notices (tournament_id, team_id, sent_at)
  where sent_at is not null;

alter table public.game_change_notices enable row level security;
-- Deliberately NO policies: anon/authenticated get nothing, service_role bypasses RLS.
revoke all on public.game_change_notices from anon, authenticated;

comment on table public.game_change_notices is
  'Queue of person-visible schedule changes to PUBLISHED games, awaiting a batched push to the followers of each affected team (Free Coach Portal B2.3). Service-role only.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Sweep tick — every 5 minutes.
--
-- Reuses public.app_cron_http_tick (migration 183), which reads the app base URL and the
-- shared secret from Supabase Vault and POSTs with x-cron-secret. Same cadence as the
-- observability metrics fold, which has run at */5 on this database since migration 122.
--
-- cron.schedule(name, …) upserts by (jobname, username) — idempotent on re-apply. A lost
-- tick is harmless: rows stay pending and the next tick picks them up (the quiet-window
-- test is evaluated fresh each run, never baked into the row).
-- ─────────────────────────────────────────────────────────────────────────────
select cron.schedule(
  'schedule-change-notices',
  '*/5 * * * *',
  $job$ set statement_timeout = '60s'; select public.app_cron_http_tick('schedule_change_notices_tick', '/api/platform-admin/schedule-change-notices'); $job$
);
