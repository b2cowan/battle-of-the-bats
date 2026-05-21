-- Migration 052: tournament creation timestamp for platform metrics
-- Enables "tournaments created in the last 30 days" dashboard metrics.

alter table public.tournaments
  add column if not exists created_at timestamptz;

update public.tournaments
set created_at = coalesce(start_date::timestamptz, now())
where created_at is null;

alter table public.tournaments
  alter column created_at set default now(),
  alter column created_at set not null;

create index if not exists idx_tournaments_created_at
  on public.tournaments(created_at desc);

comment on column public.tournaments.created_at is
  'Timestamp used for platform admin tournament creation metrics. Existing rows were backfilled from start_date when available, otherwise migration time.';
