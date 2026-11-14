-- 486_a_season_asks_the_club_for_time.sql
--
-- Club Tier Stage 13d, Session A (build prompt docs/projects/active/CLUB_TIER_STAGE13D_BUILD_PROMPT.md, A1 + A3; Ask 14 A,
-- 13d-1 A, 13d-2 A). A league admin whose season has no house league time presses "Ask for time"; the ask waits on the owner's
-- and the admins' This morning (and one bell to the owner) until the club gives that season time or the season finishes. And
-- a schedule send tells house league what time it gave or took back.
--
-- WHAT CHANGES
--   1. league_season_time_asks (NEW, server-only): one row per season that asked the club for time.
--        season_id  PK, FK league_seasons ON DELETE CASCADE
--        org_id     FK organizations ON DELETE CASCADE (the tenancy anchor; indexed)
--        asked_at   when it last asked (asking again is allowed 7 days after — the route's conditional write)
--        asked_by   the league admin who asked (FK auth.users ON DELETE SET NULL). Never shown to the league admin (C6 A); the
--                   owner's card says "by its league admin", not a name.
--      Deleted by the send that gives the season time. Readers ALSO require "no time given" and a live season.
--      ⚖ A TABLE OF ITS OWN, not two columns on league_seasons (/review 2026-11-13): league_seasons is readable by anyone on a
--      season past draft ("public can read non-draft seasons", mig 020), so columns there would put the asker's account id
--      and the ask's time on the public API. RLS on, no policies, nothing to anon/authenticated (mig 326's shape).
--   2. club_schedule_sends.league_slot_ids (uuid[], nullable): the schedule's house league slots (live, still to come) as this
--      send left them — the next Send the changes' baseline for "the club gave / took back house league time" (A1). Without
--      it a slot handed from house league to a team in place (a hand drag swaps holders, it makes no slot) left no trace.
--      Written by the send log's completion (Finalize and send, Send the changes); null on older sends and on review / bill
--      sends. club_schedule_sends is already server-only (mig 326).
--   3. Dev only: two columns an earlier draft of THIS migration put on league_seasons (time_asked_at, time_asked_by) are
--      dropped if present. They never reached prod.
--
-- ⚠ ORDER: apply BEFORE the 13d code — the send path selects league_slot_ids on every preview. Visible to the drift check
-- (a table and a column), so no MANUAL_PROD_STEPS entry. Re-runnable.

begin;

set local lock_timeout = '15s';

-- ── 1. The ask ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.league_season_time_asks (
  season_id  uuid primary key references public.league_seasons(id) on delete cascade,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  asked_at   timestamptz not null default now(),
  asked_by   uuid references auth.users(id) on delete set null
);
create index if not exists league_season_time_asks_org_idx on public.league_season_time_asks (org_id, asked_at);

alter table public.league_season_time_asks enable row level security;
revoke all on public.league_season_time_asks from anon, authenticated;
grant select, insert, update, delete on public.league_season_time_asks to service_role;

comment on table public.league_season_time_asks is
  'Stage 13d (mig 486): a house league season asking the club for time ("Ask for time"), one row per season. Server-only. Deleted by the send that gives the season time; readers also require no time given and a live season. asked_by is never shown to the league admin.';

-- ── 2. The send log's house league baseline ───────────────────────────────────────────────────────────────────────────────────
alter table public.club_schedule_sends add column if not exists league_slot_ids uuid[];

comment on column public.club_schedule_sends.league_slot_ids is
  'Stage 13d (mig 486): house league''s slots of this schedule (live, still to come) as this send left them — the next Send the changes compares against it to tell the league admins what time was given or taken back. Null on older, review and bill sends.';

-- ── 3. An earlier draft's columns (dev only) ──────────────────────────────────────────────────────────────────────────────────
alter table public.league_seasons drop column if exists time_asked_at;
alter table public.league_seasons drop column if exists time_asked_by;

commit;
